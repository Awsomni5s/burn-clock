"""Shared constants and helpers for the Burn Clock archive pipeline.

Everything that defines a number in public/data/ is in this file or in the
scripts that import it. No number is typed in by hand.
"""
import datetime as dt
import json
import os
import tempfile

ROOT = "/home/claude/burnclock"
PIPE = f"{ROOT}/pipeline"
OUT = f"{PIPE}/out"                          # manifests, logs
STAGE1 = f"{ROOT}/data/processed/celldays"    # per year-product 0.05 deg cell-day tables (stage 1)
PARTS = f"{ROOT}/data/processed/pipeline_parts"  # per year-product monthly aggregates (stage 2)
PROC = f"{ROOT}/data/processed"
PUBLIC = os.environ.get("BC_PUBLIC_DIR", f"{ROOT}/public/data")  # override only for test runs
TMPZIP = f"{ROOT}/data/raw/archive_tmp"       # zips live here only while being processed
LOCK = f"{ROOT}/cpu.lock"
FIRMS_URL = "https://firms.modaps.eosdis.nasa.gov/data/country/zips/{product}_{year}_all_countries.zip"

# Product -> years to try. NOAA-21 names are probes (FIRMS listing has none).
PRODUCT_YEARS = {
    "modis": range(2000, 2026),
    "viirs-snpp": range(2012, 2026),
    "viirs-jpss1": range(2018, 2026),
    "viirs-jpss2": range(2023, 2026),
    "viirs-noaa21": range(2023, 2026),
}
PLATFORMS = ["T", "A", "N", "J1", "J2"]
PLAT_CODE = {p: i for i, p in enumerate(PLATFORMS)}       # T=0 A=1 N=2 J1=3 J2=4
VIIRS_PRODUCT_PLAT = {"viirs-snpp": "N", "viirs-jpss1": "J1", "viirs-jpss2": "J2", "viirs-noaa21": "J2"}
PLAT_PRODUCT = {"T": "modis", "A": "modis", "N": "viirs-snpp", "J1": "viirs-jpss1", "J2": "viirs-jpss2"}

# Grid: 0.05 deg cells, id = i*7200 + j with i = floor((lat+90)/0.05), j = floor((lon+180)/0.05).
NI, NJ = 3600, 7200
EPOCH = dt.date(2000, 1, 1)                   # ldate = days since this date (local solar date)
EPOCH_UNIX_DAYS = (EPOCH - dt.date(1970, 1, 1)).days

MONTH_FIRST = "2000-11"
MONTH_LAST = "2025-12"
OUTAGE_FRAC = 0.20       # platform-day is missing if global count < 20% of centred 31-day median
OUTAGE_WINDOW = 31
MONTH_NULL_FRAC = 0.30   # month is null for a platform if > 30% of its days are missing


def month_list(first=MONTH_FIRST, last=MONTH_LAST):
    y, m = map(int, first.split("-"))
    ly, lm = map(int, last.split("-"))
    out = []
    while (y, m) <= (ly, lm):
        out.append(f"{y:04d}-{m:02d}")
        m += 1
        if m == 13:
            y, m = y + 1, 1
    return out


def ldate_to_date(d):
    return EPOCH + dt.timedelta(days=int(d))


def write_json_atomic(path, obj, **kw):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    fd, tmp = tempfile.mkstemp(dir=os.path.dirname(path), suffix=".tmp")
    with os.fdopen(fd, "w") as fh:
        json.dump(obj, fh, **kw)
    os.chmod(tmp, 0o644)
    os.replace(tmp, path)


def utcnow():
    return dt.datetime.now(dt.timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
