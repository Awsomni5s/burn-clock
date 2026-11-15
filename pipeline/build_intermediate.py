"""Stage 2: stage-1 cell-days -> intermediate monthly tables + outage mask.

usage: python3 -I pipeline/build_intermediate.py [--force]

For every year-product with a stage-1 cell-day file:
  * gathers the cell-days whose LOCAL SOLAR date falls in that year: from the year's own file plus the
    spill-over from the neighbouring years' files (a UTC 31 Dec detection can be local 1 Jan, and vice
    versa), and de-duplicates them on (platform, day/night, local date, 0.05 deg cell);
  * aggregates to 0.25 deg x month and 1 deg x month per platform and day/night:
        cell_days        active 0.05 deg cell-days (type-0, all confidences)
        detections       type-0 detections (exact cross-country duplicates removed in stage 1)
        frp_sum          summed FRP (MW)
        look_median_lst  median over the group's cell-days of the cell-day mean local solar hour
                         (night medians taken on a 12-36 h axis, then wrapped to 0-24)
Then concatenates the parts into
  data/processed/q25_month.parquet       [lat25, lon25, ym, plat, dn, cell_days, detections, frp_sum, look_median_lst]
  data/processed/c1_year_month.parquet   [lat1, lon1, ym, plat, dn, ...same fields]
and writes the outage mask data/processed/outage_days.json:
  a platform-day (UTC) is missing if its global type-0 count < 20% of its centred 31-day median
  (days without any detection between the platform's first and last day count as 0).
"""
import glob
import json
import os
import sys
import time

import numpy as np
import pandas as pd
import pyarrow as pa
import pyarrow.dataset as ds
import pyarrow.parquet as pq

sys.path.insert(0, "/home/claude/burnclock/pipeline")
from common import (EPOCH, MONTH_FIRST, MONTH_LAST, MONTH_NULL_FRAC, NJ, OUTAGE_FRAC, OUTAGE_WINDOW,
                    PARTS, PLATFORMS, PROC, STAGE1, utcnow, write_json_atomic)

EPOCH64 = np.datetime64(EPOCH.isoformat(), "D")
LEVELS = {"q25": (5, 0.25), "c1": (20, 1.0)}   # 0.05 deg cells per output cell, output size (deg)


def year_bounds(y):
    a = (np.datetime64(f"{y}-01-01") - EPOCH64).astype(int)
    b = (np.datetime64(f"{y + 1}-01-01") - EPOCH64).astype(int)
    return int(a), int(b)


def load_year(product, y):
    """All cell-days of `product` whose local solar date is in year y (own file + neighbour spill)."""
    lo, hi = year_bounds(y)
    tabs, spill = [], 0
    for yy in (y - 1, y, y + 1):
        f = f"{STAGE1}/celldays_{product}_{yy}.parquet"
        if not os.path.exists(f):
            continue
        t = ds.dataset(f).to_table(filter=(ds.field("ldate") >= lo) & (ds.field("ldate") < hi))
        if yy != y:
            spill += t.num_rows
        tabs.append(t)
    d = {c: np.concatenate([t[c].to_numpy() for t in tabs]) for c in tabs[0].column_names}
    if spill:  # de-duplicate cell-days present in two files
        key = ((d["ldate"].astype(np.int64) * 2 + d["dn"]) * 8 + d["plat"]) * (1 << 25) + d["cell"]
        uk, inv = np.unique(key, return_inverse=True)
        n = np.bincount(inv, weights=d["n"]).astype(np.int64)
        d = {"plat": ((uk >> 25) % 8).astype(np.int8), "dn": ((uk >> 28) % 2).astype(np.int8),
             "ldate": (uk >> 29).astype(np.int16), "cell": (uk % (1 << 25)).astype(np.int32),
             "n": n.astype(np.int32),
             "frp": np.bincount(inv, weights=d["frp"]).astype(np.float32),
             "lst": (np.bincount(inv, weights=d["lst"].astype(np.float64) * d["n"]) / n).astype(np.float32)}
    return d, spill


def group_median(inv, vals, ngroups):
    """Exact median of vals within each group (inv = group index per element)."""
    order = np.lexsort((vals, inv))
    v = vals[order]
    cnt = np.bincount(inv, minlength=ngroups)
    start = np.concatenate([[0], np.cumsum(cnt)[:-1]])
    return (v[start + (cnt - 1) // 2] + v[start + cnt // 2]) / 2.0


def aggregate(d, level):
    f, size = LEVELS[level]
    i, j = d["cell"] // NJ, d["cell"] % NJ
    gi, gj = (i // f).astype(np.int64), (j // f).astype(np.int64)
    ymi = (EPOCH64 + d["ldate"].astype("timedelta64[D]")).astype("datetime64[M]").astype(np.int64)  # months since 1970
    gid = (((ymi * 3600 + gi) * 7200 + gj) * 8 + d["plat"]) * 2 + d["dn"]
    ug, inv, cnt = np.unique(gid, return_inverse=True, return_counts=True)
    lstu = np.where(d["dn"] == 1, d["lst"], np.mod(d["lst"] - 12.0, 24.0) + 12.0).astype(np.float64)
    med = np.mod(group_median(inv, lstu, len(ug)), 24.0)
    dn = ug % 2; r = ug // 2
    plat = r % 8; r //= 8
    gj_ = r % 7200; r //= 7200
    gi_ = r % 3600; ym_ = r // 3600
    return pa.table({
        "lat": (gi_ * size - 90).astype(np.float32), "lon": (gj_ * size - 180).astype(np.float32),
        "ym_idx": ym_.astype(np.int16), "plat": plat.astype(np.int8), "dn": dn.astype(np.int8),
        "cell_days": cnt.astype(np.int32),
        "detections": np.bincount(inv, weights=d["n"]).astype(np.int64),
        "frp_sum": np.bincount(inv, weights=d["frp"]).astype(np.float64),
        "look_median_lst": med.astype(np.float32)})


def build_parts(force=False):
    os.makedirs(PARTS, exist_ok=True)
    info = {}
    for f in sorted(glob.glob(f"{STAGE1}/celldays_*.parquet")):
        product, y = os.path.basename(f)[9:-8].rsplit("_", 1)
        y = int(y)
        ins = [g for g in (f"{STAGE1}/celldays_{product}_{yy}.parquet" for yy in (y - 1, y, y + 1)) if os.path.exists(g)]
        outs = [f"{PARTS}/{lv}_{product}_{y}.parquet" for lv in LEVELS]
        meta = f"{PARTS}/meta_{product}_{y}.json"
        newest_in = max(os.path.getmtime(g) for g in ins)
        if not force and all(os.path.exists(o) for o in outs + [meta]) and \
                min(os.path.getmtime(o) for o in outs + [meta]) > newest_in:
            info[f"{product}_{y}"] = json.load(open(meta))
            continue
        t0 = time.time()
        d, spill = load_year(product, y)
        for lv, o in zip(LEVELS, outs):
            pq.write_table(aggregate(d, lv), o, compression="zstd")
        m = {"cell_days": int(len(d["cell"])), "spill_rows_from_neighbours": int(spill),
             "inputs": [os.path.basename(g) for g in ins], "seconds": round(time.time() - t0, 1)}
        write_json_atomic(meta, m)
        info[f"{product}_{y}"] = m
        print(f"part {product} {y}: {m}", flush=True)
    return info


def concat(level, outname, latname, lonname):
    fs = sorted(glob.glob(f"{PARTS}/{level}_*.parquet"))
    t = pa.concat_tables([pq.read_table(f) for f in fs])
    # string columns as dictionary arrays (indices + small dictionary): cheap in memory
    ymi = t["ym_idx"].to_numpy().astype(np.int64)
    lo_i, hi_i = (int(np.datetime64(MONTH_FIRST, "M").astype(np.int64)), int(np.datetime64(MONTH_LAST, "M").astype(np.int64)))
    keep = (ymi >= lo_i) & (ymi <= hi_i)            # keep only months inside the contract range
    t = t.filter(pa.array(keep))
    ymi = ymi[keep] - lo_i
    labels = pa.array([str(np.datetime64(k + lo_i, "M")) for k in range(hi_i - lo_i + 1)])
    out = pa.table({latname: t["lat"], lonname: t["lon"],
                    "ym": pa.DictionaryArray.from_arrays(pa.array(ymi.astype(np.int16)), labels),
                    "plat": pa.DictionaryArray.from_arrays(t["plat"].combine_chunks(), pa.array(PLATFORMS)),
                    "dn": pa.DictionaryArray.from_arrays(pa.array(1 - t["dn"].to_numpy()), pa.array(["D", "N"])),
                    "cell_days": t["cell_days"], "detections": t["detections"],
                    "frp_sum": t["frp_sum"], "look_median_lst": t["look_median_lst"]})
    tmp = f"{PROC}/{outname}.tmp"
    pq.write_table(out, tmp, compression="zstd", row_group_size=1_000_000)
    os.replace(tmp, f"{PROC}/{outname}")
    print(f"{outname}: {out.num_rows} rows from {len(fs)} parts", flush=True)
    return out.num_rows


def outages():
    fs = sorted(glob.glob(f"{STAGE1}/daily_*.parquet"))
    d = pd.concat([pd.read_parquet(f) for f in fs]).groupby(["plat", "udate"], as_index=False)["n"].sum()
    last_allowed = int((np.datetime64("2026-01-01") - EPOCH64).astype(int)) - 1   # 2025-12-31
    res = {"rule": f"platform-day (UTC date) is missing if its global type-0 detection count < "
                   f"{OUTAGE_FRAC:.0%} of its centred {OUTAGE_WINDOW}-day median; days with no detections "
                   f"between first and last day count as 0; days of the first month before the first "
                   f"detection count as missing (platform not yet flying). A month is null for a platform "
                   f"in the tiles if > {MONTH_NULL_FRAC:.0%} of its days are missing.",
           "generated_utc": utcnow(), "platforms": {}, "months": []}
    for code, g in d.groupby("plat"):
        p = PLATFORMS[code]
        g = g[g.udate <= last_allowed]
        if g.empty:
            continue
        first, last = int(g.udate.min()), int(g.udate.max())
        s = pd.Series(0, index=np.arange(first, last + 1), dtype=float)
        s[g.udate.values] = g.n.values
        med = s.rolling(OUTAGE_WINDOW, center=True, min_periods=1).median()
        miss = s.index[(s < OUTAGE_FRAC * med).values]
        dates = EPOCH64 + np.asarray(miss).astype("timedelta64[D]")
        first_d = EPOCH64 + np.timedelta64(first, "D")
        month_start = first_d.astype("datetime64[M]").astype("datetime64[D]")
        pre = np.arange(month_start, first_d)                      # pre-launch days of the first month
        all_missing = np.concatenate([pre, dates]).astype(str).tolist()
        res["platforms"][p] = {"first_day": str(first_d), "last_day": str(EPOCH64 + np.timedelta64(last, "D")),
                               "first_month": str(first_d.astype("datetime64[M]")),
                               "last_month": str((EPOCH64 + np.timedelta64(last, "D")).astype("datetime64[M]")),
                               "missing_days": all_missing,
                               "daily_counts_min_median_max": [float(s.min()), float(s.median()), float(s.max())]}
        bym = {}
        for x in all_missing:
            bym.setdefault(x[:7], []).append(x)
        for mth, lst in sorted(bym.items()):
            ndays = int(((np.datetime64(mth, "M") + np.timedelta64(1, "M")).astype("datetime64[D]") - np.datetime64(mth, "M").astype("datetime64[D]")).astype(int))
            res["months"].append({"platform": p, "month": mth, "n_days": ndays, "missing_days": lst,
                                  "frac_missing": round(len(lst) / ndays, 4),
                                  "masked": len(lst) / ndays > MONTH_NULL_FRAC})
    write_json_atomic(f"{PROC}/outage_days.json", res, indent=1)
    print("outage months:", sum(1 for m in res["months"]), "masked:", sum(m["masked"] for m in res["months"]))
    return res


def main():
    t0 = time.time()
    info = build_parts(force="--force" in sys.argv)
    n25 = concat("q25", "q25_month.parquet", "lat25", "lon25")
    n1 = concat("c1", "c1_year_month.parquet", "lat1", "lon1")
    outages()
    write_json_atomic(f"{PROC}/intermediate_meta.json", {
        "generated_utc": utcnow(), "parts": info, "q25_rows": n25, "c1_rows": n1,
        "seconds": round(time.time() - t0, 1)}, indent=1)
    print(f"stage 2 done in {time.time() - t0:.0f}s")


if __name__ == "__main__":
    main()
