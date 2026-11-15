#!/bin/bash
# Full Burn Clock archive pipeline, in the order that makes partial results useful early.
# Re-runnable: finished year-products are skipped; stage 2 only rebuilds parts whose inputs changed.
#   1) 2013-2025, all products (MODIS, S-NPP, NOAA-20; NOAA-21 probed)  -> stage 1
#   2) stage 2 intermediate parquet (harmonization agent can start here)
#   3) 2000-2012: MODIS + S-NPP 2012                                     -> stage 1 (+ stage 2 every 4 years)
#   4) stage 2 final, stage 3 public/data
set -euo pipefail
cd /home/claude/burnclock
L="flock -w 7200 /home/claude/burnclock/cpu.lock nice -n 10 python3 -I"
python3 -I pipeline/run_archive.py --years 2013-2025 --products viirs-noaa21,viirs-jpss2,modis,viirs-snpp,viirs-jpss1
$L pipeline/build_intermediate.py
python3 -I pipeline/run_archive.py --years 2000-2012 --products modis,viirs-snpp --build --build-every 4
$L pipeline/build_intermediate.py
$L pipeline/build_public.py
echo RUN_ALL_DONE
