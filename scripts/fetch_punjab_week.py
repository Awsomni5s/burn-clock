"""This week in Punjab: NASA FIRMS seven-day near-real-time detections by district -> public/data/punjab_week.json

Keyless public FIRMS files (South Asia, last 7 days): MODIS C6.1 (Terra, Aqua), VIIRS 375 m NOAA-20, NOAA-21, S-NPP.
Each daytime detection (all confidence levels, as in the archive comparison in punjab_aqua_daily.json) is placed in the
Punjab district whose polygon (the simplified geometry shipped in public/data/punjab_districts.json) contains it.
Raw detections, provisional, not unique fires. Run:  python3 scripts/fetch_punjab_week.py
"""
import csv, io, json, statistics, sys, urllib.request, datetime as dt, ssl, os, time
from shapely.geometry import shape, Point
from shapely import STRtree

BASE = "https://firms.modaps.eosdis.nasa.gov/data/active_fire/"
FEEDS = {"MODIS": "modis-c6.1/csv/MODIS_C6_1_South_Asia_7d.csv",
         "J1": "noaa-20-viirs-c2/csv/J1_VIIRS_C2_South_Asia_7d.csv",
         "J2": "noaa-21-viirs-c2/csv/J2_VIIRS_C2_South_Asia_7d.csv",
         "N": "suomi-npp-viirs-c2/csv/SUOMI_VIIRS_C2_South_Asia_7d.csv"}
NAMES = {"T": "Terra MODIS", "A": "Aqua MODIS", "J1": "NOAA-20 VIIRS", "J2": "NOAA-21 VIIRS", "N": "S-NPP VIIRS"}
OUT = sys.argv[1] if len(sys.argv) > 1 else "public/data/punjab_week.json"
ctx = ssl.create_default_context(cafile=os.environ.get("CURL_CA_BUNDLE") or os.environ.get("SSL_CERT_FILE") or None)

doc = json.load(open("public/data/punjab_districts.json"))
names = [d["name"] for d in doc["districts"]]
geoms = [shape(d["geometry"]) for d in doc["districts"]]
tree = STRtree(geoms)


def get(url):
    for i in range(4):
        try:
            with urllib.request.urlopen(url, timeout=90, context=ctx) as r:
                return r.status, r.read().decode()
        except Exception as e:  # transient resets happen on this server
            err = e; time.sleep(3 * (i + 1))
    raise err


feeds, rows = {}, []
for key, path in FEEDS.items():
    status, text = get(BASE + path)
    recs = list(csv.DictReader(io.StringIO(text)))
    feeds[key] = {"url": BASE + path, "http_status": status, "rows": len(recs),
                  "first_date": min((r["acq_date"] for r in recs), default=None),
                  "last_date": max((r["acq_date"] for r in recs), default=None)}
    for r in recs:
        if r["daynight"] != "D":
            continue
        plat = ("T" if r["satellite"] in ("T", "Terra") else "A") if key == "MODIS" else key
        lat, lon = float(r["latitude"]), float(r["longitude"])
        if not (29.4 <= lat <= 32.6 and 73.8 <= lon <= 77.0):
            continue
        hit = tree.query(Point(lon, lat), predicate="within")
        if len(hit) == 0:
            continue
        hh, mm = int(r["acq_time"][:-2] or 0), int(r["acq_time"][-2:])
        ist = (hh + mm / 60 + 5.5) % 24
        rows.append((names[int(hit[0])], plat, r["acq_date"], ist))

dates = sorted({d for f in feeds.values() for d in ([f["first_date"], f["last_date"]] if f["first_date"] else [])})
plats = ["T", "A", "J1", "J2", "N"]
by = {n: {p: 0 for p in plats} for n in names}
for n, p, d, h in rows:
    by[n][p] += 1
pass_ist = {p: round(statistics.median([h for _, q, _, h in rows if q == p]), 2) for p in plats if any(q == p for _, q, _, _ in rows)}
days = {p: sorted({d for _, q, d, _ in rows if q == p}) for p in plats}
out = {"generated_utc": dt.datetime.now(dt.timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
       "window": {"first_date": dates[0] if dates else None, "last_date": dates[-1] if dates else None},
       "feeds": feeds, "platform_names": NAMES, "median_pass_ist": pass_ist, "days_with_detections": days,
       "districts": [{"name": n, "daytime": by[n]} for n in names],
       "by_date": {p: {d: sum(1 for _, q, dd, _ in rows if q == p and dd == d) for d in days[p]} for p in plats},
       "definition": "Daytime FIRMS near-real-time detections in the last seven days, all confidence levels, placed in Punjab districts by point in polygon (simplified boundaries). Raw detections, provisional, not unique fires.",
       "script": "scripts/fetch_punjab_week.py"}
json.dump(out, open(OUT, "w"), indent=1)
print(out["window"], pass_ist, {p: sum(by[n][p] for n in names) for p in plats})
