import {useDeferredValue,useEffect,useMemo,useState} from 'react';
import {fetchData,number} from '../data';
import type {AreaResult,Manifest} from '../types';
import {computeClaim} from '../stats';
import {verdictFor,VERDICT_SHORT} from '../verdict';
import {ACTIONS} from '../roleActions';
import {ROLES,type Role} from '../insights';
import {useURLState,choice} from '../urlState';
import {calendarFacts} from './Calendar';
import {liveTiming,type LiveCells,type LiveStatus} from '../liveCheck';
import {useDaily,dailyValues} from './DayCalendar';
import {nextSeasons,seasonICS,whenAction,weekAction,ROLE_CHIPS,VERDICT_TRUST,MONTH_NAMES} from '../nextMove';

const LIVE:Record<LiveStatus,string>={signal:'Burning later than usual',within:'No timing shift',below:'Aqua sees less',unknown:'Can’t tell this week'};
const LIVE_CLASS:Record<LiveStatus,string>={signal:'timing',within:'clear',below:'modis',unknown:'unknown'};
const shortDay=(iso:string)=>new Date(iso+'T12:00:00Z').toLocaleDateString('en-GB',{day:'numeric',month:'short',timeZone:'UTC'});
const scrollTo=(id:string)=>()=>{const el=document.getElementById(id)??document.querySelector(`[data-testid="${id}"]`);el?.scrollIntoView({behavior:'smooth',block:'start'});};

/** The first answer after choosing a place: when to be ready, whether the trend is real, what this week looks like, and what to do in your job. */
export default function NextMove({area,name,months,a,b,manifest,preset,ask=false}:{area:AreaResult;name:string;months:number[];a:number;b:number;manifest:Manifest;preset?:string;ask?:boolean}){
  const [role,setRole]=useURLState<Role>('role',preset==='punjab'?'policy':'research',choice(['policy','air','journalist','research'] as const));
  const [doc,setDoc]=useState<LiveCells|null>(null),[liveError,setLiveError]=useState(false);
  useEffect(()=>{fetchData<LiveCells>('live/week_cells.json').then(setDoc).catch(()=>setLiveError(true));},[]);
  const daily=useDaily(area.box);
  const facts=useMemo(()=>calendarFacts(area.months),[area]);
  const da=useDeferredValue(a),db=useDeferredValue(b),dm=useDeferredValue(months);
  const claim=useMemo(()=>dm.length?computeClaim(area,dm,da,db,manifest):null,[area,dm,da,db,manifest]);
  const verdict=claim?verdictFor(claim.checks):'unknown';
  const live=useMemo(()=>doc?liveTiming(doc,area.box,area.months):null,[doc,area]);
  const critical=facts?.critical?.length?facts.critical:months;
  const today=new Date(),seasons=nextSeasons(critical,today),next=seasons.find(s=>s.now)??seasons[0];
  const peakDay=useMemo(()=>{if(!daily)return null;
    for(const y of [...daily.years].sort((x,z)=>z-x)){let best:{v:number;label:string;year:number}|null=null;
      for(const m of critical){const vals=dailyValues(daily,area.months,y,m);for(let i=0;i<vals.length;i++){const v=vals[i];if(v!=null&&v>0&&(!best||v>best.v))best={v,label:`${i+1} ${MONTH_NAMES[m-1].slice(0,3)}`,year:y};}}
      if(best)return best;}
    return null;},[daily,area,critical]);
  const h=claim?.harmonized,change=h&&h.status==='ok'&&h.changePct!=null?h.changePct:null;
  const seasonLabel=critical.length?seasons.map(s=>s.label).join(' and '):'—';
  const download=()=>{const ics=seasonICS({name,months:critical,share:facts?.peakShare??null,link:location.href,today});const url=URL.createObjectURL(new Blob([ics],{type:'text/calendar'}));const el=document.createElement('a');el.href=url;el.download=`burning-season-${name.replace(/[^A-Za-z0-9]+/g,'-').toLowerCase()}.ics`;el.click();setTimeout(()=>URL.revokeObjectURL(url),1000);};
  return <section className="next-move" aria-labelledby="next-move-title" data-testid="next-move">
    <div className="next-move-head"><div><p className="eyebrow">Your next move · {name}</p><h2 id="next-move-title">What this calendar means for your work</h2></div>
      <div className="role-chips" role="group" aria-label="I work on">{(Object.keys(ROLES) as Role[]).map(r=><button key={r} aria-pressed={role===r} className={role===r?'active':''} onClick={()=>setRole(r)} data-testid={'nm-role-'+r}>{ROLE_CHIPS[r]}</button>)}</div></div>
    <div className="next-move-grid">
      <article className="nm-card" data-testid="nm-when"><p className="nm-q">1 · When to be ready</p><p className="nm-big">{seasonLabel}</p>
        <p className="nm-sub">{facts?<>{Math.round(facts.peakShare)}% of a typical year’s burning (2003–2022)</>:'Season from the selected months'}{peakDay&&<>. Busiest day in {peakDay.year}: <strong>{peakDay.label}</strong></>}.{next&&<> {next.now?<strong>Under way now.</strong>:<>Next season starts in <strong>{next.daysToStart} days</strong> ({shortDay(next.start.toISOString().slice(0,10))}).</>}</>}</p>
        <p className="nm-do"><span>Do:</span> {whenAction(role,seasonLabel,facts?.peakShare??null)}</p>
        <button className="button secondary nm-btn" onClick={download} data-testid="nm-ics">Add the season to my calendar (.ics)</button></article>
      <article className={'nm-card verdict-'+verdict} data-testid="nm-trend"><p className="nm-q">2 · Is the trend real?</p><p className="nm-big"><span className={'v-chip verdict-'+verdict}>{VERDICT_SHORT[verdict]}</span></p>
        <p className="nm-sub">{VERDICT_TRUST[verdict]}.{change!=null&&<> Combined record {da}→{db}, {dm.map(m=>MONTH_NAMES[m-1].slice(0,3)).join('–')}: <strong>{change>0?'+':'−'}{number(Math.abs(change),0)}%</strong>.</>}</p>
        <p className="nm-do"><span>Do:</span> {ACTIONS[verdict][role][verdict==='timing'?{policy:2,air:1,journalist:0,research:0}[role]:0]}</p>
        <button className="nm-link" onClick={scrollTo('answer')}>Why? See the two checks ↓</button></article>
      <article className={'nm-card verdict-'+(live?LIVE_CLASS[live.status]:'unknown')} data-testid="nm-week"><p className="nm-q">3 · This week{doc?.window.first_date&&doc.window.last_date?<> ({shortDay(doc.window.first_date).split(' ')[1]===shortDay(doc.window.last_date).split(' ')[1]?shortDay(doc.window.first_date).split(' ')[0]:shortDay(doc.window.first_date)}–{shortDay(doc.window.last_date)})</>:''}</p>
        <p className="nm-big"><span className={'v-chip verdict-'+(live?LIVE_CLASS[live.status]:'unknown')}>{live?LIVE[live.status]:liveError?'Live data unavailable':'Loading…'}</span></p>
        <p className="nm-sub">{live?<>{number(live.noaa20,0)} NOAA-20 and {number(live.aqua,0)} Aqua active cell-days in NASA’s last seven days here.{live.status==='unknown'&&live.reason?' '+live.reason:''}</>:liveError?'NASA’s near-real-time files could not be read.':'Reading NASA’s last seven days…'}</p>
        <p className="nm-do"><span>Do:</span> {weekAction(role,live?.status??'unknown')}</p>
        <button className="nm-link" onClick={scrollTo('live-title')}>This week in detail ↓</button></article>
    </div>
    <p className="nm-more"><button className="nm-link" onClick={scrollTo('answer')}>All actions for your job and a one-page brief ↓</button>{preset==='punjab'&&<a href="#act" data-testid="nm-act">Punjab district planner, by district →</a>}{ask&&<button className="nm-link" onClick={scrollTo('ask-panel')}>Ask the advisor about this place ↓</button>}</p>
  </section>;
}
