"""Punjab GK2A fire pixel-hours by IST hour for every year 2019-2025 (Oct-Nov, confidence >= 2).

Input:  data/processed/gk2a_hourly.parquet, built from Zenodo record 20084790
        (GK2-AMI_FireHotspotsData_{year}_10-11_Punjab_India_v1.txt, CC-BY-4.0, Jethva 2026).
Output: public/data/gk2a_hourly_by_year.json
Same filter as punjab_receipt.py (state == Punjab, conf >= 2); the 2021 and 2025 rows must
equal punjab_receipt.json -> gk2a_by_hour.pixel_hours_2021 / _2025 (checked below).
"""
import json, sys, gzip
import pandas as pd
src = sys.argv[1] if len(sys.argv) > 1 else "data/processed/gk2a_hourly.parquet"
out = sys.argv[2] if len(sys.argv) > 2 else "public/data/gk2a_hourly_by_year.json"
g = pd.read_parquet(src)
g = g[(g.conf >= 2) & (g.state == "Punjab")]
hours = list(range(12, 19))
t = g.groupby(["year", "hour_ist"]).size().unstack(fill_value=0).reindex(columns=hours, fill_value=0)
years = {str(int(y)): [int(v) for v in t.loc[y, hours]] for y in t.index}
rec = json.load(gzip.open("public/data/punjab_receipt.json.gz"))["gk2a_by_hour"]
assert years["2021"] == rec["pixel_hours_2021"] and years["2025"] == rec["pixel_hours_2025"], "mismatch with receipt"
doc = {"hours_ist": hours, "pixel_hours": years, "region": "Punjab state, India", "months": [10, 11], "conf_min": 2,
       "unit": "GK2A fire pixel-hours (one pixel flagged in one hourly image), noon-6 pm India time",
       "source": "Zenodo 20084790, GK2-AMI fire hotspots, Jethva 2026 (doi:10.3390/rs18101506), CC-BY-4.0",
       "limits": "Preliminary product with ~4 km pixels; can flag hot smoke; cloud and outages are not separated; noon-6 pm only.",
       "script": "pipeline/analysis/gk2a_hourly_by_year.py"}
json.dump(doc, open(out, "w"), indent=1)
for y, v in years.items():
    s = sum(v); print(y, s, "1-2pm %.1f%%" % (100 * (v[1] + v[2]) / s), "4pm+ %.1f%%" % (100 * sum(v[4:]) / s))
