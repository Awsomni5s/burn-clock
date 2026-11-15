"""Punjab daily daytime detections by satellite, Oct 1 - Nov 30, 2013-2025 -> public/data/punjab_aqua_daily.json

Same definition as scripts/fetch_punjab_week.py so the live week can be compared with the same calendar days in past
years: FIRMS archive detections with state_iso == IN-PB, daynight == D, all confidence levels, all types.
Aqua now passes later each year; NOAA-20 and S-NPP do not. The Aqua / VIIRS ratio on the same days is the live
version of the app's 'has burning moved later?' check.
"""
import os, sys, json, datetime as dt
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import pandas as pd
from common import *

OUTF = sys.argv[1] if len(sys.argv) > 1 else "public/data/punjab_aqua_daily.json"
d = load_det(["platform", "daynight", "state_iso", "year", "month", "acq_date", "acq_datetime_ist"],
             filters=[("state_iso", "=", "IN-PB"), ("month", "in", [10, 11]), ("year", ">=", 2013)])
d = d[d.daynight == "D"].copy()
d["platform"] = d.platform.astype(str)
d["mmdd"] = pd.to_datetime(d.acq_date).dt.strftime("%m-%d")
DAYS = [x.strftime("%m-%d") for x in pd.date_range("2021-10-01", "2021-11-30")]
c = d.groupby(["platform", "year", "mmdd"]).size()
def series(p, y):
    return [int(c.get((p, y, m), 0)) for m in DAYS]
years = list(range(2013, 2026))
d["h"] = d.acq_datetime_ist.dt.hour + d.acq_datetime_ist.dt.minute / 60
pass_h = {str(y): round(float(d[(d.platform == "Aqua") & (d.year == y) & (d.month == 11)].h.median()), 2) for y in years}
doc = {"region": "Punjab state, India (FIRMS state_iso IN-PB)", "days_mmdd": DAYS,
       "aqua": {str(y): series("Aqua", y) for y in years},
       "snpp": {str(y): series("SNPP", y) for y in years},
       "noaa20": {str(y): series("NOAA20", y) for y in years if y >= 2018},
       "aqua_median_pass_ist_november": pass_h,
       "definition": "FIRMS archive daytime detections, all confidence levels and types, per calendar day (UTC acquisition date).",
       "generated_utc": dt.datetime.now(dt.timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
       "script": "pipeline/analysis/punjab_aqua_daily.py"}
json.dump(doc, open(OUTF, "w"), separators=(",", ":"))
print(pass_h)
