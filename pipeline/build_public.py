"""Stage 3: intermediate tables -> public/data/ files of DATA_CONTRACT.md (v1).

usage: python3 -I pipeline/build_public.py [--skip-tiles] [--skip-clock]

Writes
  public/data/manifest.json      totals (all rows read), platforms, months, tiles, sources, outage months
  public/data/tiles/<tile>.json  0.25 deg calendar: raw DAYTIME active cell-days per platform per month
                                 (null = platform not flying, or > 30% of the month's days outage-masked;
                                  otherwise the count is NOT rescaled). harm/harm_lo/harm_hi/src are left
                                 empty for the harmonization step.
  public/data/clock/<tile>.json  1 deg satellite clock, 2013-2025, fire season = top-3 calendar months of
                                 S-NPP daytime cell-days 2013-2019 (held fixed). Counts use only local
                                 dates on which none of Terra, Aqua, S-NPP is outage-masked, so the
                                 platform ratios used by the AOI badge are not biased by outages.
"""
import glob
import hashlib
import json
import os
import shutil
import sys
import time

import numpy as np
import pandas as pd

sys.path.insert(0, "/home/claude/burnclock/pipeline")
from common import (EPOCH, MONTH_NULL_FRAC, NJ, OUT, PIPE, PLATFORMS, PROC, PUBLIC, STAGE1,
                    month_list, utcnow, write_json_atomic)
from build_intermediate import EPOCH64, group_median, load_year

MONTHS = month_list()
MIDX = {m: k for k, m in enumerate(MONTHS)}
CLOCK_YEARS = list(range(2013, 2026))
CLOCK_PLATS = ["T", "A", "N", "J1"]
SEASON_YEARS = range(2013, 2020)
MIN_VALID_SEASON_FRAC = 1 - MONTH_NULL_FRAC     # clock year is null if < 70% of season days usable


def tile_name(tlat, tlon):
    return f"{'p' if tlat >= 0 else 'm'}{abs(tlat):02d}_{'p' if tlon >= 0 else 'm'}{abs(tlon):03d}"


def pipeline_hash():
    h = hashlib.sha256()
    for f in sorted(glob.glob(f"{PIPE}/*.py")):
        h.update(open(f, "rb").read())
    return h.hexdigest()[:16]


def platform_month_null(outage):
    """bool [platform][month index]: True where the tile value must be null."""
    null = {}
    masked = {(m["platform"], m["month"]) for m in outage["months"] if m["masked"]}
    for p in PLATFORMS:
        info = outage["platforms"].get(p)
        arr = np.ones(len(MONTHS), bool)
        if info:
            for k, m in enumerate(MONTHS):
                arr[k] = not (info["first_month"] <= m <= info["last_month"]) or (p, m) in masked
        null[p] = arr
    return null


def rows_json(mat, nullmask):
    """JSON arrays for all cells of one platform: ints, null in masked months."""
    s = mat.astype("U7")
    s[:, nullmask] = "null"
    return ",".join("[" + ",".join(r) + "]" for r in s)


def load_q25():
    """q25_month as plain numpy arrays (memory-light: ~20 bytes/row)."""
    import pyarrow.parquet as pq
    t = pq.read_table(f"{PROC}/q25_month.parquet", columns=["lat25", "lon25", "ym", "plat", "dn", "cell_days"])
    def codes(col, mapping):
        ch = t[col].combine_chunks()
        lut = np.array([mapping.get(str(x), -1) for x in ch.dictionary.to_pylist()])  # unused dictionary entries -> -1
        return lut[ch.indices.to_numpy()]
    q = {"ci": np.rint((t["lat25"].to_numpy() + 90) / 0.25).astype(np.int32),
         "cj": np.rint((t["lon25"].to_numpy() + 180) / 0.25).astype(np.int32),
         "midx": codes("ym", MIDX).astype(np.int16),
         "plat": codes("plat", {p: k for k, p in enumerate(PLATFORMS)}).astype(np.int8),
         "dn": codes("dn", {"D": 1, "N": 0}).astype(np.int8),
         "cd": t["cell_days"].to_numpy()}
    del t
    return q


def build_tiles(q, null, avail):
    """Write one JSON per 5 deg tile. Returns {tile: ncells} and total bytes."""
    os.makedirs(f"{PUBLIC}/tiles", exist_ok=True)
    for f in glob.glob(f"{PUBLIC}/tiles/*.json"):
        os.remove(f)
    tkey = (q["ci"] // 20).astype(np.int32) * 100 + (q["cj"] // 20)
    order = np.argsort(tkey, kind="stable")
    tk = tkey[order]
    bounds = np.flatnonzero(np.diff(tk)) + 1
    starts, ends = np.concatenate([[0], bounds]), np.concatenate([bounds, [len(tk)]])
    out, nbytes = {}, 0
    for a, b in zip(starts, ends):
        idx = order[a:b]
        ti, tj = tk[a] // 100, tk[a] % 100
        cid = q["ci"][idx].astype(np.int64) * NJ + q["cj"][idx]
        cells, cpos = np.unique(cid, return_inverse=True)        # cells with >= 1 detection ever
        tlat, tlon = int(ti * 5 - 90), int(tj * 5 - 180)
        name = tile_name(tlat, tlon)
        parts = [f'{{"tile":"{name}","cells":[' +
                 ",".join(f"[{(c // NJ) * 0.25 - 90:.2f},{(c % NJ) * 0.25 - 180:.2f}]" for c in cells) + '],"raw":{']
        isday = q["dn"][idx] == 1
        plat = q["plat"][idx]
        praw = []
        for p in PLATFORMS:
            if p not in avail:
                praw.append(f'"{p}":[]')
                continue
            mat = np.zeros((len(cells), len(MONTHS)), np.int64)
            m = isday & (plat == PLATFORMS.index(p))
            mat[cpos[m], q["midx"][idx][m]] = q["cd"][idx][m]
            praw.append(f'"{p}":[' + rows_json(mat, null[p]) + "]")
        parts.append(",".join(praw) + '},"harm":[],"harm_lo":[],"harm_hi":[],"src":[]}')
        txt = "".join(parts)
        with open(f"{PUBLIC}/tiles/{name}.json", "w") as fh:
            fh.write(txt)
        nbytes += len(txt)
        out[name] = len(cells)
    return out, nbytes


def season_months(c1):
    """1 deg cell id -> top-3 calendar months of S-NPP daytime cell-days 2013-2019."""
    s = c1[(c1.plat == "N") & (c1.dn == "D")].copy()
    s["ym"] = s.ym.astype(str)
    s = s[s.ym.str[:4].astype(int).isin(SEASON_YEARS)]
    s["cid"] = ((s.lat1 + 90).round().astype(int)) * 360 + (s.lon1 + 180).round().astype(int)
    s["mon"] = s.ym.str[5:7].astype(int)
    tot = s.groupby(["cid", "mon"]).cell_days.sum().unstack(fill_value=0).reindex(columns=range(1, 13), fill_value=0)
    tot = tot[tot.sum(axis=1) > 0]
    vals = tot.values
    # stable sort: higher count first, ties -> earlier month
    order = np.argsort(-vals, axis=1, kind="stable")[:, :3] + 1
    return dict(zip(tot.index.values, order.tolist()))


def build_clock(c1, outage, avail):
    seasons = season_months(c1)
    cids = np.array(sorted(seasons))
    cpos = {c: k for k, c in enumerate(cids)}
    smask = np.zeros((180 * 360, 13), bool)                       # cell x calendar month in season
    for c, ms in seasons.items():
        smask[c, ms] = True
    # common-valid local dates: none of T, A, N outage-masked (UTC-day mask applied to the local date)
    bad = set()
    for p in ("T", "A", "N"):
        bad |= set(outage["platforms"].get(p, {}).get("missing_days", []))
    j1miss = set(outage["platforms"].get("J1", {}).get("missing_days", []))
    j1first = outage["platforms"].get("J1", {}).get("first_day", "9999")
    ny, nc = len(CLOCK_YEARS), len(cids)
    res = {k: {p: np.full((nc, ny), np.nan) for p in CLOCK_PLATS} for k in ("day", "night", "look")}
    for yk, y in enumerate(CLOCK_YEARS):
        dates = np.arange(np.datetime64(f"{y}-01-01"), np.datetime64(f"{y + 1}-01-01"))
        dstr = dates.astype(str)
        valid = np.array([d not in bad for d in dstr])
        j1ok = np.array([(d not in j1miss) and d >= j1first for d in dstr])
        mon = dates.astype("datetime64[M]").astype(int) % 12 + 1
        # per cell: fraction of season days usable (common mask), and for J1 its own availability
        ndays_m = np.bincount(mon, minlength=13)
        nvalid_m = np.bincount(mon, weights=valid, minlength=13)
        nj1_m = np.bincount(mon, weights=valid & j1ok, minlength=13)
        sm = smask[cids]
        frac = (sm * nvalid_m).sum(1) / (sm * ndays_m).sum(1)
        fracj1 = (sm * nj1_m).sum(1) / (sm * ndays_m).sum(1)
        lo = int((np.datetime64(f"{y}-01-01") - EPOCH64).astype(int))
        for product, plats in (("modis", ("T", "A")), ("viirs-snpp", ("N",)), ("viirs-jpss1", ("J1",))):
            if not os.path.exists(f"{STAGE1}/celldays_{product}_{y}.parquet"):
                continue
            d, _ = load_year(product, y)
            for p in plats:
                if p not in avail:
                    continue
                code = PLATFORMS.index(p)
                ld = d["ldate"].astype(np.int64) - lo
                m = (d["plat"] == code) & (ld >= 0) & (ld < len(dates))
                m &= valid[np.clip(ld, 0, len(dates) - 1)]
                cell = d["cell"][m]
                c1 = (cell // NJ // 20).astype(np.int64) * 360 + (cell % NJ // 20)
                mm = mon[ld[m]]
                ins = smask[c1, mm]            # only season months of cells that have a season
                c1, dn, lst = c1[ins], d["dn"][m][ins], d["lst"][m][ins]
                k = np.searchsorted(cids, c1)
                for flag, key in ((1, "day"), (0, "night")):
                    cnt = np.bincount(k[dn == flag], minlength=nc).astype(float)
                    res[key][p][:, yk] = cnt
                kd = k[dn == 1]
                if len(kd):
                    uk, inv = np.unique(kd, return_inverse=True)
                    med = group_median(inv, lst[dn == 1].astype(np.float64), len(uk))
                    res["look"][p][uk, yk] = med
                okfrac = fracj1 if p == "J1" else frac
                for key in ("day", "night", "look"):
                    res[key][p][okfrac < MIN_VALID_SEASON_FRAC, yk] = np.nan
        print(f"clock {y} done", flush=True)
    # write per tile
    os.makedirs(f"{PUBLIC}/clock", exist_ok=True)
    for f in glob.glob(f"{PUBLIC}/clock/*.json"):
        os.remove(f)
    lat = cids // 360 - 90
    lon = cids % 360 - 180
    tiles = {}
    for k in range(nc):
        tiles.setdefault(tile_name(int(lat[k] // 5 * 5), int(lon[k] // 5 * 5)), []).append(k)

    def arr(x, nd):
        return [None if np.isnan(v) else (round(float(v), nd) if nd else int(v)) for v in x]
    nbytes = 0
    for name, ks in sorted(tiles.items()):
        obj = {"tile": name, "cells": [[int(lat[k]), int(lon[k])] for k in ks], "years": CLOCK_YEARS,
               "season_months": [seasons[cids[k]] for k in ks],
               "look": {p: [arr(res["look"][p][k], 2) for k in ks] for p in CLOCK_PLATS},
               "day": {p: [arr(res["day"][p][k], 0) for k in ks] for p in CLOCK_PLATS},
               "night": {p: [arr(res["night"][p][k], 0) for k in ks] for p in CLOCK_PLATS}}
        txt = json.dumps(obj, separators=(",", ":"))
        with open(f"{PUBLIC}/clock/{name}.json", "w") as fh:
            fh.write(txt)
        nbytes += len(txt)
    return {n: len(ks) for n, ks in tiles.items()}, nbytes


def main():
    t0 = time.time()
    os.makedirs(PUBLIC, exist_ok=True)
    outage = json.load(open(f"{PROC}/outage_days.json"))
    avail = [p for p in PLATFORMS if p in outage["platforms"]]
    null = platform_month_null(outage)

    q = load_q25()
    day = q["dn"] == 1
    acd = {p: int(q["cd"][day & (q["plat"] == k)].sum()) for k, p in enumerate(PLATFORMS)}
    acd_n = int(q["cd"][~day].sum())
    del day

    tiles_info, tiles_bytes = ({}, 0)
    if "--skip-tiles" not in sys.argv:
        tiles_info, tiles_bytes = build_tiles(q, null, avail)
        print(f"tiles: {len(tiles_info)} files, {sum(tiles_info.values())} cells, {tiles_bytes/1e6:.1f} MB", flush=True)
    else:
        tiles_info = {os.path.basename(f)[:-5]: None for f in glob.glob(f"{PUBLIC}/tiles/*.json")}
    del q

    clock_info, clock_bytes = ({}, 0)
    if "--skip-clock" not in sys.argv:
        c1 = pd.read_parquet(f"{PROC}/c1_year_month.parquet", columns=["lat1", "lon1", "ym", "plat", "dn", "cell_days"])
        clock_info, clock_bytes = build_clock(c1, outage, avail)
        print(f"clock: {len(clock_info)} files, {sum(clock_info.values())} cells, {clock_bytes/1e6:.1f} MB", flush=True)

    # ---- manifest
    stats = [json.load(open(f)) for f in sorted(glob.glob(f"{STAGE1}/stats_*.json"))]
    by_plat = {p: 0 for p in PLATFORMS}
    t0p = {p: 0 for p in PLATFORMS}
    unknown = 0
    for s in stats:
        for p, v in s["rows_by_platform"].items():
            if p in by_plat:
                by_plat[p] += v
            else:
                unknown += v
        for p, v in s["type0_by_platform"].items():
            t0p[p] += v
    srcman = json.load(open(f"{OUT}/MANIFEST_SOURCES.json"))["entries"]
    ok = sorted((e for e in srcman.values() if e.get("status") == "OK"), key=lambda e: (e["product"], e["year"]))
    na = sorted((e for e in srcman.values() if e.get("status") != "OK"), key=lambda e: (e["product"], e["year"]))
    manifest = {
        "version": "1", "generated_utc": utcnow(),
        "pipeline_commit": f"nogit-sha256:{pipeline_hash()}",
        "months": MONTHS,
        "platforms": {p: {"first": outage["platforms"][p]["first_month"],
                          "last": min(outage["platforms"][p]["last_month"], MONTHS[-1])} for p in avail},
        "totals": {"detections_processed": sum(s["rows_total"] for s in stats),
                   "by_platform": by_plat,
                   "type0_detections": sum(t0p.values()),
                   "active_cell_days": sum(acd.values()),
                   "type0_by_platform": t0p,
                   "active_cell_days_by_platform": acd,
                   "active_cell_days_night": acd_n,
                   "rows_unknown_platform": unknown,
                   "type0_exact_duplicates_removed": sum(s["type0_exact_duplicates"] for s in stats),
                   "csv_files": sum(s["csv_files"] for s in stats),
                   "archives": len(stats)},
        "tiles": sorted(tiles_info),
        "sources": [{"name": f"FIRMS {e['product']} {e['year']} (all countries)", "url": e["url"],
                     "sha256": e["sha256"], "bytes": e["bytes"], "rows": e["rows"],
                     "fetched_utc": e["fetched_utc"]} for e in ok],
        "sources_unavailable": [{"url": e["url"], "http_status": e.get("http_status"), "status": e["status"],
                                 "checked_utc": e.get("fetched_utc")} for e in na],
        "outage_rule": outage["rule"],
        "outage_months": [{"platform": m["platform"], "month": m["month"], "missing_days": m["missing_days"],
                           "masked": m["masked"]} for m in outage["months"] if m["month"] >= MONTHS[0]],
        "notes": {
            "unit": "active cell-day = 0.05 deg cell with >=1 FIRMS type-0 detection (all confidences) on a "
                    "local-solar day; tiles hold daytime only; active_cell_days counts daytime only",
            "detections_processed": "every row of every country CSV in every archive listed in sources "
                                    "(all types, all confidences, before de-duplication)",
            "J2": "NOAA-21 has no FIRMS yearly country archive (all probed URLs returned 404); raw.J2 is []"
                  if "J2" not in avail else "available",
            "harmonization": "harm, harm_lo, harm_hi, src are empty arrays; the harmonization step fills them",
        },
        "file_bytes": {"tiles": tiles_bytes, "clock": clock_bytes},
    }
    write_json_atomic(f"{PUBLIC}/manifest.json", manifest, separators=(",", ":"))
    print(json.dumps(manifest["totals"], indent=1))
    print(f"stage 3 done in {time.time() - t0:.0f}s")


if __name__ == "__main__":
    main()
