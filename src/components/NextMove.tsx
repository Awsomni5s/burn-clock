import {useDeferredValue,useEffect,useMemo,useState} from 'react';
import {fetchData,number} from '../data';
import type {AreaResult,Manifest} from '../types';
import type {Polys} from '../shape'
import {computeClaim} from '../stats';
import {verdictFor,VERDICT_SHORT} from '../verdict';
import {ACTIONS} from '../roleActions';
import {ROLES,type Role} from '../insights';
import {useURLState,choice} from '../urlState';
import {calendarFacts} from './Calendar';
import {liveTiming,liveAmount,type LiveCells,type LiveStatus} from '../liveCheck';
import {useDaily,dailyValues} from './DayCalendar';
import {nextSeasons,seasonICS,thisWeekAction,VERDICT_TRUST,MONTH_NAMES,AMOUNT_CLASS,JOBS,whenPlain,TREND_HEADLINE,trendPlain,weekHeadline} from '../nextMove';

const LIVE_INLINE:Record<LiveStatus,string>={signal:'burning later than usual',within:'no shift from usual',below:'Aqua sees less than usual',unknown:'can’t tell this week'};
const LIVE:Record<LiveStatus,string>={signal:'Burning later than usual',within:'No timing shift',below:'Aqua sees less',unknown:'Can’t tell this week'};
const shortDay=(iso:string)=>new Date(iso+'T12:00:00Z').toLocaleDateString('en-GB',{day:'numeric',month:'short',timeZone:'UTC'});
const weekClass=(a:import('../liveCheck').AmountStatus|undefined,t:LiveStatus|undefined)=>!a?'unknown':(a==='below'||a==='lowest')&&t==='signal'?'timing':AMOUNT_CLASS[a];
const scrollTo=(id:string)=>()=>{const el=document.getElementById(id)??document.querySelector(`[data-testid="${id}"]`);el?.scrollIntoView({behavior:'smooth',block:'start'});};

/** The first answer after choosing a place: when to be ready, whether the trend is real, what this week looks like, and what to do in your job. */
export default function NextMove({area,name,months,a,b,manifest,preset,polys,ask=false,onGo}:{area:AreaResult;name:string;months:number[];a:number;b:number;manifest:Manifest;preset?:string;polys?:Polys|null;ask?:boolean;onGo?:(v:'trend'|'week'|'ask')=>void}){
  const go=(v:'trend'|'week'|'ask',id:string)=>onGo?()=>onGo(v):scrollTo(id);
  const [role,setRole]=useURLState<Role>('role',preset==='punjab'?'policy':'research',choice(['policy','air','journalist','research'] as const));
  const [doc,setDoc]=useState<LiveCells|null>(null),[liveError,setLiveError]=useState(false);
  useEffect(()=>{fetchData<LiveCells>('live/week_cells.json').then(setDoc).catch(()=>setLiveError(true));},[]);
  const daily=useDaily(area.box);
  const facts=useMemo(()=>calendarFacts(area.months),[area]);
  const da=useDeferredValue(a),db=useDeferredValue(b),dm=useDeferredValue(months);
  const claim=useMemo(()=>dm.length?computeClaim(area,dm,da,db,manifest):null,[area,dm,da,db,manifest]);
  const verdict=claim?verdictFor(claim.checks):'unknown';
  const live=useMemo(()=>doc?liveTiming(doc,area.box,area.months,polys):null,[doc,area,polys]),amount=useMemo(()=>doc?liveAmount(doc,area.box,area.months,polys):null,[doc,area,polys]);  const critical=facts?.critical?.length?facts.critical:months;
  const today=new Date(),seasons=nextSeasons(critical,today),next=seasons.find(s=>s.now)??seasons[0];
  const peakDay=useMemo(()=>{if(!daily)return null;
    for(const y of [...daily.years].sort((x,z)=>z-x)){let best:{v:number;label:string;year:number}|null=null;
      for(const m of critical){const vals=dailyValues(daily,area.months,y,m);for(let i=0;i<vals.length;i++){const v=vals[i];if(v!=null&&v>0&&(!best||v>best.v))best={v,label:`${i+1} ${MONTH_NAMES[m-1].slice(0,3)}`,year:y};}}
      if(best)return best;}
    return null;},[daily,area,critical]);
  const coming=useMemo(()=>{const mean=Array(12).fill(0),n=Array(12).fill(0);for(const x of area.months){const y=Number(x.month.slice(0,4)),i=Number(x.month.slice(5))-1;if(y>=2003&&y<=2022&&x.harm!=null){mean[i]+=x.harm;n[i]++;}}
    const avg=mean.map((v,i)=>n[i]?v/n[i]:0),tot=avg.reduce((p,q)=>p+q,0),next=(today.getUTCMonth()+1)%12;return tot?{month:MONTH_NAMES[next],share:100*avg[next]/tot}:null;},[area]);
  const h=claim?.harmonized,change=h&&h.status==='ok'&&h.changePct!=null?h.changePct:null;
  const seasonLabel=critical.length?seasons.map(s=>s.label).join(' and '):'—';
  const [copied,setCopied]=useState(false);
  const peakLabel=peakDay?peakDay.label:null,job=JOBS[role];
  const whenHead=next?(next.now?'Fire season is on now':`Next fire season in ${next.daysToStart} days`):'Fire season';
  const doWhen=whenPlain(role,seasonLabel,peakLabel),doTrend=trendPlain(role,verdict),doWeek=thisWeekAction(role,amount?.status??'unknown',live?.status??'unknown');
  const weekHead=amount&&live?weekHeadline(amount.status,live.status):liveError?'Live data unavailable':'Reading this week’s NASA data…';
  const summary=()=>[`Burn Clock · ${name} · for ${job.label.toLowerCase()}`,
    `1. ${whenHead} (${seasonLabel}). Do: ${doWhen}`,
    `2. ${TREND_HEADLINE[verdict]}. Do: ${doTrend}`,
    `3. This week: ${weekHead}. Do: ${doWeek}`,
    `NASA satellite data; this week's data is provisional. ${location.href}`].join('\n');
  const copy=async()=>{try{await navigator.clipboard.writeText(summary());setCopied(true);setTimeout(()=>setCopied(false),2000);}catch{setCopied(false);}};
  const download=()=>{const ics=seasonICS({name,months:critical,share:facts?.peakShare??null,link:location.href,today});const url=URL.createObjectURL(new Blob([ics],{type:'text/calendar'}));const el=document.createElement('a');el.href=url;el.download=`burning-season-${name.replace(/[^A-Za-z0-9]+/g,'-').toLowerCase()}.ics`;el.click();setTimeout(()=>URL.revokeObjectURL(url),1000);};
  const card=(id:string,n:number,q:string,cls:string,head:string,sub:any,todo:string,why:any,extra?:any)=><article className={'nm-card verdict-'+cls} data-testid={id}>
    <p className="nm-q">{n} · {q}</p><p className="nm-big" data-testid={id+'-head'}>{head}</p><p className="nm-sub">{sub}</p>
    <p className="nm-do"><span>Do:</span> {todo}</p>{extra}<details className="nm-why"><summary>Why?</summary>{why}</details></article>;
  const weekCls=weekClass(amount?.status,live?.status);
  return <section className="next-move" aria-labelledby="next-move-title" data-testid="next-move">
    <p className="step-tag"><b>2</b> I am a…</p>
    <div className="job-picker" role="group" aria-label="I am a">{(Object.keys(JOBS) as Role[]).map(r=><button key={r} aria-pressed={role===r} className={role===r?'active':''} onClick={()=>setRole(r)} data-testid={'nm-role-'+r}><span aria-hidden="true">{JOBS[r].icon}</span>{JOBS[r].label}</button>)}</div>
    <h2 id="next-move-title" className="nm-title"><b className="step-num">3</b> Your plan for {name}, as {job.who}</h2>
    <div className="next-move-grid">
      {card('nm-when',1,'When to act','season',whenHead,<>{seasonLabel}{facts&&<> · {Math.round(facts.peakShare)}% of a normal year’s fires</>}{peakLabel&&<> · peak around {peakLabel}</>}</>,doWhen,
        <><p>{facts?<>{Math.round(facts.peakShare)}% of a typical year’s satellite fire detections (2003–2022) fall in {seasonLabel}.</>:'Season from the selected months.'}{peakDay&&<> Busiest day in {peakDay.year}: {peakDay.label}.</>}{coming&&<> Next month, {coming.month} usually brings {number(coming.share,0)}% of a year’s fires.</>}</p></>,
        <button className="button secondary nm-btn" onClick={download} data-testid="nm-ics">Remind me before next season (.ics)</button>)}
      {card('nm-trend',2,'Can you trust the trend?',verdict,TREND_HEADLINE[verdict],change!=null?<>Satellites saw {number(Math.abs(change),0)}% {change>0?'more':'fewer'} fires, {da}→{db} ({dm.map(m=>MONTH_NAMES[m-1].slice(0,3)).join('–')})</>:VERDICT_TRUST[verdict],doTrend,
        <><p><span className={'v-chip verdict-'+verdict}>{VERDICT_SHORT[verdict]}</span> {VERDICT_TRUST[verdict]}.</p><p>{ACTIONS[verdict][role][0]}</p><button className="nm-link" onClick={go('trend','answer')}>See the two checks →</button></>)}
      {card('nm-week',3,'This week'+(doc?.window.first_date&&doc.window.last_date?` (${shortDay(doc.window.first_date)}–${shortDay(doc.window.last_date)})`:''),weekCls,weekHead,
        amount&&amount.median!=null?<>{number(amount.week,0)} fire detections vs {number(amount.median,0)} in a normal {MONTH_NAMES[amount.month-1]} week</>:amount?<>{number(amount.week,0)} fire detections this week</>:'',doWeek,
        <><p><span className={'v-chip verdict-'+weekCls} data-testid="nm-amount">{amount?weekHead:'Loading…'}</span></p>{amount&&live&&<p>{number(amount.week,0)} NOAA-20 active cell-days this week{amount.median!=null&&<>; an average {MONTH_NAMES[amount.month-1]} week in 2019–2025: {number(amount.median,0)} (range {number(amount.min!,0)}–{number(amount.max!,0)})</>}. Timing: {LIVE_INLINE[live.status]}. Provisional NASA near-real-time data.</p>}<button className="nm-link" onClick={go('week','live-title')}>This week in detail →</button></>)}
    </div>
    <p className="nm-more"><a className="nm-share" href={`https://wa.me/?text=${encodeURIComponent(summary())}`} target="_blank" rel="noopener noreferrer" data-testid="nm-whatsapp">Send my plan to WhatsApp</a><button className="nm-link" onClick={copy} data-testid="nm-copy">{copied?'Copied':'Copy my plan'}</button>{preset==='punjab'&&<a href="#act" data-testid="nm-act">Plan by district →</a>}{ask&&<button className="nm-link" onClick={go('ask','ask-panel')}>Ask a question →</button>}</p>
  </section>;
}
