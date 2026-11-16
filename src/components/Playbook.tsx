import {useEffect,useMemo,useState} from 'react';
import {fetchData,number,download} from '../data';
import type {BBox} from '../types';
import type {Role} from '../insights';
import {receiptFacts} from '../insights';
import type {LiveCells} from '../liveCheck';

/** The job-specific playbook under the plan: WHERE to go (map), WHEN, WHAT to do and HOW, from the same data the rest of the site uses.
 * Punjab + Haryana gets district detail (NASA FIRMS this week + GK2A hourly evidence); any other area gets this week's hotspots from the live grid. */
type District={name:string;gk2a_pixel_hours:Record<string,number[]>;geometry:{type:string;coordinates:any}};
type Week={window:{first_date:string;last_date:string};districts:{name:string;daytime:Record<string,number>}[]};
const PUNJAB:BBox=[29.5,73.8,32.6,77.0];
const overlaps=(a:BBox,b:BBox)=>a[0]<b[2]&&a[2]>b[0]&&a[1]<b[3]&&a[3]>b[1];
const hourLabel=(h:number)=>h===12?'noon':h>12?`${h-12} pm`:`${h} am`;
const rings=(g:{type:string;coordinates:any})=>g.type==='Polygon'?[g.coordinates[0]]:g.coordinates.map((p:any)=>p[0]);

interface Row{name:string;week:number;win:string;winShare:number;late:number;peak:string;geometry:District['geometry']}
function districtRows(d:{hours_ist:number[];districts:District[]},w:Week):Row[]{
  const wk=new Map(w.districts.map(x=>[x.name,(x.daytime.A??0)+(x.daytime.J1??0)+(x.daytime.J2??0)]));
  return d.districts.map(x=>{const v=x.gk2a_pixel_hours['2025']??[],t=v.reduce((a,b)=>a+b,0)||1,hrs=d.hours_ist;
    let bi=0,bs=-1;for(let i=0;i+2<v.length;i++){const s=v[i]+v[i+1]+v[i+2];if(s>bs){bs=s;bi=i;}}
    const late=100*v.reduce((a,b,i)=>a+(hrs[i]>=16?b:0),0)/t,pk=v.indexOf(Math.max(...v));
    return {name:x.name,week:wk.get(x.name)??0,win:`${hourLabel(hrs[bi])}–${hourLabel(hrs[bi]+3)}`,winShare:100*bs/t,late,peak:hourLabel(hrs[pk]),geometry:x.geometry};
  }).sort((a,b)=>b.week-a.week);
}

const COPY:Record<Role,{title:string;lead:string;col:string}>={
  policy:{title:'Where to send field teams this week, and when',lead:'Districts ranked by satellite fire detections in NASA’s last seven days. The check window is the 3-hour stretch that held most of each district’s afternoon burning in 2025 (hourly GK2A satellite).',col:'Send teams'},
  air:{title:'Where this week’s smoke comes from, and at what hour',lead:'Fire sources this week by district, with the share of each district’s afternoon burning that now happens after 4 pm: the hours the ~1:30 pm satellites miss and your emission timing should cover.',col:'After 4 pm'},
  journalist:{title:'Your story this week: where it’s burning, and what you can say',lead:'The districts with the most fire detections this week, and the numbers you can stand behind.',col:'Most fire at'},
  research:{title:'Data, checks and downloads for this area',lead:'This week’s detections and the 2025 hourly profile by district, with the record’s tested error and every source one click away.',col:'Best 3-h window'},
};

export default function Playbook({role,box,name,receipt,validation}:{role:Role;box:BBox;name:string;receipt?:Record<string,any>;validation?:Record<string,any>}){
  const punjab=overlaps(box,PUNJAB);
  const [dist,setDist]=useState<any>(null),[week,setWeek]=useState<Week|null>(null),[cells,setCells]=useState<LiveCells|null>(null);
  useEffect(()=>{if(!punjab)return;fetch('/data/punjab_districts.json').then(r=>r.json()).then(setDist).catch(()=>{});fetch('/data/punjab_week.json').then(r=>r.json()).then(setWeek).catch(()=>{});},[punjab]);
  useEffect(()=>{if(punjab)return;fetchData<LiveCells>('live/week_cells.json').then(setCells).catch(()=>{});},[punjab]);
  const rows=useMemo(()=>dist&&week?districtRows(dist,week):null,[dist,week]);
  const hot=useMemo(()=>{if(!cells)return null;const h=cells.bin_deg;return cells.rows.filter(([s,w])=>s+h/2>=box[0]&&s+h/2<box[2]&&w+h/2>=box[1]&&w+h/2<box[3]).map(([s,w,T,A,J1,J2])=>({lat:s+h/2,lon:w+h/2,n:A+J1+J2+T})).filter(c=>c.n>0).sort((a,b)=>b.n-a.n);},[cells,box]);
  const c=COPY[role],f=receipt?receiptFacts(receipt):null;
  const [copied,setCopied]=useState(false);
  const planText=()=>{if(!punjab||!rows)return hot&&hot.length?[`Burn Clock: ${name}, hotspots this week (NASA FIRMS, provisional)`,...hot.slice(0,8).map((h,i)=>`${i+1}. ${h.lat.toFixed(2)}, ${h.lon.toFixed(2)}: ${h.n} detections`),location.href].join('\n'):'';
    const top=rows.slice(0,8),wk=`${week!.window.first_date} to ${week!.window.last_date}`,tot=rows.reduce((a,r)=>a+r.week,0);
    const head={policy:`FIELD PLAN, Punjab, ${wk}`,air:`SMOKE SOURCES, Punjab, ${wk}`,journalist:`STORY NOTES, Punjab, ${wk}`,research:`DATA NOTES, Punjab, ${wk}`}[role];
    const lines=top.map((r,i)=>role==='air'?`${i+1}. ${r.name}: ${r.week} detections; ${Math.round(r.late)}% of its afternoon burning after 4 pm; peak ${r.peak}`:role==='journalist'?`${i+1}. ${r.name}: ${r.week} detections this week; most fire at ${r.peak}`:`${i+1}. ${r.name}: ${r.week} detections; check ${r.win} (${Math.round(r.winShare)}% of its 2025 afternoon burning)`);
    const how={policy:[`Start with ${top.slice(0,3).map(r=>r.name).join(', ')}: ${top.slice(0,3).reduce((a,r)=>a+r.week,0)} of ${tot} detections.`,'Be in the field in each district window, not at satellite pass times (about 10 am and 1:30 pm).',f?`Report fires seen in the window, not the satellite count (count -${Math.round(f.officialDecline)}% 2021-2025; whole afternoon -${Math.round(f.afternoonDecline)}%).`:'Report fires seen in the window, not the satellite count.'],
      air:[f?`Put ${Math.round(f.late2025)}% of daily fire emissions after 4 pm (it was ${Math.round(f.late2021)}% in 2021).`:'Shift fire emissions after 4 pm.','Do not scale emissions down with the satellite count.',`Top three districts hold ${Math.round(100*top.slice(0,3).reduce((a,r)=>a+r.week,0)/Math.max(1,tot))}% of this week's sources.`],
      journalist:[f?`You can say: satellite fire detections in Punjab fell ${Math.round(f.officialDecline)}% between 2021 and 2025.`:'',f?`You can say: an hourly satellite shows afternoon burning fell about ${Math.round(f.afternoonDecline)}%, and ${Math.round(f.late2025)}% of it now happens after 4 pm.`:'',`Don't say: "farm fires fell" from the count; don't say why burning moved later.`],
      research:['Monthly record: Export CSV on the calendar.',`API: ${location.origin}/api/check?box=${box.join(',')} and ${location.origin}/api/punjab`,'Treat post-2021 changes as partly a timing effect.']}[role].filter(Boolean);
    return [head,'',...lines,'',...how.map(x=>'- '+x),'','Sources: NASA FIRMS (provisional), GK2A hourly satellite (2025).',location.href].join('\n');};
  const copyPlan=async()=>{try{await navigator.clipboard.writeText(planText());setCopied(true);setTimeout(()=>setCopied(false),2000);}catch{}};
  const csv=()=>rows&&download('burn-clock-districts-this-week.csv','district,daytime_detections_this_week,best_3h_window_2025,share_in_window_pct,share_after_4pm_pct,peak_hour\n'+rows.map(r=>[r.name,r.week,r.win,r.winShare.toFixed(1),r.late.toFixed(1),r.peak].join(',')).join('\n'));
  return <section className="playbook" data-testid="playbook" aria-labelledby="pb-title">
    <h2 id="pb-title">{punjab?c.title:`Where it’s burning in ${name} this week`}</h2>
    <p className="pb-lead">{punjab?c.lead:'The busiest 0.25° squares (about 28 km) in NASA’s last seven days, inside your area. District-level plans are available for Punjab + Haryana.'}</p>
    {punjab?(rows?<div className="pb-grid">
      <DistrictMap rows={rows}/>
      <div className="pb-table"><table><thead><tr><th>#</th><th>District</th><th>Fires this week</th><th>{c.col}</th></tr></thead>
        <tbody>{rows.slice(0,8).map((r,i)=><tr key={r.name}><td><span className="pb-pin">{i+1}</span></td><td><a href={`?district=${encodeURIComponent(r.name)}#act`}>{r.name}</a></td><td>{number(r.week,0)}</td>
          <td>{role==='policy'||role==='research'?<>{r.win} <small>({number(r.winShare,0)}%)</small></>:role==='air'?<>{number(r.late,0)}%</>:r.peak}</td></tr>)}</tbody></table>
        <p className="pb-src">Fires this week: NASA FIRMS daytime detections, {week!.window.first_date} to {week!.window.last_date} (Aqua, NOAA-20, NOAA-21; provisional). Hours: GK2A geostationary satellite, 2025, India time.</p></div>
      <div className="pb-how">{role==='policy'&&<><h3>How to run it</h3><ol>
          <li><strong>Where:</strong> start with {rows.slice(0,3).map(r=>r.name).join(', ')}: {number(rows.slice(0,3).reduce((a,r)=>a+r.week,0),0)} of {number(rows.reduce((a,r)=>a+r.week,0),0)} detections this week.</li>
          <li><strong>When:</strong> be in the field in each district’s window, e.g. {rows[0].name} {rows[0].win} ({number(rows[0].winShare,0)}% of its afternoon burning in 2025). Not at the satellite pass times (about 10 am and 1:30 pm).</li>
          <li><strong>What to report:</strong> fires you saw in the window, not the satellite count. {f&&<>The official count fell {number(f.officialDecline,0)}% (2021→2025) while the whole afternoon fell {number(f.afternoonDecline,0)}%.</>}</li>
          <li><strong>How:</strong> open a district for its map, busiest two weeks and a field card to send on WhatsApp.</li></ol></>}
        {role==='air'&&<><h3>How to use it in your forecast</h3><ol>
          <li><strong>Timing:</strong> {f&&<>{number(f.late2025,0)}% of Punjab’s afternoon burning was at 4 pm or later in 2025 (it was {number(f.late2021,0)}% in 2021).</>} Put that share of the day’s fire emissions after 4 pm, not at the satellite pass.</li>
          <li><strong>Amount:</strong> don’t scale emissions down with the satellite count. {f&&<>The count fell {number(f.officialDecline,0)}%; the whole afternoon fell {number(f.afternoonDecline,0)}%.</>}</li>
          <li><strong>Where:</strong> weight sources by this week’s detections; the top three districts hold {number(100*rows.slice(0,3).reduce((a,r)=>a+r.week,0)/Math.max(1,rows.reduce((a,r)=>a+r.week,0)),0)}%.</li>
          <li><strong>Inputs:</strong> download the district table (hourly shares) below.</li></ol></>}
        {role==='journalist'&&<><h3>What you can say</h3><ul className="pb-say">
          <li className="ok">“Satellite fire detections in Punjab fell {f?number(f.officialDecline,0):'—'}% between 2021 and 2025.”</li>
          <li className="ok">“An hourly satellite shows afternoon burning fell about {f?number(f.afternoonDecline,0):'—'}%, and {f?number(f.late2025,0):'—'}% of it now happens after 4 pm.”</li>
          <li className="ok">“This week the most detections were in {rows.slice(0,2).map(r=>r.name).join(' and ')}.” (provisional)</li>
          <li className="no">Don’t say: “Farm fires fell {f?number(f.officialDecline,0):'—'}%.” The count measures what satellites saw at their pass times.</li>
          <li className="no">Don’t say why burning moved later (enforcement, weather): the data can’t show cause.</li></ul></>}
        {role==='research'&&<><h3>What to use</h3><ol>
          <li><strong>Record:</strong> monthly MODIS + VIIRS on one scale, with ranges (Export CSV on the calendar). Held-out yearly error: {validation?.loyo?<>{number(validation.loyo.global.median_annual_err_pct,1)}% worldwide, {number(validation.loyo.punjab.median_annual_err_pct,1)}% in Punjab</>:'see the Validation page'}.</li>
          <li><strong>Timing:</strong> treat post-2021 changes here as partly a timing effect; report the verdict with any trend.</li>
          <li><strong>API:</strong> <code>/api/check?box={box.join(',')}</code> and <code>/api/punjab</code> return the same numbers as JSON.</li>
          <li><strong>Methods:</strong> <a href="#methods">methods</a> · <a href="#validation">validation and failures</a>.</li></ol></>}
        <div className="pb-share"><a className="nm-share" href={`https://wa.me/?text=${encodeURIComponent(planText())}`} target="_blank" rel="noopener noreferrer" data-testid="pb-whatsapp">Send this full plan to WhatsApp</a><button className="button secondary" onClick={copyPlan} data-testid="pb-copy">{copied?'Copied':'Copy the full plan'}</button><button className="button secondary" onClick={csv} data-testid="pb-csv">Download district table (CSV)</button></div></div>
    </div>:<p role="status">Loading district data…</p>)
    :hot?(hot.length?<div className="pb-grid"><HotMap box={box} hot={hot.slice(0,40)}/><div className="pb-table"><table><thead><tr><th>#</th><th>Square (centre)</th><th>Fires this week</th></tr></thead><tbody>{hot.slice(0,8).map((h,i)=><tr key={i}><td><span className="pb-pin">{i+1}</span></td><td><a href={`https://www.google.com/maps/@${h.lat},${h.lon},10z`} target="_blank" rel="noopener noreferrer">{h.lat.toFixed(2)}°, {h.lon.toFixed(2)}°</a></td><td>{number(h.n,0)}</td></tr>)}</tbody></table>
      <p className="pb-src">NASA FIRMS daytime detections (Terra, Aqua, NOAA-20, NOAA-21), {cells!.window.first_date} to {cells!.window.last_date}; provisional.</p></div>
      <div className="pb-how"><h3>How to use it</h3><ol>{role==='policy'&&<li>Send checks to squares 1–3 first; they hold {number(100*hot.slice(0,3).reduce((a,h)=>a+h.n,0)/hot.reduce((a,h)=>a+h.n,0),0)}% of this week’s detections here.</li>}{role==='air'&&<li>Weight this week’s fire sources to these squares; check the trend card before scaling by counts.</li>}{role==='journalist'&&<li>These are this week’s hotspots (provisional). Name the satellite and dates if you report them.</li>}{role==='research'&&<li>Same grid via <code>/api/check?box={box.join(',')}</code>; the calendar exports the monthly record.</li>}<li>Read the timing card before calling a low count “less burning”.</li></ol></div></div>
      :<p>No satellite fire detections inside {name} in NASA’s last seven days.</p>):<p role="status">Loading this week’s hotspots…</p>}
  </section>;
}

function project(box:BBox,w=320,h=260){const [s,wl,n,e]=box,kx=w/(e-wl),ky=h/(n-s),k=Math.min(kx,ky),ox=(w-(e-wl)*k)/2,oy=(h-(n-s)*k)/2;return (lon:number,lat:number)=>[ox+(lon-wl)*k,oy+(n-lat)*k];}
function DistrictMap({rows}:{rows:Row[]}){
  const P=project([29.5,73.8,32.6,77.0]),max=Math.max(1,...rows.map(r=>r.week)),top=rows.slice(0,8);
  const col=(v:number)=>v===0?'#f3f2f1':`rgba(179,58,11,${0.15+0.85*Math.sqrt(v/max)})`;
  const cen=(g:Row['geometry'])=>{const r=rings(g)[0];const [x,y]=r.reduce((a:number[],p:number[])=>[a[0]+p[0],a[1]+p[1]],[0,0]);return P(x/r.length,y/r.length);};
  return <svg className="pb-map" viewBox="0 0 320 260" role="img" aria-label={`Punjab districts by fire detections this week; most in ${top.slice(0,3).map(r=>r.name).join(', ')}`}>
    {rows.map(r=><g key={r.name}><title>{`${r.name}: ${r.week} detections this week; window ${r.win}`}</title>{rings(r.geometry).map((ring:number[][],i:number)=><path key={i} d={'M'+ring.map(p=>P(p[0],p[1]).map(v=>v.toFixed(1)).join(',')).join('L')+'Z'} fill={col(r.week)} stroke="#fff" strokeWidth=".8"/>)}</g>)}
    {top.map((r,i)=>{const [x,y]=cen(r.geometry);return <g key={r.name}><circle cx={x} cy={y} r="8" fill="#0b0c0c" stroke="#fff" strokeWidth="1.5"/><text x={x} y={y+3.5} textAnchor="middle" fontSize="10" fontWeight="700" fill="#fff">{i+1}</text></g>;})}
  </svg>;
}
function HotMap({box,hot}:{box:BBox;hot:{lat:number;lon:number;n:number}[]}){
  const P=project(box),max=Math.max(1,...hot.map(h=>h.n));
  return <svg className="pb-map" viewBox="0 0 320 260" role="img" aria-label="This week’s busiest squares inside the area"><rect x="0" y="0" width="320" height="260" fill="#f8f8f6"/>
    {hot.map((h,i)=>{const [x,y]=P(h.lon,h.lat);return <g key={i}><circle cx={x} cy={y} r={3+9*Math.sqrt(h.n/max)} fill="rgba(179,58,11,.55)"/>{i<8&&<><circle cx={x} cy={y} r="7" fill="#0b0c0c"/><text x={x} y={y+3} textAnchor="middle" fontSize="9" fontWeight="700" fill="#fff">{i+1}</text></>}</g>;})}
  </svg>;
}
