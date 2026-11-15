"""Verify the shipped tiles without requiring unshipped raw NASA inputs."""
import gzip, json, time, hashlib, yaml
from pathlib import Path
root=Path(__file__).resolve().parents[1]
data=root/'public/data'
manifest=json.loads(gzip.decompress((data/'manifest.json.gz').read_bytes()))
validation=json.loads(gzip.decompress((data/'validation.json.gz').read_bytes()))
start=time.time(); cells=0; observations=0
for name in manifest['tiles']:
    tile=json.loads(gzip.decompress((data/'tiles'/f'{name}.json.gz').read_bytes()))
    n=len(tile['cells']); cells+=n
    for field in ['harm','harm_lo','harm_hi','src']:
        assert len(tile[field])==n, (name,field,'cells')
        assert all(len(row)==len(manifest['months']) for row in tile[field]), (name,field,'months')
    for platform,rows in tile['raw'].items():
        if platform=='J2' and rows==[] and manifest['totals']['by_platform']['J2']==0: continue
        assert len(rows)==n and all(len(row)==len(manifest['months']) for row in rows),(name,platform)
    for hr,lr,ur,sr in zip(tile['harm'],tile['harm_lo'],tile['harm_hi'],tile['src']):
        for h,lo,hi,source in zip(hr,lr,ur,sr):
            observations+=1
            assert (source=='X' and lo is None and hi is None) if h is None else (lo is not None and hi is not None and 0<=lo<=h<=hi and source in 'MV'),(name,h,lo,hi,source)
assert hashlib.sha256(json.dumps(yaml.safe_load((root/'pipeline/harmonize/CONFIG.yaml').read_text())['method'],sort_keys=True,separators=(',',':')).encode()).hexdigest()==validation['config_hash']
world=json.loads(gzip.decompress((data/'world/countries.json.gz').read_bytes()))
ranked=json.loads((data/'world_drift_ranked.json').read_bytes())['countries']
assert len(world)==len(ranked)
source={row['iso3']:row for row in world}
for row in ranked:
    assert all(row[key]==value for key,value in source[row['iso3']].items())
    assert len(row['box'])==4
assert [abs(r['bend_TA_pct']) for r in ranked]==sorted([abs(r['bend_TA_pct']) for r in ranked],reverse=True)
report={'status':'passed','generatedAt':time.strftime('%Y-%m-%dT%H:%M:%SZ',time.gmtime()),'calendarTiles':len(manifest['tiles']),'cells':cells,'cellMonths':observations,'configHash':validation['config_hash'],'rankedCountries':len(ranked),'seconds':round(time.time()-start,2),'scope':'Shipped output integrity and configuration. Does not reproduce unavailable raw/Parquet inputs or the missing contour generator.'}
(root/'bundle-checks.json').write_text(json.dumps(report,indent=2)+'\n')
print(json.dumps(report))
