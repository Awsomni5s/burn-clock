"""UI defaults: most frequent stored seasonal months among selected 1° clock cells.
Punjab uses the receipt's explicit Oct–Nov season; other defaults use source clock
season_months, ranked by cell frequency (ties by month), never fitted in the UI.
"""
import json,gzip,collections
from pathlib import Path
from numeric_reference import presets
root=Path(__file__).resolve().parents[1]
items={}
for preset in presets():
 key,box=preset['id'],preset['box']
 counts=collections.Counter()
 for p in (root/'public/data/clock').glob('*.json.gz'):
  # Skip tiles before decompression.
  a,b=p.name.split('.')[0].split('_');lat=int(a[1:])*(-1 if a[0]=='m' else 1);lon=int(b[1:])*(-1 if b[0]=='m' else 1)
  if lat>=box[2] or lat+5<=box[0] or lon>=box[3] or lon+5<=box[1]:continue
  d=json.loads(gzip.decompress(p.read_bytes()))
  for i,(lat,lon) in enumerate(d['cells']):
   if box[0]<=lat+.5<box[2] and box[1]<=lon+.5<box[3]:counts.update(d['season_months'][i])
 items[key]={'months':sorted(sorted(counts,key=lambda m:(-counts[m],m))[:3]),'source':'clock/*.json → season_months; most frequent months among area cells','counts':dict(counts)}
items['punjab']['months']=[10,11];items['punjab']['source']='pipeline/analysis/punjab_receipt.py → MONTHS (Punjab autumn receipt)'
(root/'public/data/preset_seasons.json').write_text(json.dumps(items,indent=2)+'\n')
print(items)
