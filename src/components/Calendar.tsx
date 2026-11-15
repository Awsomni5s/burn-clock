import Term from './Term';
import {Evidence} from './Provenance';
import {useURLState,bool,choice} from '../urlState';
import {useMemo} from 'react';
import {ArrowDown,ArrowUp,Minus,Info,CalendarDays,Download} from 'lucide-react';
import type {AreaResult,Month,Platform,Manifest} from '../types';
import {PLATFORM_NAMES} from '../types';
import {number,csvForArea,download} from '../data';
import {timingChecks} from '../timing';
import DayCalendar,{useDaily} from './DayCalendar';
import {verdictFor,VERDICT_LABEL,type Verdict} from '../verdict';
const CLOCK_SHORT:Record<Verdict,string>={timing:'Timing',modis:'MODIS off',clear:'OK',unknown:'?'};
const MONTHS=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const ramp=['#fcf3ed','#f9e1d0','#f3c6a9','#eaa884','#df875e','#cc673e','#b64928','#8c301c'];
export default function Calendar({area,selected,onSelect,manifest,name,season,onTrend}:{onTrend?:()=>void;area:AreaResult;selected:string;onSelect:(s:string)=>void;manifest?:Manifest;name?:string;season?:number[]}){
  const [mode,setMode]=useURLState('calendar','harm',choice(['harm','raw','anomaly'] as const)),[platform,setPlatform]=useURLState<Platform>('platform','N',choice(['T','A','N','J1','J2'] as const)),[early,setEarly]=useURLState('early',false,bool);
  const rows=area.months.filter(m=>early||m.month>='2003-01');
  const years=[...new Set(rows.map(m=>m.month.slice(0,4)))].reverse();
  const max=useMemo(()=>Math.max(1,...rows.map(m=>(mode==='raw'?m.raw[platform]:m.harm)??0)),[rows,mode,platform]);
  const active=area.months.find(m=>m.month===selected);
  const val=(m:Month)=>mode==='raw'?m.raw[platform]:m.harm;
  const color=(m:Month)=>{const v=val(m);if(v==null)return '#edf0f1';if(mode==='anomaly')return m.anomaly==='above'?'#b94f2e':m.anomaly==='below'?'#f9e4d5':'#e9ae8d';return v===0?'#f7f7f5':ramp[Math.min(7,Math.floor(Math.sqrt(v/max)*7.99))];};
  const facts=useMemo(()=>calendarFacts(area.months),[area.months]);
  const daily=useDaily(area.box),[view,setView]=useURLState('cview','months',choice(['months','days'] as const)),days=view==='days'&&!!daily;
  const seasonLabel=season&&season.length?(season.length>1&&season.every((m,i)=>i===0||m===season[i-1]+1)?`${MONTHS[season[0]-1]}–${MONTHS[season[season.length-1]-1]}`:season.map(m=>MONTHS[m-1]).join(', ')):'';
  const clocks=useMemo(()=>{const o:Record<string,Verdict>={};if(!season?.length)return o;for(let y=2021;y<=2025;y++)o[String(y)]=verdictFor(timingChecks(area.months,season,y));return o;},[area.months,season]);
  const status={above:'Above typical',normal:'Within typical range',below:'Below typical',missing:'No baseline'};
  const onKey=(e:React.KeyboardEvent<HTMLButtonElement>,m:Month)=>{const offsets:Record<string,number>={ArrowRight:1,ArrowLeft:-1,ArrowUp:12,ArrowDown:-12};if(!(e.key in offsets))return;e.preventDefault();const idx=rows.findIndex(x=>x.month===m.month);const target=rows[idx+offsets[e.key]];if(target){onSelect(target.month);document.getElementById('month-'+target.month)?.focus();}};
  return <section className="card calendar-card" aria-labelledby="calendar-title">
    <div className="card-heading"><div><div className="eyebrow">BURNING ACTIVITY CALENDAR · MODIS + VIIRS ON ONE SCALE</div><h2 id="calendar-title">{name?`${name}: burning activity, month by month`:'Burning activity, month by month'}</h2><p>Satellite fire detections every month since {early?'2000':'2003'} · {mode==='raw'?`${PLATFORM_NAMES[platform]} observations, not harmonized`:'MODIS and VIIRS combined on one satellite scale, so the sensor no longer matters'}</p></div><button className="button secondary small" onClick={()=>download('burn-clock-area.csv',csvForArea(rows,area.clock,area.box,manifest))}><Download size={15}/> Export CSV</button></div>
    {facts&&<ul className="calendar-facts" data-testid="calendar-facts"><li><strong>Fire season:</strong> {facts.peak} ({number(facts.peakShare)}% of a typical year’s activity, 2003–2022)</li><li><strong>{facts.latestYear} compared with the 2003–2022 average:</strong> <Evidence value={(facts.latestChange>0?'+':'')+number(facts.latestChange)+'%'} expression="Σ harm(latest complete year) ÷ mean Σ harm(2003–2022) − 1" source="tiles/*.json → harm" producer="src/components/Calendar.tsx: calendarFacts"/>{facts.busiestYear?<>; busiest year since 2003: {facts.busiestYear}</>:null}. <a href="#answer" onClick={e=>{e.preventDefault();if(onTrend)onTrend();else document.getElementById('answer')?.scrollIntoView({behavior:'smooth'});}}>Can you trust that trend? See the check.</a></li></ul>}
    <div className="calendar-toolbar"><div className="segmented" role="group" aria-label="Calendar resolution"><button aria-pressed={!days} onClick={()=>setView('months')}>Months</button><button aria-pressed={days} disabled={!daily} title={daily?'Show each day of the selected season':'Day view: shipped for Punjab + Haryana; other areas show months'} onClick={()=>setView('days')} data-testid="calendar-days">Days</button></div>{!days&&<div className="segmented" role="group" aria-label="Calendar display">{(['harm','raw','anomaly'] as const).map(x=><button key={x} aria-pressed={mode===x} onClick={()=>setMode(x)}>{x==='harm'?'Combined record':x==='raw'?'By satellite':'Compared with usual'}</button>)}</div>}
      {mode==='raw'?<select aria-label="Raw satellite" value={platform} onChange={e=>setPlatform(e.target.value as Platform)}>{Object.entries(PLATFORM_NAMES).map(([p,name])=><option value={p} key={p}>{name}</option>)}</select>:<div className="heat-legend"><span>{mode==='anomaly'?'Below':'Less'}</span>{ramp.map(c=><i key={c} style={{background:c}}/>)}<span>{mode==='anomaly'?'Above':'More'}</span></div>}
    </div>
    {days&&daily?<DayCalendar doc={daily} months={area.months} season={season?.length?season:[Number(selected.slice(5))]} years={years}/>:<div className="calendar-body"><div className="heatmap-scroll"><div className={"heatmap"+(seasonLabel?" with-clock":"")} role="group" aria-label="Month by year heatmap. Use arrow keys to explore months.">
      <div className="heatmap-header"><span>YEAR</span>{MONTHS.map(m=><span key={m}>{m}</span>)}{seasonLabel&&<span className="clock-col-head" title={`Can you trust the ${seasonLabel} trend? The timing check for that year`}>Clock check</span>}</div>
      {years.map(y=><div className={'heatmap-row '+(y==='2012'?'seam-year':'')} key={y}><span className="year-label">{y}{y==='2012'&&<i title="VIIRS transition"/>}</span>{MONTHS.map((_,mi)=>{
        const m=rows.find(m=>m.month===`${y}-${String(mi+1).padStart(2,'0')}`);
        if(!m)return <span className="heat-cell empty" key={mi}/>;
        const v=val(m);
        const tip=`${MONTHS[mi]} ${y}: ${v==null?'No data':number(v,1)+' activity units'}. ${status[m.anomaly]}. Source: ${m.src==='V'?'VIIRS observed':m.src==='M'?'MODIS converted':'No data'}.`;
        return <button data-testid={'calendar-'+m.month} data-source={'tiles/*.json:'+ (mode==='raw'?'raw.'+platform:'harm')+'; month='+m.month} id={'month-'+m.month} className={'heat-cell '+(selected===m.month?'selected ':'')+(v==null?'missing ':'')} key={mi} style={{backgroundColor:color(m)}} onClick={()=>onSelect(m.month)} onKeyDown={e=>onKey(e,m)} title={tip} aria-label={tip} aria-pressed={selected===m.month}>{mode==='anomaly'&&m.harm!=null?(m.anomaly==='above'?<ArrowUp size={9}/>:m.anomaly==='below'?<ArrowDown size={9}/>:<Minus size={9}/>):null}</button>;
      })}{seasonLabel&&<span className="clock-cell">{clocks[y]?<a href="#answer" onClick={e=>{e.preventDefault();if(onTrend)onTrend();else document.getElementById('answer')?.scrollIntoView({behavior:'smooth'});}} className={'v-chip mini verdict-'+clocks[y]} data-testid={'clock-'+y} title={`${seasonLabel} ${y}: ${VERDICT_LABEL[clocks[y]]}`} aria-label={`${seasonLabel} ${y}: ${VERDICT_LABEL[clocks[y]]}`}>{CLOCK_SHORT[clocks[y]]}</a>:null}</span>}</div>)}
    </div></div>
    <aside className="month-detail" aria-live="polite">{active&&<><span className="detail-icon"><CalendarDays size={19}/></span><div className="eyebrow">SELECTED MONTH</div><h3>{MONTHS[Number(active.month.slice(5))-1]} {active.month.slice(0,4)}</h3><div className="detail-value"><Evidence value={number(val(active),0)} expression={"number(val(active),0)"} source={"tiles/*.json → raw, harm, harm_lo, harm_hi; selected month"} producer={"src/data.ts"}/></div><span className="detail-unit">{mode==='raw'?`${PLATFORM_NAMES[platform]} activity units`:'Combined activity units'}</span>
      <div className={'anomaly-pill '+active.anomaly}>{active.anomaly==='above'?<ArrowUp size={13}/>:active.anomaly==='below'?<ArrowDown size={13}/>:<Minus size={13}/>} {status[active.anomaly]}</div>
      {mode==='raw'&&<p className="fine-print">The baseline, bounds and source fields below describe the <Term text="harmonized"/> record, not the selected raw platform.</p>}<details><summary>Details: values, units and sources</summary><p>Unit: daytime active 0.05° cell-days on the S-NPP scale. Repeated observations are not individual fires.</p><dl><div><dt>Historical median</dt><dd><Evidence value={number(active.median)} expression={"number(active.median)"} source={"tiles/*.json → raw, harm, harm_lo, harm_hi; selected month"} producer={"src/data.ts"}/></dd></div><div><dt>Typical range</dt><dd><Evidence value={number(active.p25)} expression={"number(active.p25)"} source={"tiles/*.json → raw, harm, harm_lo, harm_hi; selected month"} producer={"src/data.ts"}/>–<Evidence value={number(active.p75)} expression={"number(active.p75)"} source={"tiles/*.json → raw, harm, harm_lo, harm_hi; selected month"} producer={"src/data.ts"}/></dd></div><div><dt>Approx. interval</dt><dd><Evidence value={number(active.lo)} expression={"number(active.lo)"} source={"tiles/*.json → raw, harm, harm_lo, harm_hi; selected month"} producer={"src/data.ts"}/>–<Evidence value={number(active.hi)} expression={"number(active.hi)"} source={"tiles/*.json → raw, harm, harm_lo, harm_hi; selected month"} producer={"src/data.ts"}/></dd></div><div><dt>Record source</dt><dd>{active.src==='V'?'VIIRS observed':active.src==='M'?'MODIS converted':'No data'}</dd></div><div><dt>Satellites in estimate</dt><dd>{active.satellites.map(p=>PLATFORM_NAMES[p]).join(' + ')||'—'}</dd></div></dl>
      <p className="fine-print">Comparison uses the combined {MONTHS[Number(active.month.slice(5))-1]} distribution, 2003–2022. Interval adds cell bounds; it is approximate.</p></details>
    </>}</aside></div>}
    <div className="calendar-footer"><label><input type="checkbox" checked={early} onChange={e=>setEarly(e.target.checked)}/> Include early archive (2000–2002)</label><span><i className="missing-key"/> Missing observations</span><span><i className="seam-key"/> 2012: <Term text="VIIRS"/> joins the record</span>{seasonLabel&&<span><strong>Clock check</strong>: can the {seasonLabel} trend be trusted that year (from 2021, when the drift began)</span>}<span>Timing checks use the selected season in the place report.</span></div>
    {early&&<p className="inline-notice"><Info size={14}/> Terra-only observations before July 2002 are the least reliable; no contemporaneous <Term text="VIIRS"/> validation is possible.</p>}
    {mode==='raw'&&<p className="inline-notice"><Info size={14}/> Raw counts are not coverage-rescaled or comparable across satellites. NOAA-21 is absent from this archive.</p>}
    <div className="source-note">Source: supplied FIRMS archive tiles · aggregation by 0.25° cell · zero and missing remain distinct.</div>
  </section>;
}

/** Critical period and latest-year comparison from the harmonized record (complete years only). */
export function calendarFacts(months:Month[]){
  const byYear=new Map<number,(number|null)[]>();
  for(const m of months){const y=Number(m.month.slice(0,4)),i=Number(m.month.slice(5))-1;if(!byYear.has(y))byYear.set(y,Array(12).fill(null));byYear.get(y)![i]=m.harm;}
  const complete=[...byYear].filter(([,v])=>v.every(x=>x!=null)).map(([y,v])=>[y,v as number[]] as const).sort((a,b)=>a[0]-b[0]);
  const base=complete.filter(([y])=>y>=2003&&y<=2022);if(base.length<10)return null;
  const mean=Array.from({length:12},(_,i)=>base.reduce((s,[,v])=>s+v[i],0)/base.length),year=mean.reduce((a,b)=>a+b,0);if(!year)return null;
  const order=mean.map((v,i)=>[v,i] as const).sort((a,b)=>b[0]-a[0]),pick:number[]=[];let acc=0;for(const [v,i] of order){if(acc>=0.5*year)break;pick.push(i);acc+=v;}
  pick.sort((a,b)=>a-b);const runs:number[][]=[];for(const i of pick){const r=runs.at(-1);if(r&&r.at(-1)===i-1)r.push(i);else runs.push([i]);}
  const peak=runs.map(r=>r.length>1?`${MONTHS[r[0]]}–${MONTHS[r.at(-1)!]}`:MONTHS[r[0]]).join(' and ');
  const latest=complete.at(-1)!,latestSum=latest[1].reduce((a,b)=>a+b,0),busiest=[...complete].filter(([y])=>y>=2003).sort((a,b)=>b[1].reduce((x,y)=>x+y,0)-a[1].reduce((x,y)=>x+y,0))[0];
  return {peak,critical:pick.map(i=>i+1),peakShare:100*acc/year,latestYear:latest[0],latestChange:100*(latestSum/year-1),busiestYear:busiest?.[0]};
}
