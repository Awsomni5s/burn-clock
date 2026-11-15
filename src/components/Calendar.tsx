import {useMemo,useState} from 'react';
import {ArrowDown,ArrowUp,Minus,Info,CalendarDays,Download} from 'lucide-react';
import type {AreaResult,Month,Platform} from '../types';
import {PLATFORM_NAMES} from '../types';
import {number,csvForArea,download} from '../data';
const MONTHS=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const ramp=['#fcf3ed','#f9e1d0','#f3c6a9','#eaa884','#df875e','#cc673e','#b64928','#8c301c'];
export default function Calendar({area,selected,onSelect}:{area:AreaResult;selected:string;onSelect:(s:string)=>void}){
  const [mode,setMode]=useState<'harm'|'raw'|'anomaly'>('harm'),[platform,setPlatform]=useState<Platform>('N'),[early,setEarly]=useState(false);
  const rows=area.months.filter(m=>early||m.month>='2003-01');
  const years=[...new Set(rows.map(m=>m.month.slice(0,4)))].reverse();
  const max=useMemo(()=>Math.max(1,...rows.map(m=>(mode==='raw'?m.raw[platform]:m.harm)??0)),[rows,mode,platform]);
  const active=area.months.find(m=>m.month===selected);
  const val=(m:Month)=>mode==='raw'?m.raw[platform]:m.harm;
  const color=(m:Month)=>{const v=val(m);if(v==null)return '#edf0f1';if(mode==='anomaly')return m.anomaly==='above'?'#b94f2e':m.anomaly==='below'?'#f9e4d5':'#e9ae8d';return v===0?'#f7f7f5':ramp[Math.min(7,Math.floor(Math.sqrt(v/max)*7.99))];};
  const status={above:'Above typical',normal:'Within typical range',below:'Below typical',missing:'No baseline'};
  const onKey=(e:React.KeyboardEvent<HTMLButtonElement>,m:Month)=>{const offsets:Record<string,number>={ArrowRight:1,ArrowLeft:-1,ArrowUp:12,ArrowDown:-12};if(!(e.key in offsets))return;e.preventDefault();const idx=rows.findIndex(x=>x.month===m.month);const target=rows[idx+offsets[e.key]];if(target){onSelect(target.month);document.getElementById('month-'+target.month)?.focus();}};
  return <section className="card calendar-card" aria-labelledby="calendar-title">
    <div className="card-heading"><div><div className="eyebrow">THE LONG VIEW</div><h2 id="calendar-title">Burning activity, month by month</h2><p>Daytime active cell-days · {mode==='raw'?`${PLATFORM_NAMES[platform]} observations`:'harmonized to the S-NPP VIIRS scale'}</p></div><button className="button secondary small" onClick={()=>download('burn-clock-area.csv',csvForArea(rows,area.clock,area.box))}><Download size={15}/> Export CSV</button></div>
    <div className="calendar-toolbar"><div className="segmented" aria-label="Calendar display">{(['harm','raw','anomaly'] as const).map(x=><button key={x} aria-pressed={mode===x} onClick={()=>setMode(x)}>{x==='harm'?'Harmonized':x==='raw'?'Raw observations':'Anomaly'}</button>)}</div>
      {mode==='raw'?<select aria-label="Raw satellite" value={platform} onChange={e=>setPlatform(e.target.value as Platform)}>{Object.entries(PLATFORM_NAMES).map(([p,name])=><option value={p} key={p}>{name}</option>)}</select>:<div className="heat-legend"><span>{mode==='anomaly'?'Below':'Less'}</span>{ramp.map(c=><i key={c} style={{background:c}}/>)}<span>{mode==='anomaly'?'Above':'More'}</span></div>}
    </div>
    <div className="calendar-body"><div className="heatmap-scroll"><div className="heatmap" role="group" aria-label="Month by year heatmap. Use arrow keys to explore months.">
      <div className="heatmap-header"><span>YEAR</span>{MONTHS.map(m=><span key={m}>{m}</span>)}</div>
      {years.map(y=><div className={'heatmap-row '+(y==='2012'?'seam-year':'')} key={y}><span className="year-label">{y}{y==='2012'&&<i title="VIIRS transition"/>}</span>{MONTHS.map((_,mi)=>{
        const m=rows.find(m=>m.month===`${y}-${String(mi+1).padStart(2,'0')}`);
        if(!m)return <span className="heat-cell empty" key={mi}/>;
        const v=val(m);const badge=area.clock.find(c=>c.year===Number(y))?.badge;const badgeLabel=Number(y)>=2021?(badge==='clock_sensitive'?'Clock-sensitive':badge==='robust'?'Within clock threshold':'Not identifiable'):null;
        const tip=`${MONTHS[mi]} ${y}: ${v==null?'No data':number(v,1)+' active cell-days'}. ${status[m.anomaly]}. Source: ${m.src==='V'?'VIIRS observed':m.src==='M'?'MODIS converted':'No data'}.${badgeLabel?' Annual clock badge: '+badgeLabel+'.':''}`;
        return <button id={'month-'+m.month} className={'heat-cell '+(selected===m.month?'selected ':'')+(v==null?'missing ':'')} key={mi} style={{backgroundColor:color(m)}} onClick={()=>onSelect(m.month)} onKeyDown={e=>onKey(e,m)} title={tip} aria-label={tip} aria-pressed={selected===m.month}>{badgeLabel&&<span aria-hidden="true" className={'cell-clock '+badge}/>}{mode==='anomaly'&&m.harm!=null?(m.anomaly==='above'?<ArrowUp size={9}/>:m.anomaly==='below'?<ArrowDown size={9}/>:<Minus size={9}/>):null}</button>;
      })}</div>)}
    </div></div>
    <aside className="month-detail" aria-live="polite">{active&&<><span className="detail-icon"><CalendarDays size={19}/></span><div className="eyebrow">SELECTED MONTH</div><h3>{MONTHS[Number(active.month.slice(5))-1]} {active.month.slice(0,4)}</h3><div className="detail-value">{number(val(active),0)}</div><span className="detail-unit">{mode==='raw'?`${PLATFORM_NAMES[platform]} active cell-days`:'VIIRS-scale active cell-days'}</span>
      <div className={'anomaly-pill '+active.anomaly}>{active.anomaly==='above'?<ArrowUp size={13}/>:active.anomaly==='below'?<ArrowDown size={13}/>:<Minus size={13}/>} {status[active.anomaly]}</div>
      {mode==='raw'&&<p className="fine-print">The baseline, bounds and source fields below describe the harmonized record, not the selected raw platform.</p>}<dl><div><dt>Historical median</dt><dd>{number(active.median)}</dd></div><div><dt>Typical range</dt><dd>{number(active.p25)}–{number(active.p75)}</dd></div><div><dt>Approx. interval</dt><dd>{number(active.lo)}–{number(active.hi)}</dd></div><div><dt>Record source</dt><dd>{active.src==='V'?'VIIRS observed':active.src==='M'?'MODIS converted':'No data'}</dd></div><div><dt>Satellites in estimate</dt><dd>{active.satellites.map(p=>PLATFORM_NAMES[p]).join(' + ')||'—'}</dd></div></dl>
      <p className="fine-print">Anomaly uses the harmonized {MONTHS[Number(active.month.slice(5))-1]} distribution, 2003–2022. Interval adds cell bounds; it is approximate.</p>
    </>}</aside></div>
    <div className="calendar-footer"><label><input type="checkbox" checked={early} onChange={e=>setEarly(e.target.checked)}/> Include early archive (2000–2002)</label><span><i className="missing-key"/> Missing observations</span><span><i className="seam-key"/> 2012: VIIRS joins the record</span><span>Corner marks: annual clock badge from 2021</span></div>
    {early&&<p className="inline-notice"><Info size={14}/> Terra-only observations before July 2002 are the least reliable; no contemporaneous VIIRS validation is possible.</p>}
    {mode==='raw'&&<p className="inline-notice"><Info size={14}/> Raw counts are not coverage-rescaled or comparable across satellites. NOAA-21 is absent from this archive.</p>}
    <div className="source-note">Source: supplied FIRMS archive tiles · aggregation by 0.25° cell · zero and missing remain distinct.</div>
  </section>;
}
