import {useEffect,useMemo,useState} from 'react';
import {download,number} from '../data';
import {allocate,bestWindow,clock,fieldWindow,nearestPlace,patches,planText,type Assignment,type Place,type Square} from '../fieldPlan';
import type {LiveStatus} from '../liveCheck';
import {geometryPolys,inPolys} from '../shape';

/** "Send N people to A, B and C": split the teams you have across this week's hotspots, with a supported time window for each. */
export interface DistrictInput{name:string;week:number;lat:number;lon:number;hours:number[];values:number[]}
type Props={name:string;dates:string;period?:string;scope?:string;noun?:string}&({kind:'districts';districts:DistrictInput[]}|{kind:'squares';squares:Square[];status:LiveStatus;viirsLocal:number|null;aquaLocal:number|null;zone:string});

let placesCache:Promise<Place[]>|null=null;
const loadPlaces=()=>placesCache??=fetch('/maps/places.geojson').then(r=>r.json()).then(d=>d.features.map((f:any)=>({name:f.properties.name,pop:f.properties.pop,lon:f.geometry.coordinates[0],lat:f.geometry.coordinates[1]}))).catch(()=>[]);

let countriesCache:Promise<any[]>|null=null;const adm1Cache=new Map<string,Promise<any[]>>();
const getJSON=(u:string)=>fetch(u).then(r=>{if(!r.ok)throw Error(u);return r.json();}).then(d=>d.features as any[]).catch(()=>[] as any[]);
/** "State, Country" for a point, from the site's own Natural Earth outlines. */
async function regionOf(lat:number,lon:number):Promise<string|null>{
  const cs=await (countriesCache??=getJSON('/maps/countries.geojson'));const c=cs.find(f=>inPolys(lat,lon,geometryPolys(f.geometry)));if(!c)return null;
  const a3=c.properties.ADM0_A3;if(!adm1Cache.has(a3))adm1Cache.set(a3,getJSON(`/maps/adm1/${a3}.json`));
  const st=(await adm1Cache.get(a3)!).find(f=>{const b=f.properties.box;return (!b||(lat>=b[0]&&lat<=b[2]&&lon>=b[1]&&lon<=b[3]))&&inPolys(lat,lon,geometryPolys(f.geometry));});
  return st?`${st.properties.name}, ${c.properties.NAME}`:c.properties.NAME;
}
const key=(lat:number,lon:number)=>`${lat.toFixed(2)},${lon.toFixed(2)}`;

export default function FieldPlan(p:Props){
  const [teams,setTeams]=useState(6),[per,setPer]=useState(3),[places,setPlaces]=useState<Place[]>([]),[copied,setCopied]=useState(false),[regions,setRegions]=useState<Record<string,string>>({});
  useEffect(()=>{if(p.kind==='squares')loadPlaces().then(setPlaces);},[p.kind]);
  const plan=useMemo(()=>{
    let areas:{where:string;detail:string;lat:number;lon:number;n:number;when:string;basis:string}[];
    if(p.kind==='districts'){
      areas=p.districts.filter(d=>d.week>0).sort((a,b)=>b.week-a.week).map(d=>{const w=bestWindow(d.hours,d.values);
        return {where:d.name,detail:'district',lat:d.lat,lon:d.lon,n:d.week,
          when:w?`${clock(w.first)}–${clock(w.last)} India time`:'through the afternoon',
          basis:w?`In 2025 the hourly GK2A satellite saw ${Math.round(w.share)}% of ${d.name}’s noon–6 pm fire signal between ${clock(w.first)} and ${clock(w.last)} (its record covers noon–6 pm only).`:'No hourly record for this district.'};});
    }else{
      const win=fieldWindow(p.status,p.viirsLocal,p.aquaLocal,p.zone,p.period??'this week');
      areas=patches(p.squares).map(a=>{const pl=nearestPlace(a.lat,a.lon,places);
        const reg=regions[key(a.top.lat,a.top.lon)],near=pl&&pl.km<=60?(pl.km<10?`around ${pl.name}`:`${Math.round(pl.km)} km from ${pl.name}`):null;
        const state=reg?reg.split(',')[0]:'';
        return {where:near?`${near[0].toUpperCase()+near.slice(1)}${state?`, ${state}`:''}`:reg||`Area centred ${a.lat.toFixed(2)}°, ${a.lon.toFixed(2)}°`,
          detail:`${a.squares} hotspot square${a.squares===1?'':'s'} within ~45 km, centred ${a.lat.toFixed(2)}°, ${a.lon.toFixed(2)}°${near&&reg?` · ${reg}`:''}`,lat:a.top.lat,lon:a.top.lon,n:a.n,when:win.when,basis:win.basis};});
    }
    const total=areas.reduce((s,a)=>s+a.n,0)||1,alloc=allocate(areas.map(a=>a.n),teams);
    const rows:Assignment[]=areas.map((a,i)=>({...a,rank:i+1,teams:alloc[i],people:alloc[i]*per,share:100*a.n/total}));
    const staffed=rows.filter(r=>r.teams>0),covered=staffed.reduce((s,r)=>s+r.share,0);
    return {rows,staffed,covered,uncovered:rows.length-staffed.length};
  },[p,teams,per,places,regions]);
  useEffect(()=>{let live=true;const todo=plan.staffed.filter(r=>p.kind==='squares'&&!(key(r.lat,r.lon) in regions)).slice(0,60);
    if(!todo.length)return;Promise.all(todo.map(async r=>[key(r.lat,r.lon),await regionOf(r.lat,r.lon)] as const)).then(res=>{if(!live)return;
      setRegions(o=>{const n={...o};for(const [k,v] of res)n[k]=v??'';return n;});});return ()=>{live=false;};},[plan.staffed,p.kind]);
  const link=typeof location!=='undefined'?location.href:'https://burn-clock.vercel.app';
  const scope=p.scope??'this week’s',noun=p.noun??'detections';
  const text=planText({name:p.name,dates:p.dates,teams,perTeam:per,rows:plan.rows,covered:plan.covered,uncovered:plan.uncovered,link,noun});
  const copy=async()=>{try{await navigator.clipboard.writeText(text);setCopied(true);setTimeout(()=>setCopied(false),2000);}catch{}};
  const csv=()=>download('burn-clock-field-plan.csv','area,teams,people,detections_this_week,share_pct,be_there,start_lat,start_lon,basis\n'+plan.staffed.map(r=>[`"${r.where}"`,r.teams,r.people,r.n,r.share.toFixed(1),`"${r.when}"`,r.lat.toFixed(3),r.lon.toFixed(3),`"${r.basis.replace(/"/g,'""')}"`].join(',')).join('\n'));
  const set=(f:(v:number)=>void,max:number)=>(e:React.ChangeEvent<HTMLInputElement>)=>{const v=Math.round(Number(e.target.value));f(Number.isFinite(v)?Math.max(1,Math.min(max,v)):1);};
  return <div className="fp" data-testid="field-plan">
    <h3>Team plan: who goes where, and when</h3>
    <div className="fp-inputs">
      <label>Field teams available <input type="number" min={1} max={60} value={teams} onChange={set(setTeams,60)} data-testid="fp-teams"/></label>
      <label>People per team <input type="number" min={1} max={20} value={per} onChange={set(setPer,20)} data-testid="fp-per"/></label>
      <p className="fp-total"><strong>{teams*per} people</strong> in {teams} team{teams===1?'':'s'}, covering <strong>{number(plan.covered,0)}%</strong> of {scope} {noun}{plan.uncovered?<> ({plan.uncovered} smaller area{plan.uncovered===1?'':'s'} unstaffed)</>:null}.</p>
    </div>
    {plan.staffed.length?<table className="fp-table"><thead><tr><th>Send</th><th>Where</th><th>Why there</th><th>Be there</th></tr></thead>
      <tbody>{plan.staffed.map(r=><tr key={r.rank}><td><strong>{r.teams} team{r.teams===1?'':'s'}</strong><br/><small>{r.people} people</small></td>
        <td><a href={`https://www.google.com/maps/@${r.lat},${r.lon},11z`} target="_blank" rel="noopener noreferrer">{r.where}</a><br/><small>{r.detail}</small></td>
        <td>{number(r.n,0)} {noun}<br/><small>{number(r.share,0)}% of the area’s total</small></td>
        <td><strong>{r.when}</strong><details><summary>Why this time?</summary><p>{r.basis}</p></details></td></tr>)}</tbody></table>
      :<p>No fire detections this week to plan around.</p>}
    <p className="fp-rule"><strong>How the split works:</strong> each team goes to the busiest area still uncovered; an area gets a second team only once it has more than twice the detections of the next one (highest-averages split). {p.period&&p.period!=='this week'?<>Weights are {p.dates} fire-days from the combined MODIS + VIIRS record: use it as a guide for that month next season.</>:<>Detections are this week’s provisional NASA FIRMS counts ({p.dates}), so re-run the plan after the next refresh.</>}</p>
    <p className="fp-rule"><strong>Each team, at each site:</strong> log every active fire or fresh burn with GPS, time and a photo; note what is burning and the field size; report the day’s count. That ground count is what tells you if the trend is really falling.</p>
    <div className="fp-actions"><a className="button" href={`https://wa.me/?text=${encodeURIComponent(text)}`} target="_blank" rel="noopener noreferrer">Send the plan to WhatsApp</a>
      <button className="button secondary" onClick={copy}>{copied?'Copied':'Copy the plan'}</button>
      <button className="button secondary" onClick={csv} data-testid="fp-csv">Download (CSV)</button></div>
  </div>;
}
