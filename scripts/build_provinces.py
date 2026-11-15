"""Province (admin-1) polygons for area selection -> public/maps/adm1/<ADM0_A3>.json + index.json

Source: Natural Earth 10m admin-1 states/provinces (public domain), simplified to ~0.02 degrees and split per country
so the map loads only the country you click. Run: python3 scripts/build_provinces.py <ne_10m_admin_1_states_provinces.geojson>
"""
import json, sys, os, collections
from shapely.geometry import shape, mapping
src = sys.argv[1]; out = "public/maps/adm1"; os.makedirs(out, exist_ok=True)
fc = json.load(open(src))
by = collections.defaultdict(list)
def rnd(c):
    return [rnd(x) for x in c] if isinstance(c[0], (list, tuple)) else [round(c[0], 3), round(c[1], 3)]
for f in fc["features"]:
    p = f["properties"]; a3 = p.get("adm0_a3") or p.get("ADM0_A3")
    if not a3 or not f["geometry"]: continue
    g = shape(f["geometry"]).simplify(0.02, preserve_topology=True)
    if g.is_empty: continue
    w, s, e, n = g.bounds
    by[a3].append({"type": "Feature", "properties": {"id": p.get("adm1_code") or p.get("iso_3166_2"), "name": p.get("name") or p.get("name_en") or "Unnamed",
                   "country": p.get("admin"), "type": p.get("type_en") or p.get("type"), "box": [round(s, 3), round(w, 3), round(n, 3), round(e, 3)]},
                   "geometry": {"type": mapping(g)["type"], "coordinates": rnd(mapping(g)["coordinates"])}})
index = {}
for a3, feats in by.items():
    json.dump({"type": "FeatureCollection", "features": feats}, open(f"{out}/{a3}.json", "w"), separators=(",", ":"))
    index[a3] = {"country": feats[0]["properties"]["country"], "count": len(feats)}
json.dump({"source": "Natural Earth 10m admin-1 states and provinces (public domain), simplified 0.02°", "countries": index}, open(f"{out}/index.json", "w"), separators=(",", ":"))
print(len(index), sum(v["count"] for v in index.values()))
