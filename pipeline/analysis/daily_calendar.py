"""Daily view for the burning calendar (Punjab + Haryana preset) -> public/data/daily/punjab.json

The monthly calendar is harmonized per month; the day view spreads each month's harmonized value over its days in
proportion to that month's observed daily pattern from the satellite family the month comes from: S-NPP VIIRS
(2012 onward) or Terra + Aqua MODIS (before). Unit: daytime active 0.05-degree cell-days (FIRMS type 0) per day.
Days on which every satellite of that family had an outage (common.outage_table) are stored as null, never as zero.
Local daily detections exist for India only (FIRMS India country files), so the day view covers this preset.
"""
import os, sys, json, datetime as dt
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import pandas as pd
from common import *

BOX = [27.6, 73.8, 32.6, 77.6]  # south, west, north, east (same as the app preset)
OUTF = sys.argv[1] if len(sys.argv) > 1 else "public/data/daily/punjab.json"
d = load_det(["platform", "latitude", "longitude", "local_solar_date", "daynight", "type", "cell005_lat", "cell005_lon", "year"],
             filters=[("type", "=", 0), ("latitude", ">=", BOX[0]), ("latitude", "<", BOX[2]), ("longitude", ">=", BOX[1]), ("longitude", "<", BOX[3])])
d = d[d.daynight == "D"].copy(); d["platform"] = d.platform.astype(str)
cd = d.drop_duplicates(["platform", "cell005_lat", "cell005_lon", "local_solar_date"])
cnt = cd.groupby(["platform", "local_solar_date"]).size()
O = outage_table(); miss = set(zip(O[O.missing].platform, O[O.missing].date))
years = list(range(2003, 2026)); out = {}
for y in years:
    days = pd.date_range(f"{y}-01-01", f"{y}-12-31")
    def series(plats):
        vals = []
        for day in days:
            if all((p, day) in miss for p in plats): vals.append(None); continue  # missing only when every satellite of the family is out
            vals.append(int(sum(cnt.get((p, day), 0) for p in plats)))
        return vals
    out[str(y)] = {"viirs": series(["SNPP"]) if y >= 2012 else None, "modis": series(["Terra", "Aqua"])}
doc = {"preset": "punjab", "box": BOX, "years": years, "unit": "daytime active 0.05° cell-days per day (FIRMS type 0)",
       "method": "Each month's harmonized value is spread over its days in proportion to the observed daily cell-days of the month's source family (VIIRS S-NPP from 2012, Terra + Aqua MODIS before). Outage days are null.",
       "generated_utc": dt.datetime.now(dt.timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"), "script": "pipeline/analysis/daily_calendar.py", "series": out}
json.dump(doc, open(OUTF, "w"), separators=(",", ":"))
print(os.path.getsize(OUTF), sum(1 for y in out for v in (out[y]["viirs"] or []) if v is None))
