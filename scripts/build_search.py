"""Place search index with real outlines: every Natural Earth country (shape n:<A3>, outline from
public/maps/countries.geojson) and every admin-1 state/province (shape a:<A3>:<id>, outline from
public/maps/adm1/<A3>.json, built by scripts/build_provinces.py). Writes public/maps/search.json."""
import json, glob, os
root = os.path.join(os.path.dirname(__file__), '..', 'public', 'maps')
def bbox(g):
    polys = [g['coordinates']] if g['type'] == 'Polygon' else g['coordinates']
    xs = [p[0] for poly in polys for p in poly[0]]; ys = [p[1] for poly in polys for p in poly[0]]
    return [round(min(ys), 3), round(min(xs), 3), round(max(ys), 3), round(max(xs), 3)]
places = []
for f in json.load(open(os.path.join(root, 'countries.geojson')))['features']:
    p = f['properties']
    if not f.get('geometry') or p['ADM0_A3'] == 'ATA': continue
    places.append({'name': p['ADMIN'], 'kind': 'country', 'box': bbox(f['geometry']), 'shape': 'n:' + p['ADM0_A3']})
for path in sorted(glob.glob(os.path.join(root, 'adm1', '*.json'))):
    a3 = os.path.basename(path)[:-5]
    if a3 == 'index': continue
    for f in json.load(open(path))['features']:
        p = f['properties']
        places.append({'name': f"{p['name']}, {p['country']}", 'kind': (p.get('type') or 'province').lower().split('|')[0], 'box': p['box'], 'shape': f'a:{a3}:{p["id"]}'})
json.dump({'source': 'Natural Earth admin-0 and 10m admin-1 (public domain). Each place carries its real outline; the calendar counts only grid cells whose centre lies inside it.',
           'places': places}, open(os.path.join(root, 'search.json'), 'w'), separators=(',', ':'))
print(len(places), 'places')
