# Burn Clock data pipeline: report (2026-11-14)

## Headline
- **548,501,203 FIRMS rows read**: every row of 10,095 country CSVs in 48 yearly global archives
  (9.75 GB of zips, each streamed, hashed, processed and deleted).
  - Terra MODIS 39,682,127 · Aqua MODIS 71,742,290 · S-NPP VIIRS 281,144,514 · NOAA-20 VIIRS 155,932,272 · NOAA-21 0
  - Type-0 (vegetation fire) rows: 515,029,947. Exact duplicates across country files removed: 226.
  - 229,061,292 active 0.05° cell-days (all platforms, day and night). In the contract range 2000-11 to 2025-12
    there are **192,342,680 daytime active cell-days** (T 18.65 M, A 41.46 M, N 84.66 M, J1 47.57 M) and 36.7 M at night.
- Archives: MODIS 2000–2025 (26), S-NPP 2012–2025 (14), NOAA-20 2018–2025 (8).
- **NOAA-21 is not available.** `viirs-jpss2_{2023,2024,2025}`, `viirs-noaa21_*`, `viirs-noaa-21_*` and
  `viirs-n21_*` all returned HTTP 404, and the FIRMS listing has no NOAA-21 yearly archive. `raw.J2` is `[]`.
- Per-source URL, bytes, sha256 and rows per CSV: `pipeline/out/MANIFEST_SOURCES.json` (the 404 probes are logged too).
  Row counts match the GLOBAL ATLAS branch's independent ingest for every overlapping year (e.g. S-NPP 2019: 20,990,294).

## What ran (order and timing)
| Step | Wall time (UTC) |
|---|---|
| Stage 1, 2013–2025 (MODIS, S-NPP, NOAA-20; NOAA-21 probes) | 21:55 → 22:14 (18 min) |
| Stage 2 intermediate for 2013–2025 (the harmonization agent can start here) | 189 s, done 22:18 |
| Stage 1, 2000–2012 (MODIS, S-NPP 2012), stage 2 every 4 years | 22:18 → 22:30 |
| Stage 2 final | 34 s |
| Stage 3 public/data | 143 s, done 22:33 |

The 48 stage-1 steps took 557 CPU-s in total (1,153 s wall, including waits for the shared lock). Downloads
took 930 s, overlapped with processing because the next zip is prefetched. There were no failures or retries
beyond curl's own. Every heavy step ran as `flock -w 7200 cpu.lock nice -n 10 python3 -I ...`.

## Method (as implemented)
1. **Stage 1** `process_year.py`: pyarrow reads only the needed columns from each country CSV in the zip.
   - It counts all rows, rows per platform and type-0 rows.
   - It drops exact duplicates (same lat/lon to 1e-5°, UTC minute, platform, day/night flag).
   - LST = UTC + lon/15. The local solar date rolls over at local midnight.
   - Cell = 0.05° (integer arithmetic on lat/lon × 1e5, so there are no float-edge errors).
   - Output: unique cell-days (platform × D/N × local date × cell) with n, FRP sum and mean LST. These stay
     on disk in `data/processed/celldays/` (2.1 GB) as the canonical de-duplicated layer.
2. **Stage 2** `build_intermediate.py`:
   - Assigns each year-product the cell-days whose local date falls in that year, including spill-over from
     the neighbouring year files, and de-duplicates them again.
   - Aggregates to 0.25° and 1° × month × platform × D/N.
   - `look_median_lst` = exact median of cell-day LST (night on a 12–36 h axis).
   - Outage mask: a UTC platform-day is missing if its count is below 20% of the centred 31-day median.
     Zero-detection days count as 0, and pre-launch days of the first month count as missing.
3. **Stage 3** `build_public.py`: writes the contract files (see `public/data/README.md` for the exact
   definitions of null, the clock's common-valid-day rule and the season months).

## Outputs
| Path | Size | Rows / files |
|---|---|---|
| `data/processed/q25_month.parquet` | 299 MB | 29,806,656 rows |
| `data/processed/c1_year_month.parquet` | 74 MB | 6,782,019 rows |
| `data/processed/outage_days.json` | — | T 51, A 24, N 65, J1 7 missing days |
| `data/processed/celldays/` | 2.1 GB | 48 cell-day tables + daily counts + stats |
| `public/data/manifest.json` | 38 KB | 302 months, 1,237 tiles, 48 sources, 39 outage months |
| `public/data/tiles/` | 653 MB on disk (682 MB raw JSON), **≈ 35 MB gzipped** | 1,237 files, 191,187 cells, max 1.5 MB/file |
| `public/data/clock/` | 11 MB (9.0 MB JSON) | 887 files, 14,303 1° cells |

Masked (null) platform-months: Terra 2016-02 (9 days) and 2022-10 (13 days); S-NPP 2012-01 (pre-launch,
19 days), 2022-08 (10 days) and 2024-07 (13 days). Months with fewer missing days (e.g. S-NPP 2024-11,
4 days) keep their raw count, and the days are listed in `manifest.outage_months`.

Spot check (Punjab 1° cell 30N 75E, season Nov/Oct/May). Daytime look time 2013 → 2025:
- Terra 10.90 → 9.62 h
- Aqua 13.26 → 14.69 h
- S-NPP 13.10 → 13.11 h

This matches the GLOBAL ATLAS drift.

## Left for others
- `harm`, `harm_lo`, `harm_hi`, `src` are empty arrays in every tile (stated in `public/data/README.md`).
  The harmonization agent fills them from `q25_month.parquet`.
- `world/`, `punjab_receipt.json` and `validation.json` are not produced by this pipeline.

## Caveats
- Tiles are big as raw JSON (contract: one value per month × platform × cell, nulls spelled out). Serve them
  gzip-compressed (about 19× smaller). Avoid committing them to git uncompressed if repo size matters.
- Cell-days whose local date falls outside 2000-11…2025-12 (local 2026-01-01 from UTC 2025-12-31, and local
  2000-10-31) are counted in `detections_processed` but not in the monthly tables.
- The outage mask is defined on UTC days. The clock applies it to the local date with the same label
  (an approximation within ±1 day at the edges).
- LST uses the granule `acq_time`, not the per-pixel scan time.
- `pipeline_commit` is `nogit-sha256:<hash of pipeline/*.py>`, because the project is not a git repo.

## Re-run
`bash pipeline/run_all.sh` (idempotent; finished years are skipped), or:
```
python3 -I pipeline/run_archive.py --years 2013-2025 --products modis,viirs-snpp,viirs-jpss1,viirs-jpss2
python3 -I pipeline/run_archive.py --years 2000-2012 --products modis,viirs-snpp --build
flock -w 7200 cpu.lock nice -n 10 python3 -I pipeline/build_intermediate.py
flock -w 7200 cpu.lock nice -n 10 python3 -I pipeline/build_public.py
```
Peak memory use is about 1.7 GB (stage 3). This environment's shell memory cgroup is about 4 GB.
