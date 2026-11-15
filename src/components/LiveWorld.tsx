import {useEffect,useState} from 'react';
import {number} from '../data';
import {Evidence} from './Provenance';

type Area={id:string;name:string;kind:string;box:number[];status:'signal'|'within'|'below'|'unknown';ratio:number|null;low:number|null;high:number|null;reason:string|null};
const LABEL={signal:'Later than usual',within:'Normal',below:'Aqua sees less (no shift later)',unknown:'Can’t tell'};
const day=(iso:string)=>new Date(iso+'T12:00:00Z').toLocaleDateString('en-GB',{day:'numeric',month:'short',timeZone:'UTC'});

/** Live, worldwide: where this week’s NASA data says burning is happening later than usual. */
export default function LiveWorld(){
  const [doc,setDoc]=useState<{generated_utc:string;window:{first_date:string;last_date:string};areas:Area[];definition:string;script:string}|null>(null);
  useEffect(()=>{fetch('/data/live/world_live.json').then(r=>r.ok?r.json():null).then(setDoc).catch(()=>{});},[]);
  if(!doc)return null;
  const later=doc.areas.filter(a=>a.status==='signal'),rest=doc.areas.filter(a=>a.status!=='signal'),tested=doc.areas.filter(a=>a.status!=='unknown').length;
  const link=(a:Area)=>`?box=${a.box.map(x=>Math.round(x*1000)/1000).join(',')}&months=${new Date(doc.window.last_date+'T12:00:00Z').getUTCMonth()+1}&a=2021&b=2025#explorer`;
  return <section className="live-world" aria-labelledby="live-world-title" data-testid="live-world" data-source="live/world_live.json">
    <p className="verdict-eyebrow">Live · NASA data, {day(doc.window.first_date)}–{day(doc.window.last_date)}</p>
    <h2 id="live-world-title">Where burning is later than usual this week</h2>
    <p>Of {tested} areas with enough fires to test, <strong>{later.length}</strong> show the later-passing Aqua satellite catching clearly more fire than it did in the same month of 2013–19.</p>
    <div className="table-scroll" role="region" tabIndex={0} aria-label="Areas where burning is later than usual this week"><table className="act-table compact"><thead><tr><th>Area</th><th>Aqua ÷ NOAA-20 this week</th><th>Normal range (2013–19)</th></tr></thead>
      <tbody>{later.map(a=><tr key={a.id}><th><a href={link(a)}>{a.name}</a></th><td><Evidence value={number(a.ratio,2)} expression="Aqua ÷ (NOAA-20 × bridge), daytime cell-days this week" source="live/world_live.json" producer="scripts/build_live_world.mjs · src/liveCheck.ts"/></td><td>{number(a.low,2)}–{number(a.high,2)}</td></tr>)}</tbody></table></div>
    <details><summary>Every other area ({rest.length})</summary><ul className="live-rest">{rest.map(a=><li key={a.id}><a href={link(a)}>{a.name}</a>: {LABEL[a.status]}{a.status!=='unknown'&&a.ratio!=null?` (${number(a.ratio,2)}; normal ${number(a.low,2)}–${number(a.high,2)})`:a.reason?` (${a.reason})`:''}</li>)}</ul></details>
    <p className="plain-limit">{doc.definition} Provisional near-real-time data, refreshed every six hours by <code>{doc.script}</code>. “Later than usual” is a diagnostic, not proof of why.</p>
  </section>;
}
