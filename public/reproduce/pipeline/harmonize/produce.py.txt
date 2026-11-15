"""Production fit (frozen tau, tau_b) + year-block bootstrap + fill harm/harm_lo/harm_hi/src in tiles.

usage: python3 -I produce.py --input q25 [--tiles-dir DIR] [--months-from manifest|data]
Requires the final stage to have run for this input (test years unlocked, decisions frozen).
"""
import sys, os, json, glob, argparse, time
import numpy as np
import pandas as pd
from scipy import stats
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from common import load_config, log, OUT, LOCK_PATH, load_day, atomic_json, PLATS, tile_name
from model import Panel, fit_bridges, bridge_sums, bridge_from_sums, viirs_V, M_of, k_sums, k_from_sums

ap = argparse.ArgumentParser()
ap.add_argument("--input", default="q25")
ap.add_argument("--tiles-dir", default=None)
ap.add_argument("--dry", action="store_true", help="compute but do not write tiles")
ap.add_argument("--smoke-hide-viirs", action="store_true", help="smoke only: pretend VIIRS absent before 2016 to exercise the MODIS path")
ap.add_argument("--smoke", action="store_true", help="code test: train decisions, locked years excluded, scratch tiles only")
args = ap.parse_args()
cfg = load_config()
M_ = cfg["method"]
lock = json.load(open(LOCK_PATH))
if args.smoke:
    assert args.tiles_dir and "/public/" not in os.path.abspath(args.tiles_dir), "smoke runs never touch public tiles"
    FIN = json.load(open(f"{OUT}/train_{args.input}.json"))
else:
    assert lock.get("unlocked_test_years"), "final stage has not run"
    FIN = json.load(open(f"{OUT}/final_{args.input}.json"))
assert FIN["config_hash"] == cfg["config_hash"]
tau, tau_b = FIN["decisions"]["tau"], FIN["decisions"]["tau_b"]
chosen = FIN["decisions"]["chosen_model"]
if chosen != "ratio_bridge_pre_drift":
    sys.exit("GBM was chosen: production path for GBM must be run (not implemented until needed)")
tiles_dir = args.tiles_dir or cfg["inputs"]["tiles_dir"]
B = M_["uncertainty"]["B"]
rng = np.random.default_rng(M_["uncertainty"]["seed"])
PF = M_["years"]["production_fit"]
LOCKED = M_["years"]["locked_test"]
t0 = time.time()

log("load all years")
ALLOW = not args.smoke
df = load_day(cfg, args.input, allow_locked=ALLOW)
fit_years = sorted(set(range(2012, 2026)) & set(df.year.unique().tolist()))
pan = Panel(cfg, args.input, fit_years, allow_locked=ALLOW, df=df)
log("panel", pan.n, "cells", pan.years)

# ---------------------------------------------------------------- bridge (pre-registered fit years) + bootstrap
bridge_years = FIN["bridge_loyo"]["years"]
r = fit_bridges(pan, bridge_years, tau_b)
rvar = {}
per_b = {P: {y: bridge_sums(pan, P, [y]) for y in bridge_years} for P in ["J1", "J2"]}
for P in ["J1", "J2"]:
    if r.get(P) is None:
        continue
    acc = []
    for b in range(B):
        ys = rng.choice(bridge_years, len(bridge_years), replace=True)
        SN = sum(per_b[P][y][0] for y in ys); SP = sum(per_b[P][y][1] for y in ys)
        rb = bridge_from_sums(SN, SP, tau_b)
        acc.append(rb if rb is not None else r[P])
    rvar[P] = np.var(np.stack(acc), 0)
log("bridge done", {P: (None if r.get(P) is None else float(np.nanmedian(r[P]))) for P in ["J1", "J2"]})

# ---------------------------------------------------------------- k (production_fit years) + bootstrap
V = viirs_V(pan, r, pan.fit_min)
pf = [y for y in PF if y in pan.years]
K, KVAR = {}, {}
for combo in ["TA", "T", "A"]:
    M = M_of(pan, combo, pan.fit_min)
    per = [k_sums(pan, V, M, [y]) for y in pf]
    Vy = np.stack([p[0] for p in per]).astype(np.float32); My = np.stack([p[1] for p in per]).astype(np.float32)
    K[combo] = k_from_sums(pan, Vy.sum(0), My.sum(0), tau)
    mean = np.zeros_like(K[combo]); m2 = np.zeros_like(K[combo])
    for b in range(B):
        w = np.bincount(rng.integers(0, len(pf), len(pf)), minlength=len(pf)).astype(np.float32)
        kb = k_from_sums(pan, np.tensordot(w, Vy, 1), np.tensordot(w, My, 1), tau)
        d = kb - mean; mean += d / (b + 1); m2 += d * (kb - mean)
    KVAR[combo] = m2 / (B - 1)
    del Vy, My, per, M
    log("k", combo, "median", float(np.median(K[combo])), "median cv", float(np.median(np.sqrt(KVAR[combo]) / K[combo])))
cellkey = {(round(a, 4), round(b, 4)): i for i, (a, b) in enumerate(zip(pan.cells.lat, pan.cells.lon))}
i5 = pan.i5
cov = None
del V

# coverage for all months (all years present)
from common import coverage_table, presence
covt = coverage_table(cfg, presence(df))
cfgcov = M_["coverage"]
use_min = cfgcov["use_min"]

# ---------------------------------------------------------------- months
man = cfg["inputs"]["manifest"]
if os.path.exists(man):
    months = json.load(open(man))["months"]
else:
    yrs = sorted(df.year.unique())
    months = [f"{y}-{m:02d}" for y in yrs for m in range(1, 13)]
    log("no manifest: months from data", months[0], months[-1])
ym = [(int(s[:4]), int(s[5:7])) for s in months]
nm = len(months)
CV = {p: np.array([covt.loc[(y, m), p] if (y, m) in covt.index else 0.0 for (y, m) in ym]) for p in PLATS}
if args.smoke and args.smoke_hide_viirs:
    for P in ["N", "J1", "J2"]:
        CV[P] = np.where(np.array([y < 2016 for (y, m) in ym]), 0.0, CV[P])
TERRA_ONLY = tuple(map(int, M_["years"]["terra_only_before"].split("-")))
moy = np.array([m - 1 for (_, m) in ym])
pre_aqua = np.array([(y, m) < TERRA_ONLY for (y, m) in ym])

# long df indexed for fast per-tile lookup
mindex = {s: i for i, s in enumerate(months)}
icode = {int(k[:4]) * 100 + int(k[5:7]): i for k, i in mindex.items()}
df["mi"] = pd.Series(df.year.values.astype(int) * 100 + df.month.values.astype(int), index=df.index).map(icode).fillna(-1).astype(int)
df = df[df.mi >= 0]
df["l5"] = (np.floor(df.lat.values / 5 + 1e-9) * 5).astype(int)
df["o5"] = (np.floor(df.lon.values / 5 + 1e-9) * 5).astype(int)
groups = dict(tuple(df.groupby(["l5", "o5"])))
log("df grouped by tile", len(groups))


def nb_quant(mu, var, q):
    mu = np.asarray(mu, float); var = np.maximum(np.asarray(var, float), mu)
    out = np.zeros_like(mu)
    pos = mu > 0
    over = pos & (var > mu * (1 + 1e-9))
    poi = pos & ~over
    out[poi] = stats.poisson.ppf(q, mu[poi])
    n_ = mu[over] ** 2 / (var[over] - mu[over]); p_ = n_ / (n_ + mu[over])
    out[over] = stats.nbinom.ppf(q, n_, p_)
    return out


def harmonize_tile(cells):
    """cells: list of [lat, lon]. returns harm, lo, hi (lists with None), src strings."""
    nc = len(cells)
    R = {p: np.zeros((nc, nm), np.float32) for p in PLATS}
    tkey = (int(np.floor(cells[0][0] / 5 + 1e-9) * 5), int(np.floor(cells[0][1] / 5 + 1e-9) * 5))
    g = groups.get(tkey)
    loc = {(round(a, 4), round(b, 4)): j for j, (a, b) in enumerate(cells)}
    if g is not None:
        j = np.array([loc.get((round(a, 4), round(b, 4)), -1) for a, b in zip(g.lat, g.lon)])
        s = j >= 0
        for p in PLATS:
            sp = s & (g.plat.values == p)
            np.add.at(R[p], (j[sp], g.mi.values[sp]), g.v.values[sp])
    gi = np.array([cellkey.get((round(a, 4), round(b, 4)), -1) for a, b in cells])
    # cells unknown to the panel (should not happen) fall back to tile-level -> use global median k
    harm = np.full((nc, nm), np.nan); var = np.zeros((nc, nm)); src = np.full((nc, nm), "X")
    # ---- VIIRS
    num = np.zeros((nc, nm)); cnt = np.zeros(nm); vterm = np.zeros((nc, nm))
    t5i = i5[gi] if (gi >= 0).all() else np.where(gi >= 0, i5[np.maximum(gi, 0)], -1)
    for P in ["N", "J1", "J2"]:
        ok = CV[P] >= use_min
        if not ok.any() or (P != "N" and r.get(P) is None):
            continue
        sc = np.where(ok, 1 / np.where(CV[P] > 0, CV[P], 1), 0)
        x = R[P] * sc[None, :]
        rr = np.ones((nc, nm)) if P == "N" else np.where(t5i[:, None] >= 0, r[P][np.maximum(t5i, 0)][:, moy], np.nanmedian(r[P][:, moy], 0)[None, :])
        num += np.where(ok[None, :], rr * x, 0); cnt += ok
        if P != "N":
            rv = np.where(t5i[:, None] >= 0, rvar[P][np.maximum(t5i, 0)][:, moy], 0)
            vterm += np.where(ok[None, :], x ** 2 * rv, 0)
    hv = cnt > 0
    harm[:, hv] = num[:, hv] / cnt[hv]
    var[:, hv] = harm[:, hv] + vterm[:, hv] / cnt[hv] ** 2
    src[:, hv] = "V"
    # ---- MODIS
    okT, okA = CV["T"] >= use_min, CV["A"] >= use_min
    combo = np.where(~hv & okT & okA & ~pre_aqua, "TA", np.where(~hv & okT, "T", np.where(~hv & okA, "A", "")))
    for c in ["TA", "T", "A"]:
        cols = combo == c
        if not cols.any():
            continue
        M = np.zeros((nc, cols.sum()))
        for p in c:
            M += R[p][:, cols] / CV[p][cols][None, :]
        kk = np.where(gi[:, None] >= 0, K[c][np.maximum(gi, 0)][:, moy[cols]], np.median(K[c][:, moy[cols]], 0)[None, :])
        kv = np.where(gi[:, None] >= 0, KVAR[c][np.maximum(gi, 0)][:, moy[cols]], 0)
        harm[:, cols] = kk * M
        var[:, cols] = kk * M + M ** 2 * kv
        src[:, cols] = "M"
    lo = nb_quant(np.nan_to_num(harm), var, 0.05); hi = nb_quant(np.nan_to_num(harm), var, 0.95)
    lo = np.minimum(lo, np.nan_to_num(harm)); hi = np.maximum(hi, np.nan_to_num(harm))
    d = M_["output"]["precision_decimals"]

    def tolist(a):
        a = np.round(a, d)
        return [[None if (s_ == "X") else (int(v) if v == int(v) else float(v)) for v, s_ in zip(row, srow)]
                for row, srow in zip(a, src)]
    return tolist(harm), tolist(lo), tolist(hi), ["".join(s_) for s_ in src]


files = sorted(glob.glob(os.path.join(tiles_dir, "*.json")))
log("tiles", len(files), "months", nm, months[0], "->", months[-1])
summary = {"tiles": 0, "cells": 0, "src_counts": {"V": 0, "M": 0, "X": 0}, "skipped": []}
for fp in files:
    try:
        tj = json.load(open(fp))
    except Exception as e:
        summary["skipped"].append([os.path.basename(fp), str(e)[:80]]); continue
    cells = tj.get("cells", [])
    if not cells:
        summary["skipped"].append([os.path.basename(fp), "no cells"]); continue
    h, lo, hi, src = harmonize_tile(cells)
    tj["harm"], tj["harm_lo"], tj["harm_hi"], tj["src"] = h, lo, hi, src
    if not args.dry:
        atomic_json(fp, tj, separators=(",", ":"))
    summary["tiles"] += 1; summary["cells"] += len(cells)
    for s_ in src:
        for c in "VMX":
            summary["src_counts"][c] += s_.count(c)
summary.update({"tau": tau, "tau_b": tau_b, "B": B, "config_hash": cfg["config_hash"], "months": [months[0], months[-1]],
                "production_fit_years": pf, "bridge_years": bridge_years, "runtime_sec": round(time.time() - t0),
                "k_TA_global_median_by_moy": [round(float(np.median(K["TA"][:, m])), 3) for m in range(12)]})
atomic_json(f"{OUT}/produce_{args.input}{'_smoke' if args.smoke else ''}.json", summary, indent=1, default=float)
log("done", summary)
