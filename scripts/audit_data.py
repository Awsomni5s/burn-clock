"""Read-only audit of every supplied calendar tile and its packed gzip copy."""
import gzip,hashlib,json,time
from pathlib import Path
APP=Path(__file__).resolve().parents[1]
SRC=APP.parent/'public/data'
manifest=json.loads((SRC/'manifest.json').read_text())
months=manifest['months']; errors=[];count=0;cells=0;violations=0
start=time.time()
for name in manifest['tiles']:
    p=SRC/'tiles'/f'{name}.json'
    raw=p.read_bytes();packed=APP/'public/data/tiles'/f'{name}.json.gz'
    if hashlib.sha256(gzip.decompress(packed.read_bytes())).digest()!=hashlib.sha256(raw).digest(): errors.append(f'{name}: packed bytes differ')
    j=json.loads(raw);n=len(j['cells']);cells+=n;count+=1
    for field in ['harm','harm_lo','harm_hi','src']:
        if len(j[field])!=n: errors.append(f'{name}: {field} cell count');continue
        if any(len(r)!=len(months) for r in j[field]):errors.append(f'{name}: {field} month count')
    for p in ['T','A','N','J1']:
        if len(j['raw'][p])!=n or any(len(r)!=len(months) for r in j['raw'][p]):errors.append(f'{name}: raw {p} shape')
    for hr,lr,ur,sr in zip(j['harm'],j['harm_lo'],j['harm_hi'],j['src']):
        for h,l,u,s in zip(hr,lr,ur,sr):
            if h is None:
                if s!='X' or l is not None or u is not None:violations+=1
            elif l is None or u is None or not 0<=l<=h<=u or s not in 'MV':violations+=1
result={'calendar_tiles_checked':count,'cells_checked':cells,'months_per_cell':len(months),'cell_months_checked':cells*len(months),'interval_or_source_violations':violations,'errors':errors,'gzip_roundtrip':'exact byte equality for every tile','seconds':round(time.time()-start,2)}
print(json.dumps(result,indent=2))
(APP/'data-audit.json').write_text(json.dumps(result,indent=2)+'\n')
if errors or violations:raise SystemExit(1)
