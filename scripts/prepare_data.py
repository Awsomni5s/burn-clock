"""Package supplied outputs without rerunning or changing the scientific pipeline."""
import gzip, hashlib, json, shutil, time
from pathlib import Path

APP = Path(__file__).resolve().parents[1]
SOURCE = APP.parent / 'public/data'
OUT = APP / 'public/data'
OUT.mkdir(parents=True, exist_ok=True)
started = time.time()
files = sorted(SOURCE.rglob('*'))
total_raw = total_gzip = 0
clock_tiles = []
features = []
for p in files:
    if not p.is_file():
        continue
    rel = p.relative_to(SOURCE)
    if p.suffix == '.json':
        target = OUT / (str(rel) + '.gz')
        target.parent.mkdir(parents=True, exist_ok=True)
        raw = p.read_bytes()
        if not target.exists() or target.stat().st_mtime < p.stat().st_mtime:
            target.write_bytes(gzip.compress(raw, compresslevel=9, mtime=0))
        total_raw += len(raw)
        total_gzip += target.stat().st_size
        if rel.parts[0] == 'clock':
            j = json.loads(raw)
            clock_tiles.append(p.stem)
            yi = j['years'].index(2025)
            for ci, (lat, lon) in enumerate(j['cells']):
                count = j['day']['N'][ci][yi]
                if count is not None and count > 0:
                    features.append({'type':'Feature', 'geometry':{'type':'Point','coordinates':[lon+.5,lat+.5]}, 'properties':{'n':count}})
    elif p.suffix == '.png':
        (OUT / rel).parent.mkdir(parents=True,exist_ok=True)
        shutil.copy2(p,OUT / rel)

# Expose the independently supplied pair analysis without rewriting validation.json.
pairs = APP.parent/'pipeline/analysis/out/viirs_pairs.json'
(OUT/'same_day_pairs.json.gz').write_bytes(gzip.compress(pairs.read_bytes(),mtime=0))
catalog = {'clock_tiles':clock_tiles, 'calendar_tiles':len(list((SOURCE/'tiles').glob('*.json'))),
           'uncompressed_json_bytes':total_raw, 'compressed_json_bytes':total_gzip,
           'source_manifest_sha256':hashlib.sha256((SOURCE/'manifest.json').read_bytes()).hexdigest(),
           'map_note':'S-NPP 2025 fire-season daytime active cell-days; 1-degree cell centers. Size and opacity show counts, not individual fires.'}
(OUT/'catalog.json').write_text(json.dumps(catalog,separators=(',',':')))
(OUT/'activity.geojson.gz').write_bytes(gzip.compress(json.dumps({'type':'FeatureCollection','features':features},separators=(',',':')).encode(),mtime=0))
print(json.dumps({'files':len(files),'raw_MB':round(total_raw/1e6,1),'gzip_MB':round(total_gzip/1e6,1),'map_cells':len(features),'seconds':round(time.time()-started,1)}))
