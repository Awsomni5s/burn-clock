import {useEffect,useMemo,useState} from 'react';
import {number} from '../data';
import type {Month} from '../types';

export interface DailyDoc{preset:string;box:number[];years:number[];unit:string;method:string;script:string;series:Record<string,{viirs:(number|null)[]|null;modis:(number|null)[]}>}
const MONTHS=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const ramp=['#fff5eb','#fee6ce','#fdd0a2','#fdae6b','#fd8d3c','#e6550d','#b13a0b','#7f2704'];
const doy=(y:number,m:number,d:number)=>Math.round((Date.UTC(y,m-1,d)-Date.UTC(y,0,1))/864e5);
const dim=(y:number,m:number)=>new Date(Date.UTC(y,m,0)).getUTCDate();

/** A month's harmonized value spread over its days by the observed daily pattern of the month's source satellites. */
export function dailyValues(doc:DailyDoc,months:Month[],year:number,month:number):(number|null)[]{
  const mo=months.find(x=>x.month===`${year}-${String(month).padStart(2,'0')}`),s=doc.series[String(year)];
  const n=dim(year,month);if(!mo||mo.harm==null||!s)return Array(n).fill(null);
  const raw=(mo.src==='V'&&s.viirs?s.viirs:s.modis).slice(doy(year,month,1),doy(year,month,1)+n);
  const total=raw.reduce<number>((a,v)=>a+(v??0),0);
  return raw.map(v=>v==null?null:total?mo.harm!*v/total:0);
}

export function useDaily(box:number[]){
  const [doc,setDoc]=useState<DailyDoc|null>(null);
  const match=box.join(',')==='27.6,73.8,32.6,77.6';
  useEffect(()=>{if(!match){setDoc(null);return;}fetch('/data/daily/punjab.json').then(r=>r.ok?r.json():null).then(setDoc).catch(()=>setDoc(null));},[match]);
  return doc;
}

/** Year × day heatmap for the selected season. */
export default function DayCalendar({doc,months,season,years}:{doc:DailyDoc;months:Month[];season:number[];years:string[]}){
  const [pick,setPick]=useState<{y:number;m:number;d:number}|null>(null);
  const cols=useMemo(()=>season.flatMap(m=>Array.from({length:31},(_,i)=>({m,d:i+1})).filter(c=>c.d<=dim(2024,c.m))),[season]);
  const grid=useMemo(()=>years.map(y=>{const yy=Number(y);const per=Object.fromEntries(season.map(m=>[m,dailyValues(doc,months,yy,m)]));return {y:yy,vals:cols.map(c=>c.d<=dim(yy,c.m)?per[c.m][c.d-1]:undefined)};}),[years,season,cols,doc,months]);
  const max=Math.max(1,...grid.flatMap(r=>r.vals.map(v=>v??0)));
  const color=(v:number|null|undefined)=>v===undefined?'transparent':v==null?'#edf0f1':v===0?'#f7f7f5':ramp[Math.min(7,Math.floor(Math.sqrt(v/max)*7.99))];
  const peak=(r:{vals:(number|null|undefined)[]})=>{let b=-1,i=-1;r.vals.forEach((v,k)=>{if(v!=null&&v>b){b=v;i=k;}});return b>0?i:-1;};
  const label=(c:{m:number;d:number})=>`${c.d} ${MONTHS[c.m-1]}`;
  const latest=grid[0],first2021=grid.find(r=>r.y===2021);
  const pv=pick?grid.find(r=>r.y===pick.y)?.vals[cols.findIndex(c=>c.m===pick.m&&c.d===pick.d)]:undefined;
  return <div className="day-calendar" data-testid="day-calendar">
    <p className="day-summary">{latest&&peak(latest)>=0&&<>Busiest day in {latest.y}: <strong>{label(cols[peak(latest)])}</strong>. </>}{first2021&&peak(first2021)>=0&&<>In 2021: <strong>{label(cols[peak(first2021)])}</strong>. </>}Outlined cell = each year’s busiest day. Click a day for its value.</p>
    <div className="heatmap-scroll"><div className="day-grid" role="group" aria-label={`Day by year heatmap, ${season.map(m=>MONTHS[m-1]).join('–')}`} style={{gridTemplateColumns:`40px repeat(${cols.length},minmax(7px,1fr))`}}>
      <span/>{cols.map((c,i)=><span key={i} className="day-head">{c.d===1||c.d===15?label(c):''}</span>)}
      {grid.map(r=>{const p=peak(r);return [<span key={'y'+r.y} className="year-label">{r.y}</span>,...r.vals.map((v,i)=>v===undefined?<span key={r.y+'-'+i}/>:<button key={r.y+'-'+i} className={'day-cell'+(i===p?' peak':'')+(v==null?' missing':'')} style={{backgroundColor:color(v)}} title={`${label(cols[i])} ${r.y}: ${v==null?'satellite outage (no data)':number(v,1)+' units'}`} aria-label={`${label(cols[i])} ${r.y}: ${v==null?'no data':number(v,1)+' units'}`} onClick={()=>setPick({y:r.y,m:cols[i].m,d:cols[i].d})} data-testid={`day-${r.y}-${cols[i].m}-${cols[i].d}`}/>)];})}
    </div></div>
    {pick&&<p className="day-pick" role="status"><strong>{pick.d} {MONTHS[pick.m-1]} {pick.y}:</strong> {pv==null?'no data (satellite outage; missing is not zero)':`${number(pv,1)} activity units on the combined scale`}.</p>}
    <p className="fine-print">Day values spread each month’s harmonized total across its days in proportion to the observed daily pattern of that month’s source satellites (VIIRS S-NPP from 2012, Terra + Aqua MODIS before), so days add up to the monthly calendar. Grey = satellite outage. Built by <code>{doc.script}</code>; daily data is shipped for Punjab + Haryana.</p>
  </div>;
}
