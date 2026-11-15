import {useEffect,useState} from 'react';
import {Evidence} from './Provenance';
import {number} from '../data';
import {historyRatios,weekRatio,hourLabel,type AquaDailyDoc,type WeekDoc} from '../act';

const clock=(h:number)=>{const H=Math.floor(h),M=Math.round((h-H)*60/5)*5;return `${H>12?H-12:H}:${String(M%60).padStart(2,'0')} pm`;};
const day=(iso:string)=>new Date(iso+'T12:00:00Z').toLocaleDateString('en-GB',{day:'numeric',month:'short',timeZone:'UTC'});

/** Right now: the FIRMS seven-day snapshot compared with the same calendar days in 2013–2025. */
export default function ThisWeek({onDistrict,windowFor}:{onDistrict:(name:string)=>void;windowFor:(name:string)=>string}){
  const [week,setWeek]=useState<WeekDoc|null>(null),[hist,setHist]=useState<AquaDailyDoc|null>(null),[error,setError]=useState(false);
  useEffect(()=>{Promise.all(['/data/punjab_week.json','/data/punjab_aqua_daily.json'].map(u=>fetch(u).then(r=>{if(!r.ok)throw Error();return r.json();}))).then(([w,h])=>{setWeek(w);setHist(h);}).catch(()=>setError(true));},[]);
  if(error)return <p className="plain-limit">This week’s snapshot could not load.</p>;
  if(!week||!hist)return <p role="status" className="loading-state">Loading this week’s NASA detections…</p>;
  const now=weekRatio(week);
  if(now.ratio==null||!now.days.length)return <p className="plain-limit">No day this week on which both Aqua and NOAA-20 recorded fire in Punjab.</p>;
  const past=historyRatios(hist,now.days.map(d=>d.slice(5))),early=past.filter(p=>p.year<=2021&&p.ratio!=null),typical=early.reduce((s,p)=>s+p.ratio!,0)/early.length;
  const earlyPass=early.reduce((s,p)=>s+p.pass,0)/early.length,aquaNow=week.median_pass_ist.A,viirsNow=week.median_pass_ist.J1;
  const bars=[...past.map(p=>({label:String(p.year),ratio:p.ratio,pass:p.pass,live:false})),{label:'This week',ratio:now.ratio,pass:aquaNow,live:true}];
  const max=Math.max(...bars.map(b=>b.ratio??0)),X=(i:number)=>46+i*34,Y=(v:number)=>170-v/max*140;
  const rows=[...week.districts].map(d=>({name:d.name,aqua:d.daytime.A??0,viirs:(d.daytime.J1??0)+(d.daytime.J2??0)})).filter(r=>r.aqua+r.viirs>0).sort((a,b)=>b.aqua-a.aqua||b.viirs-a.viirs);
  const first=now.days[0],last=now.days[now.days.length-1];
  return <section id="act-now" className="act-section act-now" aria-labelledby="act-now-title" data-source="punjab_week.json; punjab_aqua_daily.json">
    <h2 id="act-now-title">Right now · {day(week.window.first_date!)}–{day(week.window.last_date!)} 2026</h2>
    <p className="act-answer" data-testid="act-now">This week Aqua, which now crosses Punjab at about <strong>{clock(aquaNow)}</strong>, recorded <strong><Evidence value={number(now.ratio,1)} expression="Σ Aqua ÷ Σ NOAA-20 daytime detections, Punjab districts, days both recorded fire" source="punjab_week.json → by_date" producer="scripts/fetch_punjab_week.py · src/act.ts"/></strong> fire detections for every one NOAA-20 recorded at about {clock(viirsNow)}. On the same calendar days in 2013–2021, when Aqua crossed at about {clock(earlyPass)}, it recorded about <strong><Evidence value={number(typical,1)} expression="mean of yearly Σ Aqua ÷ Σ VIIRS, same calendar days, 2013–2021" source="punjab_aqua_daily.json" producer="pipeline/analysis/punjab_aqua_daily.py · src/act.ts"/></strong>. Aqua’s instrument is the less sensitive one, so burning is happening after the main satellites pass, this week.</p>
    <div className="act-two">
      <figure className="act-now-chart">
        <svg viewBox={`0 0 ${X(bars.length)+10} 225`} role="img" aria-label={`Aqua detections per NOAA-20 or S-NPP detection on the same calendar days: ${bars.map(b=>`${b.label} ${b.ratio==null?'no data':number(b.ratio,2)}`).join(', ')}.`}>
          {[0,.5,1,1.5,2].filter(v=>v<=max*1.05).map(v=><g key={v}><line x1="40" x2={X(bars.length)} y1={Y(v)} y2={Y(v)} stroke="#e1e1e1"/><text x="34" y={Y(v)+4} textAnchor="end" fontSize="11">{v}</text></g>)}
          <line x1="40" x2={X(bars.length)} y1={Y(1)} y2={Y(1)} stroke="#505a5f" strokeDasharray="4 3"/>
          {bars.map((b,i)=>b.ratio==null?null:<g key={b.label}><rect x={X(i)} y={Y(b.ratio)} width="26" height={170-Y(b.ratio)} fill={b.live?'#b34b20':'#c9c9c9'}/>{(b.live||i%3===0||b.label==='2025')&&<text x={X(i)+13} y={Y(b.ratio)-4} textAnchor="middle" fontSize="10" fontWeight={b.live?700:400}>{number(b.ratio,1)}</text>}<text x={X(i)+13} y="186" textAnchor="middle" fontSize="10" fontWeight={b.live?700:400}>{b.live?'Now':b.label.slice(2)}</text>{(b.live||b.label==='2013'||b.label==='2021'||b.label==='2025')&&<text x={X(i)+13} y="200" textAnchor="middle" fontSize="9" fill="#6f5aa8">{clock(b.pass).replace(' pm','')}</text>}</g>)}
          <text x="40" y="218" fontSize="10" fill="#505a5f">Aqua ÷ VIIRS detections, same calendar days · purple: Aqua’s crossing time, pm India</text>
        </svg>
        <figcaption>Year labels are ’13–’25. Above the dashed line Aqua records more fire than the more sensitive VIIRS. VIIRS reference: S-NPP to 2017, NOAA-20 from 2018.</figcaption>
      <p className="plain-limit">NASA FIRMS seven-day near-real-time files, fetched {week.generated_utc.slice(0,16).replace('T',' ')} UTC by <code>{week.script}</code>. Provisional: raw detections, not unique fires, all confidence levels. S-NPP has delivered no data since 2 November 2026. Aqua does not see Punjab every day; days on which either satellite recorded nothing are left out of the ratio. Different instruments: MODIS (Aqua, 1 km) usually records far fewer detections than VIIRS (375 m).</p>
      </figure>
      <div>
        <h3>Where to send teams this week</h3>
        <div className="table-scroll" role="region" tabIndex={0} aria-label="This week's detections by district"><table className="act-table compact" data-testid="act-week-table"><thead><tr><th>District</th><th>Aqua, ~{hourLabel(Math.round(aquaNow))}</th><th>NOAA-20 + NOAA-21, ~2 pm</th><th>Check window (2025 pattern)</th></tr></thead>
          <tbody>{rows.slice(0,10).map(r=><tr key={r.name}><th><button className="link-button" onClick={()=>onDistrict(r.name)}>{r.name}</button></th><td>{number(r.aqua)}</td><td>{number(r.viirs)}</td><td>{windowFor(r.name)}</td></tr>)}</tbody></table></div>
        <p className="plain-limit">Daytime detections, {day(first)}–{day(last)} (UTC dates); {rows.length} districts had any. Choose a district to open its check window below.</p>
      </div>
    </div>

  </section>;
}
