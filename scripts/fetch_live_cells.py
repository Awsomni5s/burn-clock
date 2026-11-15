"""Live timing check anywhere: NASA FIRMS global seven-day files -> public/data/live/week_cells.json.gz

Keyless public files: MODIS C6.1 (Terra, Aqua) and VIIRS 375 m NOAA-20, NOAA-21 (S-NPP has delivered no data since
2 Nov 2026). Unit, as in the archive tiles: daytime active 0.05-degree cell-days per satellite (all confidence levels;
the near-real-time files carry no static-source 'type' field). Cell-days are summed into 0.25-degree bins so any box
in the app can add them up. Each row: [south edge lat, west edge lon, Terra, Aqua, NOAA-20, NOAA-21].
Run:  python3 scripts/fetch_live_cells.py
"""
import csv, gzip, io, json, math, os, ssl, statistics, sys, time, urllib.request, datetime as dt
from collections import defaultdict

BASE = "https://firms.modaps.eosdis.nasa.gov/data/active_fire/"
FEEDS = {"MODIS": "modis-c6.1/csv/MODIS_C6_1_Global_7d.csv",
         "J1": "noaa-20-viirs-c2/csv/J1_VIIRS_C2_Global_7d.csv",
         "J2": "noaa-21-viirs-c2/csv/J2_VIIRS_C2_Global_7d.csv",
         "N": "suomi-npp-viirs-c2/csv/SUOMI_VIIRS_C2_Global_7d.csv"}
ORDER = ["T", "A", "J1", "J2"]
OUT = sys.argv[1] if len(sys.argv) > 1 else "public/data/live/week_cells.json.gz"
ctx = ssl.create_default_context(cafile=os.environ.get("CURL_CA_BUNDLE") or os.environ.get("SSL_CERT_FILE") or None)


def get(url):
    err = None
    for i in range(5):
        try:
            with urllib.request.urlopen(url, timeout=180, context=ctx) as r:
                return r.status, r.read().decode()
        except Exception as e:
            err = e; time.sleep(4 * (i + 1))
    raise err


cells = {p: set() for p in ORDER}
solar = {p: [] for p in ORDER}
feeds = {}
for key, path in FEEDS.items():
    status, text = get(BASE + path)
    n = 0; first = last = None
    for r in csv.DictReader(io.StringIO(text)):
        n += 1
        first = r["acq_date"] if first is None or r["acq_date"] < first else first
        last = r["acq_date"] if last is None or r["acq_date"] > last else last
        if r.get("daynight") != "D":
            continue
        p = ({"T": "T", "Terra": "T", "A": "A", "Aqua": "A"}[r["satellite"]]) if key == "MODIS" else key
        if p not in cells:
            continue
        lat, lon = float(r["latitude"]), float(r["longitude"])
        cells[p].add((math.floor(lat / 0.05), math.floor(lon / 0.05), r["acq_date"]))
        t = r["acq_time"].zfill(4)
        if len(solar[p]) < 400000:
            solar[p].append(((int(t[:2]) + int(t[2:]) / 60 + lon / 15) % 24))
    feeds[key] = {"url": BASE + path, "http_status": status, "rows": n, "first_date": first, "last_date": last}

bins = defaultdict(lambda: [0, 0, 0, 0])
for j, p in enumerate(ORDER):
    for (ci, cj, _) in cells[p]:
        bins[(math.floor(ci * 0.05 / 0.25 + 1e-9), math.floor(cj * 0.05 / 0.25 + 1e-9))][j] += 1
rows = [[round(bi * 0.25, 2), round(bj * 0.25, 2), *v] for (bi, bj), v in sorted(bins.items())]
dates = sorted({d for f in feeds.values() for d in (f["first_date"], f["last_date"]) if d})
doc = {"generated_utc": dt.datetime.now(dt.timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
       "window": {"first_date": dates[0] if dates else None, "last_date": dates[-1] if dates else None},
       "columns": ["south", "west", "T", "A", "J1", "J2"], "bin_deg": 0.25, "rows": rows, "feeds": feeds,
       "median_daytime_local_solar_hour": {p: (round(statistics.median(solar[p]), 2) if solar[p] else None) for p in ORDER},
       "unit": "Daytime active 0.05° cell-days per satellite, summed into 0.25° bins (south/west edges).",
       "definition": "NASA FIRMS seven-day near-real-time files; all confidence levels; daytime only. Provisional, not unique fires.",
       "script": "scripts/fetch_live_cells.py"}
os.makedirs(os.path.dirname(OUT), exist_ok=True)
with gzip.open(OUT, "wt") as f:
    json.dump(doc, f, separators=(",", ":"))
print(doc["window"], len(rows), {p: len(cells[p]) for p in ORDER}, doc["median_daytime_local_solar_hour"])
