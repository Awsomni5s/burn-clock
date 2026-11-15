"""Independent Python interpretation of the selected-month timing supersession.
Inputs are Python-aggregated original monthly tile data, never JavaScript results.
The exact revised addendum was absent; rules are documented in Methods.
"""
import json, math
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
reference=json.loads((ROOT/'scripts/numeric_expected.json').read_text())
stats=json.loads((ROOT/'scripts/stats_expected.json').read_text())
seasons=json.loads((ROOT/'public/data/preset_seasons.json').read_text())
def calculate(rows,months,year):
    selected=sorted(set(months)); index={r['month']:r for r in rows}
    valid=bool(selected) and all(isinstance(m,int) and 1<=m<=12 for m in selected)
    def total(y,p):
        values=[index.get(f'{y}-{m:02d}',{}).get('raw',{}).get(p) for m in selected]
        return sum(values) if valid and all(isinstance(v,(int,float)) and math.isfinite(v) and v>=0 for v in values) else None
    tests=[]
    for p in ['T','A']:
        current,reference=total(year,p),total(year,'N'); base=[]; years=[]
        for y in range(2013,2020):
            a,n=total(y,p),total(y,'N')
            if a is not None and n is not None and a>0 and n>0: base.append(math.log(a/n));years.append(y)
        mean=sum(base)/7 if len(base)==7 else None
        sigma=math.sqrt(sum((x-mean)**2 for x in base)/7) if mean is not None else None
        threshold=max(2*sigma,.15) if sigma is not None else None
        delta=math.log(current/reference)-mean if mean is not None and current and reference else None
        testable=valid and year>=2021 and current is not None and current>=50 and reference is not None and reference>=200 and delta is not None and threshold is not None
        tests.append(dict(platform=p,count=current,reference=reference,delta=delta,sigma=sigma,threshold=threshold,testable=testable,baselineYears=years))
    aqua=tests[1]; drivers=[t['platform'] for t in tests if t['testable'] and abs(t['delta'])>t['threshold']]
    return dict(year=year,months=selected,tests=tests,drivers=drivers,late='unknown' if not aqua['testable'] else 'signal' if aqua['delta']>aqua['threshold'] else 'within',relationship='signal' if drivers else 'within' if all(t['testable'] for t in tests) else 'unknown')
out={'presets':{},'edges':{}}
for key,area in reference['presets'].items():
    selections={(tuple([int(m['month'][5:])]),int(m['month'][:4])) for m in area['months']}
    selections|={(tuple(seasons[key]['months']),y) for y in range(2013,2026)}
    selections|={(tuple(c['months']),c['b']) for c in stats['presets'][key]['claims']}
    selections|={((),2025),((10,11),2025)}
    if key=='africa': selections.add(((1,2),2025))
    out['presets'][key]={'|'.join([','.join(map(str,ms)),str(y)]):calculate(area['months'],list(ms),y) for ms,y in sorted(selections)}
import numeric_reference as source
manifest=source.read_json('manifest.json.gz')
for key,edge in stats['edges'].items():
    rows=source.calendar_reference(edge['box'],manifest)['months']
    c=edge['claim'];out['edges'][key]=calculate(rows,c['months'],c['b'])
(ROOT/'scripts/timing_expected.json').write_text(json.dumps(out,separators=(',',':'))+'\n')
print('Independent selected-month timing references:',sum(map(len,out['presets'].values())))
