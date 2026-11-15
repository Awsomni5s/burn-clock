"""Punjab districts: when fires burn and what the ~1:40 pm satellites see -> public/data/punjab_districts.json

Inputs
  GK2A   data/processed/gk2a_hourly.parquet (Zenodo 20084790, Jethva 2026, CC-BY-4.0); state == Punjab, conf >= 2,
         hourly images at 12:00 ... 18:00 IST, Oct-Nov 2019-2025.
  VIIRS  data/processed/detections.parquet (NASA FIRMS archive), S-NPP + NOAA-20, state_iso == IN-PB, type 0, daytime,
         Oct-Nov; unit = daytime active 0.05-degree cell-day (same unit as punjab_receipt.py).
  ADM2   geoBoundaries gbOpen IND ADM2 (2021 vintage, ODbL 1.0), release 9469f09, simplified geometry.

Each detection is assigned to the district polygon containing its point (GK2A pixel centre or FIRMS latitude/longitude).
Daily series (Oct 1 - Nov 30, 61 days) are stored per district and year so the app can apply the same outage mask as
punjab_receipt.py's base-year fan: calendar days on which S-NPP or NOAA-20 is outage-masked (common.outage_table) in
EITHER compared year are removed from both years. Hourly pixel-hours are unmasked (used for within-year shares).
"""
import sys, json, datetime as dt
sys.path.insert(0, __import__("os").path.dirname(__import__("os").path.abspath(__file__)))
import numpy as np, pandas as pd
from shapely.geometry import shape, Point, mapping
from shapely import STRtree
from common import *

YEARS = list(range(2019, 2026)); HOURS = list(range(12, 19)); MONTHS = [10, 11]
BND = f"{ROOT}/data/raw/boundaries"
OUTF = sys.argv[1] if len(sys.argv) > 1 else "public/data/punjab_districts.json"

a1 = json.load(open(f"{BND}/geoBoundaries-IND-ADM1_simplified.geojson"))
a2 = json.load(open(f"{BND}/geoBoundaries-IND-ADM2_simplified.geojson"))
pb = [shape(f["geometry"]) for f in a1["features"] if f["properties"]["shapeName"] == "Punjab"][0]
feats = [f for f in a2["features"] if shape(f["geometry"]).representative_point().within(pb)]
names = [f["properties"]["shapeName"] for f in feats]
geoms = [shape(f["geometry"]) for f in feats]
tree = STRtree(geoms)
assert len(names) == 22, names


def assign(lon, lat):
    out = np.full(len(lon), -1, dtype=int)
    pts = [Point(x, y) for x, y in zip(lon, lat)]
    src, dst = tree.query(pts, predicate="within")
    out[src] = dst
    return out


DAYS = [d.strftime("%m-%d") for d in pd.date_range("2021-10-01", "2021-11-30")]
O = outage_table()
O = O[O.missing & O.platform.isin(["SNPP", "NOAA20"]) & O.date.dt.month.isin(MONTHS) & O.date.dt.year.isin(YEARS)]
OUTAGE = {str(y): sorted(set(O[O.date.dt.year == y].date.dt.strftime("%m-%d"))) for y in YEARS}

# GK2A
g = pd.read_parquet(GK2A)
g = g[(g.state == "Punjab") & (g.conf >= 2) & g.year.isin(YEARS)].copy()
g["d"] = assign(g.lon.values, g.lat.values)
g["mmdd"] = g.date.dt.strftime("%m-%d")
gk_unassigned = {str(y): int(((g.d < 0) & (g.year == y)).sum()) for y in YEARS}
gph = g[g.d >= 0].groupby(["d", "year", "hour_ist"]).size()
gpd_ = g[g.d >= 0].drop_duplicates(["d", "date", "lon", "lat"]).groupby(["d", "year", "mmdd"]).size()

# VIIRS
v = load_det(["platform", "latitude", "longitude", "local_solar_date", "daynight", "type", "state_iso",
              "cell005_lat", "cell005_lon", "year", "month"],
             filters=[("state_iso", "=", "IN-PB"), ("type", "=", 0), ("month", "in", MONTHS), ("year", ">=", 2019)])
v = v[(v.daynight == "D") & v.platform.astype(str).isin(["SNPP", "NOAA20"]) & v.year.isin(YEARS)].copy()
v["platform"] = v.platform.astype(str)
v["d"] = assign(v.longitude.values, v.latitude.values)
v["mmdd"] = v.local_solar_date.dt.strftime("%m-%d")
v = v[v.d >= 0]
vcd = v.drop_duplicates(["platform", "d", "cell005_lat", "cell005_lon", "local_solar_date"]).groupby(["platform", "d", "year", "mmdd"]).size()


def get(s, *k):
    try:
        return int(s.loc[k])
    except KeyError:
        return 0


districts = []
for i, (n, geom) in enumerate(zip(names, geoms)):
    simp = geom.simplify(0.01, preserve_topology=True)
    gj = mapping(simp)
    def rnd(c):
        return [rnd(x) for x in c] if isinstance(c[0], (list, tuple)) else [round(c[0], 3), round(c[1], 3)]
    gj = {"type": gj["type"], "coordinates": rnd(gj["coordinates"])}
    districts.append({
        "name": n,
        "gk2a_pixel_hours": {str(y): [get(gph, i, y, h) for h in HOURS] for y in YEARS},
        "gk2a_pixel_days": {str(y): [get(gpd_, i, y, m) for m in DAYS] for y in YEARS},
        "snpp_celldays": {str(y): [get(vcd, "SNPP", i, y, m) for m in DAYS] for y in YEARS},
        "noaa20_celldays": {str(y): [get(vcd, "NOAA20", i, y, m) for m in DAYS] for y in YEARS},
        "geometry": gj})

# state check: sum of district pixel-hours + unassigned == state totals in gk2a_hourly_by_year.json
state = json.load(open("public/data/gk2a_hourly_by_year.json"))["pixel_hours"]
for y in YEARS:
    tot = sum(sum(d["gk2a_pixel_hours"][str(y)]) for d in districts) + gk_unassigned[str(y)]
    assert tot == sum(state[str(y)]), (y, tot, sum(state[str(y)]))

doc = {
    "region": "Punjab, India — 22 districts (geoBoundaries 2021 boundaries)", "months": MONTHS, "years": YEARS,
    "hours_ist": HOURS,
    "units": {"gk2a_pixel_hours": "GK2A fire pixels (conf ≥ 2) flagged in the hourly image at each India-time hour",
              "gk2a_pixel_days": "GK2A fire pixels counted once per day (conf ≥ 2, noon–6 pm images); one value per day, Oct 1–Nov 30",
              "snpp_celldays": "S-NPP VIIRS daytime active 0.05° cell-days (FIRMS type 0); one value per day, Oct 1–Nov 30",
              "noaa20_celldays": "NOAA-20 VIIRS daytime active 0.05° cell-days (FIRMS type 0); one value per day, Oct 1–Nov 30"},
    "polar_pass_ist": {"S-NPP": "about 1:40 pm", "NOAA-20": "about 1:40 pm", "note": "Medians from punjab_receipt.json → by_clock (2025)."},
    "days_mmdd": DAYS,
    "outage_mmdd": OUTAGE,
    "outage_rule": "Days on which S-NPP or NOAA-20 recorded under 20% of its centred 31-day median India daytime count (pipeline/analysis/common.py). A comparison drops the outage days of both compared years.",
    "gk2a_unassigned_pixel_hours": gk_unassigned,
    "assignment": "Point in polygon: GK2A pixel centre or FIRMS detection latitude/longitude. GK2A pixels are about 4 km wide, so fires near a district border can be assigned to the neighbour.",
    "sources": {"gk2a": "Zenodo 20084790, GK2-AMI fire hotspots, Jethva 2026 (doi:10.3390/rs18101506), CC-BY-4.0",
                "viirs": "NASA FIRMS archive, S-NPP VNP14IMG and NOAA-20 VJ114IMG",
                "boundaries": "geoBoundaries gbOpen IND ADM2, release 9469f09 (source: lgdirectory.gov.in via Pathways), ODbL 1.0"},
    "limits": "GK2A is a preliminary product with ~4 km pixels; it misses small fires, can flag hot smoke and cannot separate cloud from no fire. Only the noon–6 pm images are used. A pixel-hour is not a fire. Boundaries predate Malerkotla district (2021), whose area sits inside Sangrur here.",
    "generated_utc": dt.datetime.now(dt.timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
    "script": "pipeline/analysis/punjab_districts.py",
    "districts": districts}
json.dump(doc, open(OUTF, "w"), separators=(",", ":"))
print("outage", OUTAGE)
print("unassigned", gk_unassigned)
for d in sorted(districts, key=lambda d: -sum(d["gk2a_pixel_hours"]["2025"][4:])):
    ph = d["gk2a_pixel_hours"]["2025"]; s = sum(ph) or 1
    print(f'{d["name"]:28s} late25={sum(ph[4:]):6d} late%={100*sum(ph[4:])/s:5.1f} pass%={100*(ph[1]+ph[2])/s:5.1f} '
          f'snpp21={sum(d["snpp_celldays"]["2021"]):5d} snpp25={sum(d["snpp_celldays"]["2025"]):5d} gkd21={sum(d["gk2a_pixel_days"]["2021"]):5d} gkd25={sum(d["gk2a_pixel_days"]["2025"]):5d}')
