"""Hot-smoke check for GK2A late-hour detections (red team A3).

For GK2A conf>=2 Punjab pixel-days (2021-2025, Oct-Nov), the share that have >=1 VIIRS (S-NPP or NOAA-20)
FIRMS type-0 detection (any confidence, day or night) within 4 km of the GK2A pixel centre on the same
or next local-solar day. Compared between pixel-days detected at 16-18 IST and at 12-14 IST.
Placebo: the same pixels with the date shifted by +-7 days (background co-location rate in dense fields).
"""
import sys, json
sys.path.insert(0, "/home/claude/burnclock/pipeline/analysis")
import numpy as np, pandas as pd
from scipy.spatial import cKDTree
from common import *

R_KM = 4.0
LAT0 = 30.8
KX, KY = 111.32 * np.cos(np.radians(LAT0)), 110.57

g = pd.read_parquet(GK2A)
g = g[(g.state == "Punjab") & (g.conf >= 2) & (g.year >= 2021)].copy()
g["pix"] = g.lat.round(4).astype(str) + "_" + g.lon.round(4).astype(str)
g["band"] = np.select([g.hour_ist.between(12, 14), g.hour_ist.between(16, 18)], ["early", "late"], "mid")
pdays = g.groupby(["pix", "date"]).agg(lat=("lat", "first"), lon=("lon", "first"), year=("year", "first"),
                                       early=("band", lambda s: (s == "early").any()),
                                       late=("band", lambda s: (s == "late").any()),
                                       pre_late=("hour_ist", lambda s: (s <= 15).any()),
                                       h17=("hour_ist", lambda s: (s == 17).any())).reset_index()

v = load_det(["platform", "latitude", "longitude", "local_solar_date", "local_solar_hour", "daynight", "type", "year", "month"],
             filters=[("type", "=", 0), ("platform", "in", ["SNPP", "NOAA20"]), ("year", ">=", 2021),
                      ("month", "in", [9, 10, 11, 12]), ("latitude", ">=", 29.0), ("latitude", "<=", 33.2),
                      ("longitude", ">=", 73.0), ("longitude", "<=", 77.5)])
v["x"], v["y"] = v.longitude * KX, v.latitude * KY
# timing class relative to a GK2A detection on local day d
by_date = {d: grp for d, grp in v.groupby("local_solar_date")}


def hits(df, shift_days=0):
    """returns DataFrame of booleans: any / same-day day pass / same-day night (pre-dawn) / next-day night / next-day day."""
    res = []
    for d, grp in df.groupby("date"):
        d0 = pd.Timestamp(d) + pd.Timedelta(days=shift_days)
        q = np.c_[grp.lon.values * KX, grp.lat.values * KY]
        flags = {}
        for lab, dd, dn in [("d_day", d0, "D"), ("d_night", d0, "N"),
                            ("d1_night", d0 + pd.Timedelta(days=1), "N"), ("d1_day", d0 + pd.Timedelta(days=1), "D")]:
            pts = by_date.get(dd)
            f = np.zeros(len(grp), bool)
            if pts is not None:
                pts = pts[pts.daynight == dn]
                if len(pts):
                    t = cKDTree(np.c_[pts.x.values, pts.y.values])
                    f = np.array([len(l) > 0 for l in t.query_ball_point(q, R_KM)])
            flags[lab] = f
        r = pd.DataFrame(flags, index=grp.index)
        r["any"] = r.any(axis=1)
        res.append(r)
    return pd.concat(res)


H = pdays.join(hits(pdays))
P = pdays.join(hits(pdays, +7).add_prefix("p7_")).join(hits(pdays, -7).add_prefix("m7_"))
H["placebo_any"] = (P["p7_any"].astype(float) + P["m7_any"].astype(float)) / 2

groups = {
    "late_16_18": H.late,
    "early_12_14": H.early,
    "late_only_16_18_not_12_15": H.late & ~H.pre_late,
    "h17": H.h17,
}
out = {"definition": "share of GK2A conf>=2 Punjab pixel-days (Oct-Nov) with >=1 S-NPP or NOAA-20 type-0 detection within 4 km "
                     "of the pixel centre on the same or next local-solar day (any VIIRS confidence, day or night pass)",
       "placebo": "same pixel, date shifted +7 and -7 days (mean): background co-location rate",
       "years": "2021-2025", "radius_km": R_KM, "groups": {}}
for name, m in groups.items():
    s = H[m]
    row = {"n_pixel_days": int(len(s)), "frac_any": round(float(s["any"].mean()), 4),
           "frac_placebo": round(float(s.placebo_any.mean()), 4),
           "frac_same_day_day_pass": round(float(s.d_day.mean()), 4),
           "frac_next_night_pass": round(float(s.d1_night.mean()), 4),
           "frac_next_day_day_pass": round(float(s.d1_day.mean()), 4),
           "by_year": {}}
    for y, sy in s.groupby("year"):
        row["by_year"][str(int(y))] = {"n": int(len(sy)), "frac_any": round(float(sy["any"].mean()), 4),
                                       "frac_placebo": round(float(sy.placebo_any.mean()), 4),
                                       "frac_next_night_pass": round(float(sy.d1_night.mean()), 4)}
    out["groups"][name] = row
json.dump(out, open(f"{OUT}/hot_smoke.json", "w"), indent=1)
print(json.dumps(out, indent=1))
