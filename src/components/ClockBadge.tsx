import {Clock3,ShieldCheck,CircleHelp,ArrowUpRight} from 'lucide-react';
import type {ClockYear} from '../types';
import {PLATFORM_NAMES} from '../types';
import {number,signed} from '../data';
export default function ClockBadge({clock,detail=false,year}:{clock:ClockYear|undefined;detail?:boolean;year?:number}){
  const badge=clock?.badge??(year!=null&&year<2021?'not_evaluated':'not_identifiable');
  const labels={clock_sensitive:'Clock-sensitive',robust:'Within clock threshold',not_identifiable:'Not identifiable',not_evaluated:'Before diagnostic window'};
  const Icon=badge==='clock_sensitive'?Clock3:badge==='robust'?ShieldCheck:CircleHelp;
  return <div className={'clock-badge-block '+badge}><div className="badge-title"><Icon size={16}/><strong>{labels[badge]}</strong><span>{clock?.year??year??'—'}</span></div><p>{badge==='clock_sensitive'?`${clock?.drivers.map(p=>PLATFORM_NAMES[p as 'T'|'A']).join(' + ')} departs from the pre-drift MODIS / VIIRS relationship.`:badge==='robust'?'Testable platforms remain within the diagnostic threshold. This is not a guarantee of accuracy.':badge==='not_evaluated'?'The clock badge is evaluated for years from 2021 onward.':'Too few observations or an incomplete paired baseline to make this comparison.'}</p>
    {clock?.bend!=null&&<div className="bend-value"><span>Naive Terra + Aqua bend</span><strong>{signed(clock.bend)}%</strong></div>}
    {detail&&clock&&<div className="clock-tests">{clock.tests.map(t=><div key={t.platform}><strong>{PLATFORM_NAMES[t.platform]}</strong><span>{t.testable?`Δρ ${signed(t.delta,3)} · threshold ${number(t.threshold,3)}`:t.reason}</span><small>{number(t.cells)} matched 1° cells</small></div>)}<p className="fine-print">Fire-season diagnostic for the whole year, repeated on its months. Bend is relative to 2013–19; it is not a direct correction to the harmonized calendar.</p></div>}
    {!detail&&<a href="#clock" className="badge-link">Understand the satellite clock <ArrowUpRight size={13}/></a>}
  </div>;
}
