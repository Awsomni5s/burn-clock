"""Validation of the harmonization.

usage: python3 -I validate.py --input dev|q25 --stage train|final

train : locked test years (2016, 2019) are dropped at load time. Selects tau_b and tau by LOYO,
        scores bridge vs GBM on identical LOYO splits, LORO, denial, drift-contaminated refit,
        drift seam on non-locked years. Writes out/train_<input>.json (decisions included).
final : needs out/train_<input>.json and CONFIG.lock. Marks test years unlocked, scores both models
        on 2016 and 2019 (fit on training years with the frozen tau), recomputes change-point with all
        years, writes out/final_<input>.json.
"""
import sys, os, json, argparse, time
import numpy as np
import pandas as pd
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from common import (load_config, log, OUT, LOCK_PATH, summarize, annual_err, r2_log, in_box, atomic_json,
                    load_day)
from model import (Panel, fit_bridges, bridge_sums, bridge_from_sums, viirs_V, M_of, k_sums, k_from_sums,
                   poisson_dev, fit_gbm, predict_gbm)

ap = argparse.ArgumentParser()
ap.add_argument("--input", default="dev")
ap.add_argument("--stage", default="train")
ap.add_argument("--skip-gbm", action="store_true")
ap.add_argument("--value", default=None, help="override value column (e.g. detections) for the FireClock-like variant")
args = ap.parse_args()
cfg = load_config()
M_ = cfg["method"]
Y = M_["years"]
TRAIN, LOCKED = Y["training"], Y["locked_test"]
FINAL = args.stage == "final"
t0 = time.time()
VTAG = f"_{args.value}" if args.value else ""

if FINAL:
    trainf = f"{OUT}/train_{args.input}{VTAG}.json"
    assert os.path.exists(trainf), "run --stage train first"
    TR = json.load(open(trainf))
    assert TR["config_hash"] == cfg["config_hash"], "train decisions made under another config hash"
    lock = json.load(open(LOCK_PATH))
    lock["unlocked_test_years"] = True
    lock.setdefault("unlock_log", []).append({"input": args.input, "utc": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())})
    json.dump(lock, open(LOCK_PATH, "w"), indent=1)

ALL_YEARS = list(range(2000, 2027))
log("loading", args.input)
df = load_day(cfg, args.input, allow_locked=FINAL, value=args.value)
years_present = sorted(int(y) for y in df.year.unique())
log("years present", years_present[0], "-", years_present[-1], "rows", len(df))
pan = Panel(cfg, args.input, [y for y in years_present if y >= 2012], allow_locked=FINAL, df=df)
# MODIS-only era (2003-2011): T+A day counts scaled by coverage (usable months only), [y, n, 12]
from common import coverage_table, presence
ME_YEARS = [y for y in range(2003, 2012) if y in years_present]
ME = None
if ME_YEARS:
    covt = coverage_table(cfg, presence(df))
    kc_ = pd.DataFrame({"a": np.round(pan.cells.lat.values * 4).astype(np.int64),
                        "b": np.round(pan.cells.lon.values * 4).astype(np.int64), "ci": np.arange(pan.n)})
    ME = np.zeros((len(ME_YEARS), pan.n, 12), np.float32)
    for p_ in ["T", "A"]:
        d_ = df[df.year.isin(ME_YEARS) & (df.plat == p_)]
        kd = pd.DataFrame({"a": np.round(d_.lat.values * 4).astype(np.int64), "b": np.round(d_.lon.values * 4).astype(np.int64)})
        ci_ = kd.merge(kc_, on=["a", "b"], how="left").ci.values.astype(np.int64)
        cv = np.array([[covt.loc[(y, m + 1), p_] for m in range(12)] for y in ME_YEARS])
        yi_ = np.searchsorted(ME_YEARS, d_.year.values); mi_ = d_.month.values.astype(int) - 1
        a_ = np.zeros_like(ME)
        np.add.at(a_, (yi_, ci_, mi_), d_.v.values)
        ME += a_ * np.where(cv >= pan.use_min, 1 / np.where(cv > 0, cv, 1), np.nan)[:, None, :].astype(np.float32)
        del a_, d_
del df
import gc; gc.collect()
cells = pan.cells
log("cells", pan.n, "years", pan.years, "coverage sources", pan.cov_sources)

# ---------------------------------------------------------------- regions
REG = {"global": np.ones(pan.n, bool)}
for c in ["Africa", "Asia", "Europe", "North America", "Oceania", "South America"]:
    REG[c] = cells.continent.values == c
REG["punjab_haryana"] = in_box(cells, M_["regions"]["punjab_haryana"])
REG["parana_delta"] = in_box(cells, M_["regions"]["parana_delta"])
log("cells per region", {k: int(v.sum()) for k, v in REG.items()})


def region_monthly(X, years, mask):
    iy = pan.yidx(years)
    return {pan.years[y]: X[y][mask].sum(0) for y in iy}  # each [12], NaN for unusable months


def evaluate(pred, obs, years, regions=REG):
    """pred, obs [Y,n,12] with NaN on months not evaluated. Same months for both."""
    res = {}
    for name, msk in regions.items():
        if msk.sum() == 0:
            continue
        P = region_monthly(pred, years, msk); O = region_monthly(obs, years, msk)
        ap_, ao = {}, {}
        pm, om = [], []
        for y in O:
            ok = ~np.isnan(O[y]) & ~np.isnan(P[y])
            if ok.sum() == 0:
                continue
            ap_[y] = float(P[y][ok].sum()); ao[y] = float(O[y][ok].sum())
            pm += list(P[y][ok]); om += list(O[y][ok])
        s = summarize(annual_err(ap_, ao))
        s["r2_log_monthly"] = None if r2_log(pm, om) is None else round(r2_log(pm, om), 4)
        s["obs_annual_total_mean"] = round(float(np.mean(list(ao.values()))), 1) if ao else None
        s["n_months"] = len(om)
        res[name] = s
    return res


def tile_metric(pred, obs, years, min_obs=100):
    errs = []
    n5 = len(pan.u5)
    for y in pan.yidx(years):
        ok = ~np.isnan(obs[y, 0, :]) & ~np.isnan(pred[y, 0, :])
        po = np.bincount(pan.i5, np.nansum(pred[y][:, ok], 1), n5)
        oo = np.bincount(pan.i5, np.nansum(obs[y][:, ok], 1), n5)
        s = oo >= min_obs
        errs += list(100 * np.abs(po[s] - oo[s]) / oo[s])
    return {"median_abs_annual_err_pct_tile_years": round(float(np.median(errs)), 2) if errs else None,
            "n_tile_years": len(errs)}


def masked(X, M, V):
    """Apply evaluation month mask (fitmask & V & M usable) to X."""
    ok = pan.fitmask & ~np.isnan(V[:, 0, :]) & ~np.isnan(M[:, 0, :])
    return np.where(ok[:, None, :], X, np.nan).astype(np.float32)


out = {"config_hash": cfg["config_hash"], "input": args.input, "stage": args.stage,
       "grid_deg": pan.grid, "value_column": args.value or cfg["inputs"][args.input]["value"],
       "years_loaded": pan.years, "n_cells": int(pan.n),
       "cells_per_region": {k: int(v.sum()) for k, v in REG.items()},
       "coverage_sources": pan.cov_sources,
       "fit_excluded_months": [f"{pan.years[y]}-{m+1:02d}" for y in range(len(pan.years)) for m in range(12)
                               if not pan.fitmask[y, m] and pan.years[y] in Y["all_overlap_drift_contaminated"]]}

# ---------------------------------------------------------------- 1. VIIRS bridge
bridge_years = [y for y in pan.years if y >= 2012 and y not in LOCKED and
                ((pan.cov["N"][pan.yidx([y])[0]] >= pan.fit_min) & (pan.cov["J1"][pan.yidx([y])[0]] >= pan.fit_min)).any()]
log("bridge years (N & J1 both usable)", bridge_years)
J1s = pan.scaled("J1", pan.fit_min); Ns = pan.scaled("N", pan.fit_min)
both = (pan.cov["N"] >= pan.fit_min) & (pan.cov["J1"] >= pan.fit_min)
if FINAL:
    tau_b = TR["decisions"]["tau_b"]
    bridge_loyo = TR["bridge_loyo"]
else:
    devs = {}
    per_year_SN = {y: bridge_sums(pan, "J1", [y]) for y in bridge_years}
    for tb in M_["bridge"]["tau_b_grid"]:
        D = 0.0
        for y in bridge_years:
            SN = sum(per_year_SN[z][0] for z in bridge_years if z != y)
            SP = sum(per_year_SN[z][1] for z in bridge_years if z != y)
            r = bridge_from_sums(SN, SP, tb)
            iy = pan.yidx([y])[0]
            for m in range(12):
                if both[iy, m]:
                    j = J1s[iy, :, m]; s = j > 0
                    D += poisson_dev(Ns[iy, s, m], r[pan.i5[s], m] * j[s])
        devs[tb] = D
    tau_b = min(devs, key=devs.get)
    log("tau_b deviance", {k: (round(v) if np.isfinite(v) else "inf") for k, v in devs.items()}, "->", tau_b)
    # denial: hide N, reconstruct from J1 (LOYO over bridge years)
    predN = np.full_like(Ns, np.nan); obsN = np.full_like(Ns, np.nan)
    for y in bridge_years:
        SN = sum(per_year_SN[z][0] for z in bridge_years if z != y)
        SP = sum(per_year_SN[z][1] for z in bridge_years if z != y)
        r = bridge_from_sums(SN, SP, tau_b)
        iy = pan.yidx([y])[0]
        for m in range(12):
            if both[iy, m]:
                predN[iy, :, m] = r[pan.i5, m] * J1s[iy, :, m]; obsN[iy, :, m] = Ns[iy, :, m]
    bridge_loyo = {"tau_b_deviance": {str(k): (round(v, 1) if np.isfinite(v) else "inf") for k, v in devs.items()}, "tau_b": tau_b,
                   "years": bridge_years, "metrics": evaluate(predN, obsN, bridge_years)}
out["bridge_loyo"] = bridge_loyo
r_fit = fit_bridges(pan, bridge_years, tau_b)
out["bridge_global_ratio_N_over_J1_by_moy"] = [round(float(x), 4) for x in
                                               (bridge_sums(pan, "J1", bridge_years)[0].sum(0) /
                                                np.maximum(bridge_sums(pan, "J1", bridge_years)[1].sum(0), 1e-9))]
if r_fit.get("J2") is None:
    out["bridge_J2"] = "no J2 overlap in input"

V = viirs_V(pan, r_fit, pan.fit_min)
MM = {c: M_of(pan, c, pan.fit_min) for c in ["TA", "T", "A"]}

# per-year sums cache for speed
def sums(combo, years, mask=None, keep=None):
    return k_sums(pan, V, MM[combo], years, mask=mask, cell_keep=keep)

# ---------------------------------------------------------------- 2. tau by LOYO (training years)
train_years = [y for y in TRAIN if y in pan.years]
if FINAL:
    tau = TR["decisions"]["tau"]
else:
    per_year = {y: sums("TA", [y]) for y in train_years}
    devs = {}
    for t in M_["k"]["tau_grid"]:
        D = 0.0
        for y in train_years:
            Vc = sum(per_year[z][0] for z in train_years if z != y)
            Mc = sum(per_year[z][1] for z in train_years if z != y)
            kc = k_from_sums(pan, Vc, Mc, t)
            iy = pan.yidx([y])[0]
            for m in range(12):
                if pan.fitmask[iy, m] and not np.isnan(V[iy, 0, m]):
                    mm = MM["TA"][iy, :, m]; s = mm > 0
                    D += poisson_dev(V[iy, s, m], kc[s, m] * mm[s])
        devs[t] = D
    tau = min(devs, key=devs.get)
    out["tau_deviance"] = {str(k): (round(v, 1) if np.isfinite(v) else "inf") for k, v in devs.items()}
    log("tau deviance", {k: (round(v) if np.isfinite(v) else "inf") for k, v in devs.items()}, "->", tau)
out["tau"] = tau; out["tau_b"] = tau_b


def loyo_pred(combo, fit_pool, years_eval, tau_=tau, keep=None):
    """For each eval year y, fit on fit_pool minus y, predict k*M for y."""
    pred = np.full_like(V, np.nan)
    for y in years_eval:
        fy = [z for z in fit_pool if z != y]
        Vc, Mc = sums(combo, fy, keep=keep)
        kc = k_from_sums(pan, Vc, Mc, tau_)
        iy = pan.yidx([y])[0]
        pred[iy] = kc * MM[combo][iy]
    return pred


obs_TA = masked(V, MM["TA"], V)

if not FINAL:
    # ------------------------------------------------------------ 3. LOYO bridge
    pb = masked(loyo_pred("TA", train_years, train_years), MM["TA"], V)
    out["loyo_bridge"] = evaluate(pb, obs_TA, train_years)
    out["loyo_bridge_tile"] = tile_metric(pb, obs_TA, train_years)
    log("LOYO bridge global", out["loyo_bridge"]["global"], out["loyo_bridge_tile"])

    # ------------------------------------------------------------ 4. LOYO GBM (identical splits)
    if not args.skip_gbm:
        pg = np.full_like(V, np.nan)
        gbm_info = []
        for y in train_years:
            fy = [z for z in train_years if z != y]
            tg = time.time()
            g = fit_gbm(cfg, pan, fy, V, seed=y)
            pr = predict_gbm(pan, g, [y], V)
            iy = pan.yidx([y])[0]
            pg[iy] = pr[iy]
            gbm_info.append({"heldout": y, "rows": g["n_rows"], "smear": round(g["smear"], 4), "sec": round(time.time() - tg)})
            log("gbm fold", gbm_info[-1])
        pg = masked(pg, MM["TA"], V)
        out["loyo_gbm"] = evaluate(pg, obs_TA, train_years)
        out["loyo_gbm_tile"] = tile_metric(pg, obs_TA, train_years)
        out["gbm_folds"] = gbm_info
        log("LOYO gbm global", out["loyo_gbm"]["global"], out["loyo_gbm_tile"])
        pb_ = out["loyo_bridge_tile"]["median_abs_annual_err_pct_tile_years"]
        pg_ = out["loyo_gbm_tile"]["median_abs_annual_err_pct_tile_years"]
        chosen = "gbm" if pg_ <= 0.9 * pb_ else "ratio_bridge_pre_drift"
        out["model_choice"] = {"primary_bridge": pb_, "primary_gbm": pg_, "rule": M_["model_choice"]["rule"],
                               "chosen": chosen}
    else:
        out["model_choice"] = {"chosen": "ratio_bridge_pre_drift", "note": "gbm skipped (dev smoke run)"}

    # ------------------------------------------------------------ 5. denial
    den = []
    den.append({"hidden": "V", "reconstructed_from": "T+A", "design": "LOYO training years",
                "metrics": {k: out["loyo_bridge"][k] for k in ["global", "punjab_haryana", "parana_delta"] if k in out["loyo_bridge"]}})
    fwd_fit = [y for y in [2013, 2014, 2015] if y in pan.years]
    fwd_eval = [y for y in [2017, 2018] if y in pan.years]
    Vc, Mc = sums("TA", fwd_fit); kc = k_from_sums(pan, Vc, Mc, tau)
    pf = np.full_like(V, np.nan)
    for y in fwd_eval:
        iy = pan.yidx([y])[0]; pf[iy] = kc * MM["TA"][iy]
    pf = masked(pf, MM["TA"], V)
    m_ = evaluate(pf, obs_TA, fwd_eval)
    den.append({"hidden": "V", "reconstructed_from": "T+A", "design": "forward: fit 2013-15, reconstruct 2017-18",
                "metrics": {k: m_[k] for k in m_}})
    for combo, hid in [("T", "V,A"), ("A", "V,T")]:
        p_ = masked(loyo_pred(combo, train_years, train_years), MM[combo], V)
        o_ = masked(V, MM[combo], V)
        m_ = evaluate(p_, o_, train_years)
        den.append({"hidden": hid, "reconstructed_from": combo, "design": "LOYO training years", "metrics": m_,
                    "tile": tile_metric(p_, o_, train_years)})
    den.append({"hidden": "N", "reconstructed_from": "J1 (bridge)", "design": "LOYO over bridge years",
                "metrics": bridge_loyo["metrics"]})
    out["denial"] = den

    # ------------------------------------------------------------ 6. LORO
    loro = []
    for c in ["Africa", "Asia", "Europe", "North America", "Oceania", "South America"]:
        keep = ~REG[c]
        # region holdout uses ALL training years (spatial CV): fit on other regions, all training years
        Vc, Mc = sums("TA", train_years, keep=keep); kc = k_from_sums(pan, Vc, Mc, tau)
        p_ = masked(kc[None] * MM["TA"], MM["TA"], V)
        m_ = evaluate(p_, obs_TA, train_years, regions={c: REG[c]})[c]
        m_.update({"region": c, "type": "continent"})
        loro.append(m_)
    rng = np.random.default_rng(M_["loro"]["tile_blocks"]["seed"])
    nf = M_["loro"]["tile_blocks"]["n_folds"]
    fold_of_tile = rng.permutation(len(pan.u5)) % nf
    fold = fold_of_tile[pan.i5]
    pt = np.full_like(V, np.nan)
    for f in range(nf):
        keep = fold != f
        Vc, Mc = sums("TA", train_years, keep=keep); kc = k_from_sums(pan, Vc, Mc, tau)
        pt[:, ~keep, :] = (kc[None] * MM["TA"])[:, ~keep, :]
    pt = masked(pt, MM["TA"], V)
    mt = evaluate(pt, obs_TA, train_years)
    tile_loro = tile_metric(pt, obs_TA, train_years)
    out["loro"] = {"by_region": loro, "tile_blocks_5deg": {"n_folds": nf, "metrics": mt, "tile": tile_loro}}
    log("LORO done")

    # ------------------------------------------------------------ 7. drift-contaminated refit
    allov = [y for y in Y["all_overlap_drift_contaminated"] if y in pan.years]
    pc = masked(loyo_pred("TA", allov, train_years), MM["TA"], V)
    mc = evaluate(pc, obs_TA, train_years)
    Vc, Mc = sums("TA", train_years); k_pre = k_from_sums(pan, Vc, Mc, tau)
    Vc, Mc = sums("TA", allov); k_all = k_from_sums(pan, Vc, Mc, tau)
    scale = {}
    for name, msk in REG.items():
        if msk.sum() == 0:
            continue
        e = {}
        for lab, yrs in [("2013-15", [2013, 2014, 2015]), ("MODIS-era 2003-2011", ME_YEARS)]:
            if lab.startswith("MODIS"):
                if ME is None:
                    continue
                Mx = ME[:, msk]
            else:
                iy = pan.yidx(yrs)
                if not iy:
                    continue
                Mx = MM["TA"][iy][:, msk]
            a = np.nansum(k_all[msk][None] * Mx); b = np.nansum(k_pre[msk][None] * Mx)
            e[lab] = round(float(100 * (a / b - 1)), 2) if b > 0 else None
        scale[name] = e
    out["drift_contaminated"] = {"fit_years": allov, "loyo_training_years": mc,
                                 "loyo_pre_drift_for_comparison": {k: out["loyo_bridge"][k] for k in mc},
                                 "k_all_vs_k_pre_scale_pct": scale}
    log("drift contaminated global", mc["global"], scale.get("global"))

for _n in ["pb", "pg", "pf", "pt", "pc", "p_", "o_", "predN", "obsN", "J1s", "Ns"]:
    globals().pop(_n, None)
gc.collect()
# ---------------------------------------------------------------- 8. drift seam R(y) (all loaded years)
kp_years = [y for y in (Y["production_fit"] if FINAL else train_years) if y in pan.years]
out["drift_seam_k_years"] = kp_years
Vc, Mc = sums("TA", kp_years); k_pre = k_from_sums(pan, Vc, Mc, tau)
VO = viirs_V(pan, r_fit, pan.use_min); MO = M_of(pan, "TA", pan.use_min)
seam = {}
for name, msk in REG.items():
    if msk.sum() == 0:
        continue
    ry = {}
    for iy, y in enumerate(pan.years):
        if y < 2012:
            continue
        ok = ~np.isnan(VO[iy, 0, :]) & ~np.isnan(MO[iy, 0, :])
        v = VO[iy][msk][:, ok].sum(); p = (k_pre[msk][:, ok] * MO[iy][msk][:, ok]).sum()
        if v > 0:
            ry[y] = p / v
    base = [ry[y] for y in train_years if y in ry]
    post = [ry[y] for y in [2023, 2024, 2025] if y in ry]
    seam[name] = {"R_by_year": {str(k): round(float(v), 4) for k, v in ry.items()},
                  "seam_2023_25_vs_training": round(float(np.mean(post) / np.mean(base)), 4) if base and post else None}
out["drift_seam"] = seam

# ---------------------------------------------------------------- 9. seam 2012 (needs 2009-11)
if ME is not None and all(y in ME_YEARS for y in [2009, 2010, 2011]) and all(y in pan.years for y in [2013, 2014, 2015]):
    NO = pan.scaled("N", pan.use_min)
    s12 = {}
    # harmonized series via the shipped rule (k_pre on TA; V when usable)
    for name, msk in REG.items():
        if msk.sum() == 0:
            continue
        def ann(X, yrs):
            return np.mean([np.nansum(X[pan.yidx([y])[0]][msk]) for y in yrs])
        pre_i = [ME_YEARS.index(y) for y in [2009, 2010, 2011]]
        raw_pre = np.mean([np.nansum(ME[i][msk]) for i in pre_i])
        harm_pre = np.mean([np.nansum(k_pre[msk] * ME[i][msk]) for i in pre_i])
        raw_post = ann(NO, [2013, 2014, 2015])
        modis_post = ann(MO, [2013, 2014, 2015])
        harm_post = ann(VO, [2013, 2014, 2015])
        s12[name] = {"raw_jump": round(raw_post / raw_pre, 3) if raw_pre else None,
                     "harm_jump": round(harm_post / harm_pre, 3) if harm_pre else None,
                     "modis_only_jump": round(modis_post / raw_pre, 3) if raw_pre else None}
    out["seam_2012"] = s12
else:
    out["seam_2012"] = "input has no 2009-2011 data"

# ---------------------------------------------------------------- 10. FINAL: locked years
if FINAL:
    lk = [y for y in LOCKED if y in pan.years]
    obs_lk = obs_TA
    Vc, Mc = sums("TA", train_years); kc = k_from_sums(pan, Vc, Mc, tau)
    pl = np.full_like(V, np.nan)
    for y in lk:
        iy = pan.yidx([y])[0]; pl[iy] = kc * MM["TA"][iy]
    pl = masked(pl, MM["TA"], V)
    out["locked_bridge"] = evaluate(pl, obs_lk, lk)
    out["locked_bridge_tile"] = tile_metric(pl, obs_lk, lk)
    if not args.skip_gbm:
        g = fit_gbm(cfg, pan, train_years, V, seed=99)
        pg = masked(predict_gbm(pan, g, lk, V), MM["TA"], V)
        out["locked_gbm"] = evaluate(pg, obs_lk, lk)
        out["locked_gbm_tile"] = tile_metric(pg, obs_lk, lk)
    # also raw MODIS (no harmonization, k=global mean pre-drift) as a naive baseline
    out["model_choice"] = TR["model_choice"]
    log("LOCKED bridge", out["locked_bridge"]["global"], out["locked_bridge_tile"])
    if "locked_gbm" in out:
        log("LOCKED gbm", out["locked_gbm"]["global"], out["locked_gbm_tile"])

out["decisions"] = {"tau": tau, "tau_b": tau_b, "chosen_model": out["model_choice"]["chosen"]}
out["runtime_sec"] = round(time.time() - t0)
fn = f"{OUT}/{'final' if FINAL else 'train'}_{args.input}{VTAG}.json"
atomic_json(fn, out, indent=1, default=float)
log("wrote", fn)
