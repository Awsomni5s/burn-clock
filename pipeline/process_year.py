"""Stage 1: one FIRMS yearly all-countries zip -> 0.05 deg active cell-days.

usage: python3 -I process_year.py ZIP PRODUCT YEAR

Streams every country CSV straight out of the zip (no extraction) with pyarrow,
reading only the needed columns. For every row it counts totals; for type-0
rows (vegetation fires; FIRMS type 1-3 = volcano / static land / offshore) it
  * removes exact duplicates across country files (same lat, lon, UTC minute, platform),
  * computes local solar time  LST = UTC + lon/15 h  and the local solar date
    (UTC date shifted by -1/0/+1 day when LST rolls over),
  * keys each detection to a 0.05 deg cell, platform, day/night flag and local date,
  * collapses detections into unique cell-days (dedupe across all country CSVs).

Outputs in STAGE1/:
  celldays_{product}_{year}.parquet  plat,dn,ldate,cell,n,frp,lst  (one row per active cell-day)
       plat: 0..4 = T,A,N,J1,J2   dn: 1 day / 0 night   ldate: days since 2000-01-01 (local solar)
       cell: 0.05 deg id = i*7200+j   n: detections   frp: sum MW   lst: mean local solar hour
  daily_{product}_{year}.parquet     plat,udate,n  type-0 detections per platform per UTC day
  stats_{product}_{year}.json        row counts (all rows, per CSV, per platform, type-0, dups)
"""
import io
import json
import sys
import time
import zipfile

import numpy as np
import pyarrow as pa
import pyarrow.compute as pc
import pyarrow.csv as pcsv

sys.path.insert(0, "/home/claude/burnclock/pipeline")
from common import (STAGE1, PLAT_CODE, VIIRS_PRODUCT_PLAT, NJ, NI,
                    EPOCH_UNIX_DAYS, write_json_atomic)

COLS = ["latitude", "longitude", "acq_date", "acq_time", "satellite",
        "daynight", "confidence", "type", "frp"]
TYPES = {"latitude": pa.float64(), "longitude": pa.float64(), "acq_date": pa.date32(),
         "acq_time": pa.int32(), "satellite": pa.string(), "daynight": pa.string(),
         "confidence": pa.string(), "type": pa.int16(), "frp": pa.float64()}
MODIS_SAT = {"Terra": "T", "T": "T", "Aqua": "A", "A": "A"}


def main(zpath, product, year):
    t0 = time.time()
    is_modis = product == "modis"
    st = {"product": product, "year": year, "csv_files": 0, "rows_total": 0,
          "rows_by_platform": {}, "type0_by_platform": {}, "type0_confident_by_platform": {},
          "rows_type_nonzero": 0, "rows_no_type_column": 0, "rows_bad": 0,
          "type0_exact_duplicates": 0, "rows_per_csv": {}}
    # per-row arrays kept for type-0 detections (collected across all CSVs)
    keep = {k: [] for k in ("lat5", "lon5", "umin", "udays", "plat", "dn", "frp")}

    with zipfile.ZipFile(zpath) as z:
        for info in z.infolist():
            if not info.filename.endswith(".csv"):
                continue
            name = info.filename.rsplit("/", 1)[-1]
            with z.open(info) as fh:      # zipfile checks the CRC while reading
                raw = fh.read()
            st["csv_files"] += 1
            if not raw.strip():
                st["rows_per_csv"][name] = 0
                continue
            hdr = raw[:512].split(b"\n", 1)[0].decode().strip().split(",")
            use = [c for c in COLS if c in hdr]
            t = pcsv.read_csv(io.BytesIO(raw), convert_options=pcsv.ConvertOptions(
                include_columns=use, column_types={c: TYPES[c] for c in use}))
            del raw
            n = t.num_rows
            st["rows_per_csv"][name] = n
            st["rows_total"] += n
            if n == 0:
                continue

            # platform per row
            if is_modis:
                sat = t["satellite"]
                plat = np.full(n, -1, np.int8)
                for s_, p_ in MODIS_SAT.items():
                    plat[pc.equal(sat, s_).fill_null(False).to_numpy(zero_copy_only=False)] = PLAT_CODE[p_]
            else:
                plat = np.full(n, PLAT_CODE[VIIRS_PRODUCT_PLAT[product]], np.int8)
            for code in np.unique(plat):
                pname = [k for k, v in PLAT_CODE.items() if v == code][0] if code >= 0 else "unknown"
                st["rows_by_platform"][pname] = st["rows_by_platform"].get(pname, 0) + int((plat == code).sum())

            # type filter (type 0 = presumed vegetation fire)
            if "type" in t.column_names:
                ty = t["type"].fill_null(0).to_numpy()
                t0mask = ty == 0
                st["rows_type_nonzero"] += int((~t0mask).sum())
            else:
                t0mask = np.ones(n, bool)
                st["rows_no_type_column"] += n

            lat = t["latitude"].to_numpy(zero_copy_only=False)
            lon = t["longitude"].to_numpy(zero_copy_only=False)
            at = t["acq_time"].fill_null(-1).to_numpy()
            ud = t["acq_date"].cast(pa.int32()).fill_null(-10**6).to_numpy()
            ok = t0mask & (plat >= 0) & np.isfinite(lat) & np.isfinite(lon) & (at >= 0) & (ud > -10**6)
            st["rows_bad"] += int((t0mask & ~ok).sum())

            dn = pc.equal(t["daynight"], "D").fill_null(False).to_numpy(zero_copy_only=False).astype(np.int8)
            if "confidence" not in t.column_names:
                confident = np.zeros(n, bool)
            elif is_modis:   # MODIS confidence 0-100; >=30 = nominal/high
                c = t["confidence"]
                cnum = pc.if_else(pc.utf8_is_digit(c), c, "-1").cast(pa.int32()).fill_null(-1)
                confident = pc.greater_equal(cnum, 30).to_numpy(zero_copy_only=False)
            else:            # VIIRS l/n/h
                confident = pc.is_in(pc.utf8_lower(t["confidence"]),
                                     value_set=pa.array(["n", "h", "nominal", "high"])).fill_null(False).to_numpy(zero_copy_only=False)
            for code in np.unique(plat[ok]):
                pname = [k for k, v in PLAT_CODE.items() if v == code][0]
                m = ok & (plat == code)
                st["type0_by_platform"][pname] = st["type0_by_platform"].get(pname, 0) + int(m.sum())
                st["type0_confident_by_platform"][pname] = st["type0_confident_by_platform"].get(pname, 0) + int((m & confident).sum())

            frp = t["frp"].fill_null(0).to_numpy() if "frp" in t.column_names else np.zeros(n)
            keep["lat5"].append(np.rint(lat[ok] * 1e5).astype(np.int64))
            keep["lon5"].append(np.rint(lon[ok] * 1e5).astype(np.int64))
            keep["umin"].append(((at[ok] // 100) * 60 + at[ok] % 100).astype(np.int32))
            keep["udays"].append(ud[ok].astype(np.int32))
            keep["plat"].append(plat[ok])
            keep["dn"].append(dn[ok])
            keep["frp"].append(frp[ok].astype(np.float32))

    a = {k: np.concatenate(v) if v else np.zeros(0) for k, v in keep.items()}
    del keep
    t_read = time.time() - t0

    # --- exact duplicates across country CSVs (same point, same UTC minute, same platform)
    k1 = (a["lat5"] + 9_000_000) * 36_000_001 + (a["lon5"] + 18_000_000)
    k2 = ((a["udays"].astype(np.int64) * 1440 + a["umin"]) * 8 + a["plat"]) * 2 + a["dn"]
    order = np.lexsort((k2, k1))
    k1s, k2s = k1[order], k2[order]
    dup_sorted = np.zeros(len(order), bool)
    dup_sorted[1:] = (k1s[1:] == k1s[:-1]) & (k2s[1:] == k2s[:-1])
    st["type0_exact_duplicates"] = int(dup_sorted.sum())
    if dup_sorted.any():
        keepidx = np.sort(order[~dup_sorted])
        a = {k: v[keepidx] for k, v in a.items()}
    del k1, k2, order, k1s, k2s, dup_sorted
    st["type0_unique_detections"] = int(len(a["plat"]))

    # --- cell, local solar time and local solar date
    i = np.clip((a["lat5"] + 9_000_000) // 5000, 0, NI - 1)
    j = np.clip((a["lon5"] + 18_000_000) // 5000, 0, NJ - 1)
    cell = (i * NJ + j).astype(np.int64)
    lmin = a["umin"].astype(np.float64) + a["lon5"] * 4e-5     # lon/15 h = lon*4 min
    doff = np.floor(lmin / 1440.0)
    lst = ((lmin - doff * 1440.0) / 60.0).astype(np.float32)   # [0,24)
    ldate = (a["udays"] - EPOCH_UNIX_DAYS + doff.astype(np.int32)).astype(np.int64)
    key = ((ldate * 2 + a["dn"]) * 8 + a["plat"]) * (1 << 25) + cell

    # --- outage input: type-0 detections per platform per UTC day
    ukey = (a["udays"].astype(np.int64) - EPOCH_UNIX_DAYS) * 8 + a["plat"]
    uu, uc = np.unique(ukey, return_counts=True)
    pa_daily = pa.table({"plat": (uu % 8).astype(np.int8), "udate": (uu // 8).astype(np.int16),
                         "n": uc.astype(np.int32)})

    # --- unique cell-days
    uk, inv, cnt = np.unique(key, return_inverse=True, return_counts=True)
    frp_s = np.bincount(inv, weights=a["frp"], minlength=len(uk))
    lst_s = np.bincount(inv, weights=lst, minlength=len(uk)) / cnt
    cell_u = uk % (1 << 25)
    rest = uk >> 25
    out = pa.table({
        "plat": (rest % 8).astype(np.int8),
        "dn": ((rest // 8) % 2).astype(np.int8),
        "ldate": (rest // 16).astype(np.int16),
        "cell": cell_u.astype(np.int32),
        "n": cnt.astype(np.int32),
        "frp": frp_s.astype(np.float32),
        "lst": lst_s.astype(np.float32),
    })
    import pyarrow.parquet as pq
    pq.write_table(out, f"{STAGE1}/celldays_{product}_{year}.parquet", compression="zstd")
    pq.write_table(pa_daily, f"{STAGE1}/daily_{product}_{year}.parquet")
    st["cell_days"] = int(len(uk))
    st["cell_days_day"] = int((out["dn"].to_numpy() == 1).sum())
    st["udate_range"] = [int(uu.min() // 8), int(uu.max() // 8)] if len(uu) else None
    st["seconds_read"] = round(t_read, 1)
    st["seconds_total"] = round(time.time() - t0, 1)
    write_json_atomic(f"{STAGE1}/stats_{product}_{year}.json", st, indent=1)
    print(json.dumps({k: v for k, v in st.items() if k != "rows_per_csv"}))


if __name__ == "__main__":
    main(sys.argv[1], sys.argv[2], int(sys.argv[3]))
