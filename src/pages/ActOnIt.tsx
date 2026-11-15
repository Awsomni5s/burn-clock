import {useEffect,useMemo,useState} from 'react';
import {Evidence} from '../components/Provenance';
import {number} from '../data';
import {download} from '../data';
import {useURLState} from '../urlState';
import ThisWeek from '../components/ThisWeek';
import AskPanel from '../components/AskPanel';
import {saveClaimCard} from '../claimCard';
import {ALL,MIN_HOURLY,bestWindow,busiestDays,gapRange,seasonDates,districtAt,fieldCheckIcs,countGap,districtCsv,findDistrict,hourLabel,lateShare,passShare,priority,profileCsv,sum,windowLabel,wording,type DistrictDoc} from '../act';

const SRC='punjab_districts.json',PROD='pipeline/analysis/punjab_districts.py · src/act.ts';
const YEARS=[2019,2020,2021,2022,2023,2024,2025];
const RAMP=['#fff4d6','#fdd49e','#fc8d59','#d7301f','#7f0000'];
const pct=(x:number|null|undefined,d=0)=>x==null?'—':number(x,d)+'%';

/** Equirectangular projection of the district polygons into an SVG box. */
function useProjection(doc:DistrictDoc|null){
  return useMemo(()=>{
    if(!doc)return null;
    let x0=180,x1=-180,y0=90,y1=-90;
    const walk=(c:any,f:(p:number[])=>void)=>typeof c[0]==='number'?f(c):c.forEach((k:any)=>walk(k,f));
    doc.districts.forEach(d=>walk(d.geometry!.coordinates,([x,y])=>{x0=Math.min(x0,x);x1=Math.max(x1,x);y0=Math.min(y0,y);y1=Math.max(y1,y);}));
    const k=Math.cos((y0+y1)/2*Math.PI/180),W=460,s=W/((x1-x0)*k),H=(y1-y0)*s;
    const ring=(r:number[][])=>'M'+r.map(([x,y])=>`${((x-x0)*k*s).toFixed(1)},${((y1-y)*s).toFixed(1)}`).join('L')+'Z';
    const path=(g:any)=>(g.type==='Polygon'?[g.coordinates]:g.coordinates).map((p:number[][][])=>p.map(ring).join('')).join('');
    return {W,H,paths:Object.fromEntries(doc.districts.map(d=>[d.name,path(d.geometry)]))};
  },[doc]);
}

function HourBars({v,windowHours,year}:{v:number[];windowHours:number[];year:number}){
  const t=sum(v),X=(i:number)=>48+i*62,Y=(p:number)=>190-p*1.6;
  const marks=[{h:13.7,label:'VIIRS pass ~1:40 pm',color:'#1d70b8'},...(year>=2024?[{h:15.25,label:`Aqua ~3:15 pm (${year>=2025?'2025':'drifting'})`,color:'#6f5aa8'}]:[])];
  return <svg className="act-bars" viewBox="0 0 500 245" role="img" aria-label={`Share of the noon to 6 pm fire signal by hour, ${year}: ${v.map((x,i)=>`${hourLabel(12+i)} ${t?Math.round(100*x/t):0}%`).join(', ')}.`}>
    {[0,25,50,75,100].map(p=><g key={p}><line x1="40" x2="490" y1={Y(p)} y2={Y(p)} stroke="#e1e1e1"/><text x="34" y={Y(p)+4} textAnchor="end" fontSize="11">{p}%</text></g>)}
    {v.map((x,i)=>{const p=t?100*x/t:0,on=windowHours.includes(12+i);return <g key={i}><rect x={X(i)} y={Y(p)} width="44" height={190-Y(p)} fill={on?'#b34b20':'#c9c9c9'}/><text x={X(i)+22} y={Y(p)-5} textAnchor="middle" fontSize="11" fontWeight={on?700:400}>{Math.round(p)}%</text><text x={X(i)+22} y="207" textAnchor="middle" fontSize="12">{hourLabel(12+i)}</text></g>;})}
    {marks.map((m,j)=>{const x=X(m.h-12)+22;return <g key={m.label}><line x1={x} x2={x} y1={20+j*14} y2="190" stroke={m.color} strokeWidth="2" strokeDasharray="4 3"/><text x={x+4} y={18+j*14} fontSize="11" fill={m.color} fontWeight="700">{m.label}</text></g>;})}
    <text x="48" y="236" fontSize="11" fill="#505a5f">Hourly GK2A images, India time. Orange bars: suggested check window.</text>
  </svg>;
}

export default function ActOnIt(){
  const [doc,setDoc]=useState<DistrictDoc|null>(null),[error,setError]=useState('');
  const [name,setName]=useURLState('district',ALL,s=>s.slice(0,60));
  const [year,setYear]=useURLState('dyear',2025,s=>{const n=Number(s);return YEARS.includes(n)?n:2025;});
  const [base,setBase]=useURLState('dbase',2021,s=>{const n=Number(s);return YEARS.slice(0,-1).includes(n)?n:2021;});
  const [calStart,setCalStart]=useState(''),[calDays,setCalDays]=useState(14),[len,setLen]=useState(3),[copied,setCopied]=useState(''),[locStatus,setLocStatus]=useState(''),[cardStatus,setCardStatus]=useState('');
  useEffect(()=>{fetch('/data/punjab_districts.json').then(r=>{if(!r.ok)throw Error('District data could not be loaded.');return r.json();}).then(setDoc).catch(e=>setError(e.message));},[]);
  const proj=useProjection(doc);
  if(error)return <p role="alert">{error}</p>;
  if(!doc||!proj)return <p className="loading-state" role="status">Loading Punjab districts…</p>;
  const d=findDistrict(doc,name),place=d.name===ALL?'Punjab (all 22 districts)':d.name,v=d.gk2a_pixel_hours[year],total=sum(v),enough=total>=MIN_HOURLY;
  const w=bestWindow(v,len),peak=busiestDays(d,doc,year),late=lateShare(v),pass=passShare(v),gap=countGap(d,doc,base,2025),words=wording(d,doc,base,2025),rank=priority(doc,year),rank25=year===2025?rank:priority(doc,2025);
  const range=gap.ok?gapRange(d,doc,base,2025):null,passGk=(y:number)=>{const x=d.gk2a_pixel_hours[y];return x[1]+x[2];};
  const goDistrict=(n:string)=>{setName(n);setTimeout(()=>document.getElementById('act-field')?.scrollIntoView(),50);};
  const locate=()=>{if(!navigator.geolocation){setLocStatus('This browser cannot share a location.');return;}setLocStatus('Finding your district…');navigator.geolocation.getCurrentPosition(p=>{const n=districtAt(doc,p.coords.latitude,p.coords.longitude);if(n){goDistrict(n);setLocStatus(`You are in ${n}.`);}else setLocStatus('Your location is outside Punjab’s districts. Choose one from the list.');},()=>setLocStatus('Location was not shared. Choose a district from the list.'),{timeout:15000,maximumAge:600000});};
  const saveCard=async()=>{try{setCardStatus('Preparing image…');await saveClaimCard({title:`${place}: when to check fields`,context:`Burn Clock field card · Punjab · October–November ${year}`,lines:[`Check fields ${windowLabel(w.start,w.end)} India time: this window held ${pct(w.share)} of the noon–6 pm geostationary fire signal in ${year}.`,`The 1–2 pm images, when the counting satellites pass, held ${pct(pass)}.`,...(peak.share!=null?[`Busiest two weeks: ${peak.from}–${peak.to} (${pct(peak.share)} of the season’s signal).`]:[]),...(gap.ok?[`From ${base} to 2025 the ~1:40 pm satellite count ${gap.snppChange<0?'fell':'rose'} ${Math.round(Math.abs(gap.snppChange))}%; the whole-afternoon record ${gap.gkChange<0?'fell':'rose'} ${Math.round(Math.abs(gap.gkChange))}%.`]:[]),'GK2A pixels are ~4 km: they miss small fires and can flag hot smoke. The 6 pm image is near sunset.'],source:'Sources: GK2A hourly fire data (Jethva 2026, CC BY 4.0) · NASA FIRMS · geoBoundaries (ODbL)',url:location.href},'burn-clock-field-card-'+d.name.toLowerCase().replace(/[^a-z0-9]+/g,'-'));setCardStatus('Field card saved.');}catch(e){setCardStatus(e instanceof Error?e.message:'Could not save the card.');}};
  const monthNum=(x:string)=>x.endsWith('Oct')?'10':'11',defaultStart=`2027-${monthNum(peak.from)}-${String(parseInt(peak.from)).padStart(2,'0')}`,start=calStart||defaultStart;
  const saveIcs=()=>download(`burn-clock-field-checks-${d.name.toLowerCase().replace(/[^a-z0-9]+/g,'-')}.ics`,fieldCheckIcs(place,start,calDays,w.start,w.end>w.start?w.end:w.start+1,`Burn Clock: in ${year}, ${windowLabel(w.start,w.end)} held ${pct(w.share)} of ${place}'s noon–6 pm geostationary fire signal.`,location.href),'text/calendar;charset=utf-8');
  const seasons=YEARS.map(y=>({y,s:seasonDates(d,doc,y),late:sum(d.gk2a_pixel_hours[y])>=MIN_HOURLY?lateShare(d.gk2a_pixel_hours[y]):null}));
  const maxLate=Math.max(...rank.map(r=>r.late)),cls=(x:number)=>x<=0?0:Math.min(4,Math.floor(5*x/(maxLate+1)));
  const copy=async(text:string,what:string)=>{try{await navigator.clipboard.writeText(text);setCopied(what);}catch{setCopied('');}};
  const plan=`Burn Clock field-check plan · ${place} · October–November ${year}\nSuggested window: ${windowLabel(w.start,w.end)} India time (${len} hourly image${len>1?'s':''}).\nBusiest two weeks: ${peak.from}–${peak.to} (${pct(peak.share)} of the season's geostationary signal).\nThis window held ${pct(w.share)} of the noon–6 pm geostationary fire signal (GK2A, ${number(total)} pixel-hours).\nThe 1–2 pm images, around the VIIRS satellites' pass, held ${pct(pass)}.\nLimits: GK2A pixels are ~4 km, can flag hot smoke and miss small fires; only noon–6 pm images are used; the 6 pm image is near sunset.\nSource: ${location.href}`;
  return <article className="act-page">
    <p className="verdict-eyebrow">Act on it · Punjab, district by district</p>
    <h1>When and where the satellites miss Punjab’s burning, and what to do about it</h1>
    <p className="home-lead">The fire counts used to track Punjab’s stubble burning come from satellites that pass at about 1:40 pm. Burning has moved to the late afternoon. This page turns the hourly evidence into a plan for each district: when to check fields, how far to trust the count, and what you can say.</p>
    <nav className="act-jump" aria-label="Jump to your task"><a href="#act-field" onClick={e=>{e.preventDefault();document.getElementById('act-field')?.scrollIntoView();}}>I send field teams</a><a href="#act-air" onClick={e=>{e.preventDefault();document.getElementById('act-air')?.scrollIntoView();}}>I forecast air quality</a><a href="#act-say" onClick={e=>{e.preventDefault();document.getElementById('act-say')?.scrollIntoView();}}>I report or brief officials</a><a href="#act-data" onClick={e=>{e.preventDefault();document.getElementById('act-data')?.scrollIntoView();}}>I need the data</a></nav>

    <section className="act-controls" aria-label="Choose a district and years" data-testid="act-controls">
      <label>District<select aria-label="District" value={d.name} onChange={e=>setName(e.target.value)}><option value={ALL}>{ALL}</option>{[...doc.districts].sort((a,b)=>a.name.localeCompare(b.name)).map(x=><option key={x.name} value={x.name}>{x.name}</option>)}</select></label>
      <div className="act-locate"><button className="button secondary" onClick={locate} data-testid="act-locate">Use my location</button>{locStatus&&<span role="status">{locStatus}</span>}</div>
      <label>Season<select aria-label="Season year" value={year} onChange={e=>setYear(Number(e.target.value))}>{YEARS.map(y=><option key={y} value={y}>Oct–Nov {y}</option>)}</select></label>
      <label>Compare 2025 with<select aria-label="Comparison base year" value={base} onChange={e=>setBase(Number(e.target.value))}>{YEARS.slice(0,-1).map(y=><option key={y} value={y}>{y}{y===2021?' (official claim’s base year)':''}</option>)}</select></label>
    </section>

    <ThisWeek onDistrict={goDistrict} windowFor={n=>{const r=rank25.find(k=>k.name===n);return r?.window?windowLabel(r.window.start,r.window.end):'Too few to say';}}/>

    <section id="act-field" className="act-section" aria-labelledby="act-field-title" data-source={`${SRC} → districts[].gk2a_pixel_hours`}>
      <h2 id="act-field-title">1 · Field teams: when and where to check</h2>
      <div className="act-two">
        <div>
          <p className="act-answer" data-testid="act-window">{enough?<>In <strong>{place}</strong>, {year}, checks from <strong>{windowLabel(w.start,w.end)}</strong> would have covered <strong><Evidence value={pct(w.share)} expression={`bestWindow(gk2a_pixel_hours[${year}], ${len}).share`} source={SRC} producer={PROD}/></strong> of the afternoon fire signal. The 1–2 pm images, around the satellite pass, held <strong><Evidence value={pct(pass)} expression={`share of 13:00 + 14:00 images, ${year}`} source={SRC} producer={PROD}/></strong>.</>:<>Too little geostationary fire signal in {place} in {year} ({number(total)} pixel-hours, needs {MIN_HOURLY}) to plan a window. Choose another year or all districts.</>}</p>
          {enough&&peak.share!=null&&<p data-testid="act-peak">Busiest two weeks: <strong>{peak.from}–{peak.to}</strong>, with <Evidence value={pct(peak.share)} expression={`max over 14-day runs of gk2a_pixel_days[${year}] ÷ season total`} source={SRC} producer={PROD}/> of the season’s geostationary fire signal. Plan rosters around it.</p>}
          <label className="act-len">Window length <select aria-label="Window length" value={len} onChange={e=>setLen(Number(e.target.value))}>{[1,2,3,4].map(n=><option key={n} value={n}>{n} hourly image{n>1?'s':''}</option>)}</select></label>
          {enough&&<HourBars v={v} windowHours={w.hours} year={year}/>}
          <div className="act-buttons no-print"><button className="button primary" onClick={()=>copy(plan,'plan')} disabled={!enough}>Copy field-check plan</button>{enough&&<a className="button secondary" href={'https://wa.me/?text='+encodeURIComponent(plan)} target="_blank" rel="noopener noreferrer" data-testid="act-whatsapp">Share plan on WhatsApp</a>}{import.meta.env.VITE_TELEGRAM_BOT&&<a className="button secondary" href={`https://t.me/${import.meta.env.VITE_TELEGRAM_BOT}?start=d_${d.name===ALL?'Punjab':d.name.replace(/ /g,'_')}`} target="_blank" rel="noopener noreferrer">Weekly updates on Telegram</a>}<button className="button secondary" onClick={saveCard} disabled={!enough} data-testid="act-card">Save field card (image)</button><button className="button secondary" onClick={()=>copy(location.href,'link')}>Copy link to {d.name===ALL?'this view':d.name}</button><button className="button secondary" onClick={()=>window.print()}>Print this page</button>{copied==='link'&&<span role="status">Link copied.</span>}{cardStatus&&<span role="status">{cardStatus}</span>}{copied==='plan'&&<span role="status">Copied.</span>}</div>
        </div>
        <figure className="act-map">
          <svg viewBox={`0 0 ${proj.W} ${proj.H}`} role="img" aria-label={`Map of Punjab districts shaded by fire signal at 4 pm or later, ${year}. Selected: ${place}.`}>
            {doc.districts.map(x=>{const r=rank.find(k=>k.name===x.name)!;return <path key={x.name} d={proj.paths[x.name]} fill={RAMP[cls(r.late)]} stroke={x.name===d.name?'#0b0c0c':'#ffffff'} strokeWidth={x.name===d.name?3:1} onClick={()=>setName(x.name)} style={{cursor:'pointer'}}><title>{x.name}: {number(r.late)} pixel-hours at 4 pm or later in {year}</title></path>;})}
          </svg>
          <figcaption>Fire signal at 4 pm or later, {year} (GK2A pixel-hours). Darker = more late burning. Click a district.<span className="act-ramp" aria-hidden="true">{RAMP.map(c=><i key={c} style={{background:c}}/>)}</span></figcaption>
        </figure>
      </div>
      {enough&&<details className="act-calendar no-print" data-testid="act-calendar"><summary>Put the check window in your team’s calendar</summary><p>A calendar file with one event a day, {windowLabel(w.start,w.end)} India time. It starts by default on the first day of {year}’s busiest two weeks, in 2027. Change the dates to suit your season.</p><div className="act-cal-row"><label>First day<input type="date" value={start} onChange={e=>setCalStart(e.target.value)} aria-label="First day of field checks"/></label><label>Days<input type="number" min={1} max={61} value={calDays} onChange={e=>setCalDays(Math.max(1,Math.min(61,Number(e.target.value)||1)))} aria-label="Number of days"/></label><button className="button secondary" onClick={saveIcs}>Download calendar file (.ics)</button></div><p className="plain-limit">Works with Google Calendar, Outlook and phone calendars. The file is made in your browser and is not sent anywhere.</p></details>}
      <h3>How the season has changed in {place}</h3>
      <div className="table-scroll" role="region" tabIndex={0} aria-label="Season timing by year"><table className="act-table compact" data-testid="act-seasons"><thead><tr><th>Season</th><th>Afternoon signal at 4 pm+</th><th>Burning starts (10%)</th><th>Halfway (50%)</th><th>Mostly over (90%)</th></tr></thead>
        <tbody>{seasons.map(({y,s,late})=><tr key={y} aria-current={y===year?'true':undefined}><th>{y}</th><td>{pct(late)}</td>{s?<><td>{s.start}</td><td>{s.mid}</td><td>{s.end}</td></>:<td colSpan={3}>Too few geostationary detections</td>}</tr>)}</tbody></table></div>
      <p className="plain-limit">Dates are when 10%, 50% and 90% of the season’s GK2A pixel-days (October–November, noon–6 pm images) had been recorded. Use them to set the start and end of field rosters.</p>
      <h3>Where the late burning is: districts ranked, {year}</h3>
      <div className="table-scroll" role="region" tabIndex={0} aria-label="Districts ranked by late-afternoon fire signal"><table className="act-table" data-testid="act-priority"><thead><tr><th>#</th><th>District</th><th>Fire signal, 4 pm+</th><th>Share of Punjab’s late signal</th><th>Its afternoon at 4 pm+</th><th>Best 3-hour window</th><th>1:40 pm satellite count</th><th>Count fell vs afternoon, {base}→2025</th></tr></thead>
        <tbody>{rank.map((r,i)=><tr key={r.name} aria-current={r.name===d.name?'true':undefined}><td>{i+1}</td><th><button className="link-button" onClick={()=>{setName(r.name);document.getElementById('act-field')?.scrollIntoView();}}>{r.name}</button></th><td><Evidence value={number(r.late)} expression={`sum(${r.name}.gk2a_pixel_hours[${year}] at 16,17,18)`} source={SRC} producer={PROD}/></td><td>{pct(r.shareOfState)}</td><td>{pct(r.lateShare)}</td><td>{r.window?windowLabel(r.window.start,r.window.end):'Too few'}</td><td><Evidence value={number(r.snpp)} expression={`sum(${r.name}.snpp_celldays[${year}]), Oct 1–Nov 30`} source={SRC} producer={PROD}/> cell-days</td><td>{(()=>{const g=countGap(findDistrict(doc,r.name),doc,base,2025);return g.ok?`${pct(g.snppChange)} vs ${pct(g.gkChange)}`:'Too few';})()}</td></tr>)}</tbody></table></div>
      <p className="plain-limit">Units: a pixel-hour is one ~4 km GK2A pixel flagged in one hourly image, so one long fire counts in several hours. A cell-day is one 0.05° grid cell with at least one S-NPP VIIRS daytime detection on a day. Neither is a count of fields burned. The 6 pm image is near sunset and uses night thresholds. {doc.limits}</p>
    </section>

    <section id="act-air" className="act-section" aria-labelledby="act-air-title" data-source={`${SRC} → snpp_celldays, gk2a_pixel_days`}>
      <h2 id="act-air-title">2 · Air-quality forecasters: don’t scale emissions by the 1:40 pm count</h2>
      {gap.ok?<>
        <p className="act-answer" data-testid="act-gap">In <strong>{place}</strong>, from {base} to 2025, the 1:40 pm satellite count <strong><Evidence value={(gap.snppChange<0?'fell ':'rose ')+number(Math.abs(gap.snppChange))+'%'} expression={`masked sum snpp_celldays[2025] ÷ [${base}] − 1; dropped days: ${gap.masked.join(', ')||'none'}`} source={SRC} producer={PROD}/></strong>, but the whole-afternoon geostationary signal <strong><Evidence value={(gap.gkChange<0?'fell ':'rose ')+number(Math.abs(gap.gkChange))+'%'} expression={`masked sum gk2a_pixel_days[2025] ÷ [${base}] − 1; dropped days: ${gap.masked.join(', ')||'none'}`} source={SRC} producer={PROD}/></strong>. An emissions input scaled by the satellite count would be about <strong><Evidence value={number(gap.factor,1)+'×'} expression="(GK2A 2025/base) ÷ (S-NPP 2025/base)" source={SRC} producer={PROD}/></strong> too low relative to the afternoon record{range?<> (90% range from resampling days: <Evidence value={`${number(range[0],1)}×–${number(range[1],1)}×`} expression="1,000 day resamples within each year, seed 20261115" source={SRC} producer="src/act.ts: gapRange"/>)</>:null}.</p>
        {gap.ok&&passGk(base)>=MIN_HOURLY&&(()=>{const c=100*(passGk(2025)/passGk(base)-1),agree=c<=-50&&gap.snppChange<=-50;return <p data-testid="act-consistency"><strong>Consistency check:</strong> the 1–2 pm GK2A images, taken when the satellites pass, changed <Evidence value={pct(c)} expression={`(13:00+14:00 pixel-hours 2025) ÷ (${base}) − 1, unmasked`} source={SRC} producer={PROD}/> from {base} to 2025, against <Evidence value={pct(gap.snppChange)} expression="S-NPP cell-day change above" source={SRC} producer={PROD}/> for the satellite count. {agree?'At the hour the satellites look, the two records agree that burning collapsed. They part ways only in the later hours, which the satellites never see.':'Here the two records do not line up at the satellite hour, so treat the factor with extra care.'}</p>;})()}
        <div className="table-scroll" role="region" tabIndex={0} aria-label="Satellite count and afternoon signal"><table className="act-table compact"><thead><tr><th>Source</th><th>{base}</th><th>2025</th><th>Change</th></tr></thead><tbody><tr><th>S-NPP VIIRS, ~1:40 pm (cell-days)</th><td>{number(gap.snppA)}</td><td>{number(gap.snppB)}</td><td>{pct(gap.snppChange)}</td></tr><tr><th>GK2A, noon–6 pm (pixel-days)</th><td>{number(gap.gkA)}</td><td>{number(gap.gkB)}</td><td>{pct(gap.gkChange)}</td></tr></tbody></table></div>
        <ul className="act-list"><li>Shift your diurnal fire profile later for Punjab. Use the hourly profile below in place of a fixed early-afternoon peak.</li><li>Treat the factor as a sensitivity range, not a correction: change the base year and it moves. GK2A misses small fires that VIIRS sees.</li><li>Re-check any fire climatology built before 2021.</li></ul>
      </>:<p className="act-answer" data-testid="act-gap">{gap.reason} Choose another base year or all districts.</p>}
      <details><summary>The factor for every base year ({place})</summary><div className="table-scroll" role="region" tabIndex={0} aria-label="Factor for every base year"><table className="act-table compact"><thead><tr><th>Base year</th><th>1:40 pm count change</th><th>Afternoon change</th><th>Factor</th></tr></thead><tbody>{YEARS.slice(0,-1).map(y=>{const g=countGap(d,doc,y,2025);return <tr key={y}><th>{y}</th>{g.ok?<><td>{pct(g.snppChange)}</td><td>{pct(g.gkChange)}</td><td>{number(g.factor,1)}×</td></>:<td colSpan={3}>{g.reason}</td>}</tr>;})}</tbody></table></div><p className="plain-limit">Each comparison leaves out the calendar days on which S-NPP or NOAA-20 had an outage in either year, from both years, so the two years compare like for like (the same rule as the <a href="#receipt">statewide evidence</a>). {doc.outage_rule}</p></details>
      <div className="act-buttons no-print"><button className="button secondary" onClick={()=>download('burn-clock-punjab-hourly-profile.csv',profileCsv(doc))}>Download hourly profiles (every district, 2019–2025)</button></div>
    </section>

    <section id="act-say" className="act-section" aria-labelledby="act-say-title">
      <h2 id="act-say-title">3 · Reporters and officials: what the numbers support</h2>
      {words?<div className="say-grid" data-testid="act-say">
        <div className="say-yes"><h3>You can say</h3><p>{words.say}</p><button className="button secondary no-print" onClick={()=>copy(words.say+' '+words.why+' Source: Burn Clock, NASA FIRMS and GK2A (Jethva 2026).','say')}>Copy</button>{copied==='say'&&<span role="status"> Copied.</span>}</div>
        <div className="say-no"><h3>Don’t say</h3><p>{words.dont}</p></div>
        <div className="say-why"><h3>Why</h3><p>{words.why}</p></div>
      </div>:<p data-testid="act-say">{gap.ok?'':gap.reason} No wording is offered where the data are too thin.</p>}
      <p className="plain-limit">Official Punjab counts (CREAMS/ISRO protocol) mix MODIS and VIIRS over 15 September–30 November, so they differ from these October–November VIIRS totals. <a href="#receipt">See the statewide evidence</a> · <a href="#brief">One-page brief</a>.</p>
    </section>

    <section id="act-data" className="act-section" aria-labelledby="act-data-title">
      <h2 id="act-data-title">4 · Researchers: the data behind this page</h2>
      <div className="act-buttons no-print"><button className="button secondary" onClick={()=>download('burn-clock-punjab-districts.csv',districtCsv(doc))}>Download district table (CSV)</button><a className="button secondary" href="/data/punjab_districts.json" download>District data (JSON, with boundaries)</a><a className="button secondary" href={`/api/punjab?district=${encodeURIComponent(d.name===ALL?'all':d.name)}`}>This district as JSON (API)</a></div>
      <ul className="act-list"><li>GK2A: {doc.sources.gk2a}.</li><li>Polar satellites: {doc.sources.viirs}.</li><li>Districts: {doc.sources.boundaries}. {doc.assignment}</li><li>Built by <code>{doc.script}</code> on {doc.generated_utc.slice(0,10)}. GK2A pixels outside every district polygon (for example on the border) are left out of district totals: {number(doc.gk2a_unassigned_pixel_hours[String(year)])} pixel-hours in {year}.</li></ul>
    </section>
    <AskPanel compact/>
    <p className="act-elsewhere">Outside Punjab there is no hourly record here yet. <a href="#explorer">Check any place</a> for its verdict and role-specific actions.</p>
  </article>;
}
