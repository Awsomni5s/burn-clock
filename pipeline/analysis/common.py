"""Shared loaders + outage mask for Burn Clock analysis scripts.

Outage mask (contract §5 / RECEIPT correction): a platform-day is MISSING if the platform's
daytime FIRMS type-0 detection count over the whole India file (lat >= 20) on that local-solar
date is below 20% of the platform's centred 31-day rolling median of daily counts (zero-filled
calendar, so days with no rows count as 0).
"""
import os
import numpy as np
import pandas as pd
import pyarrow.parquet as pq

ROOT = "/home/claude/burnclock"
DET = f"{ROOT}/data/processed/detections.parquet"
GK2A = f"{ROOT}/data/processed/gk2a_hourly.parquet"
OUT = f"{ROOT}/pipeline/analysis/out"
os.makedirs(OUT, exist_ok=True)

PLAT_LABEL = {"Terra": "Terra MODIS", "Aqua": "Aqua MODIS", "SNPP": "S-NPP VIIRS", "NOAA20": "NOAA-20 VIIRS"}
PLAT_SHORT = {"Terra": "T", "Aqua": "A", "SNPP": "N", "NOAA20": "J1"}
OUTAGE_FRAC, OUTAGE_WIN = 0.20, 31


def load_det(cols, filters=None):
    t = pq.read_table(DET, columns=cols, filters=filters)
    df = t.to_pandas()
    for c in ("platform", "state_iso", "daynight", "confidence_class"):
        if c in df.columns:
            df[c] = df[c].astype("category")
    if "local_solar_date" in df.columns:
        df["local_solar_date"] = pd.to_datetime(df["local_solar_date"])
    return df


def outage_table():
    """Return DataFrame [platform, date, n, med31, missing] for every calendar day in each platform's span."""
    cache = f"{OUT}/outage_platform_days.parquet"
    if os.path.exists(cache):
        return pd.read_parquet(cache)
    d = load_det(["platform", "local_solar_date", "daynight", "type"],
                 filters=[("type", "=", 0), ("daynight", "=", "D")])
    cnt = d.groupby(["platform", "local_solar_date"], observed=True).size().rename("n").reset_index()
    rows = []
    for p, g in cnt.groupby("platform", observed=True):
        s = g.set_index("local_solar_date").n
        idx = pd.date_range(s.index.min(), s.index.max(), freq="D")
        s = s.reindex(idx, fill_value=0)
        med = s.rolling(OUTAGE_WIN, center=True, min_periods=15).median()
        rows.append(pd.DataFrame({"platform": str(p), "date": idx, "n": s.values, "med31": med.values,
                                  "missing": (s.values < OUTAGE_FRAC * med.values)}))
    out = pd.concat(rows, ignore_index=True)
    out.to_parquet(cache, index=False)
    return out


def missing_days(platforms, months=None, years=None):
    """Set of dates (Timestamp) on which ANY of `platforms` is outage-masked (union mask)."""
    o = outage_table()
    o = o[o.platform.isin(platforms) & o.missing]
    if months is not None:
        o = o[o.date.dt.month.isin(months)]
    if years is not None:
        o = o[o.date.dt.year.isin(years)]
    return set(o.date)


def masked_list(platforms, months, years):
    o = outage_table()
    o = o[o.platform.isin(platforms) & o.missing & o.date.dt.month.isin(months) & o.date.dt.year.isin(years)]
    return [{"platform": PLAT_SHORT[r.platform], "date": r.date.strftime("%Y-%m-%d"),
             "india_day_count": int(r.n), "median31": float(r.med31)} for r in o.itertuples()]
