import {useEffect,useState} from 'react';
import {hour,number} from '../data';
import {PLATFORMS,PLATFORM_NAMES} from '../types';
import Reproduce from './Reproduce';
type Counts={detections:number;median_local_solar_hour:number|null;daytime_detections:number;median_daytime_local_solar_hour:number|null};
type Feed={status:'ok'|'header_only'|'stale'|'unavailable';fetched_at:string|null;last_observation_date?:string|null;url:string;platforms:Record<string,Counts&{presets:Record<string,Counts>}>};
type Snapshot={generated_at:string;feeds:Record<string,Feed>;presets:{id:string;name:string}[];freshness_note:string};
type Context={snpp_cessation:{verified:boolean;effective_at:string;source:string}};
export default function LivePanel(){
 const [data,setData]=useState<Snapshot|null>(null),[context,setContext]=useState<Context|null>(null),[error,setError]=useState(''),[preset,setPreset]=useState('punjab');
 useEffect(()=>{const abort=new AbortController();Promise.all([
  fetch('/data/live/latest.json',{signal:abort.signal}).then(r=>{if(!r.ok)throw Error('Snapshot not available');return r.json();}),
  fetch('/data/context_sources.json',{signal:abort.signal}).then(r=>r.ok?r.json():null)
 ]).then(([d,c])=>{setData(d);setContext(c);}).catch(e=>{if(e.name!=='AbortError')setError('The provisional snapshot could not be loaded. The historical record is still available.');});return()=>abort.abort();},[]);
 if(error)return <section className="panel live-panel"><h2>This week (near-real-time, provisional)</h2><p role="status">{error}</p></section>;
 if(!data)return <section className="panel live-panel"><h2>This week (near-real-time, provisional)</h2><p role="status">Loading the last saved snapshot…</p></section>;
 const old=Date.now()-Date.parse(data.generated_at)>12*60*60*1000;
 return <section className="panel live-panel" aria-labelledby="live-title">
  <h2 id="live-title">This week (near-real-time, provisional)</h2>
  <p>Last snapshot attempt: <time dateTime={data.generated_at} data-testid="live-generated" data-source="live/latest.json → generated_at">{data.generated_at.replace('T',' ').replace(/\.\d+Z$/,' UTC')}</time>. {old?'This saved snapshot is older than 12 hours. ':''}A zero count in a working feed means no detections in this box, not no burning.</p>
  <label>Snapshot area <select value={preset} onChange={e=>setPreset(e.target.value)}>{data.presets.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}</select></label>
  <div className="table-scroll" tabIndex={0} role="region" aria-label="Provisional satellite detections"><table><thead><tr><th>Satellite</th><th>Detections, all day/night</th><th>Median daytime pass, local solar time</th><th>Snapshot status</th></tr></thead><tbody>
   {PLATFORMS.map(p=>{const f=data.feeds[p==='T'||p==='A'?'MODIS':p],r=f?.platforms[p]?.presets[preset];const unavailable=!f||f.status==='unavailable',empty=f?.status==='header_only';const prefix=`live/latest.json → feeds.${p==='T'||p==='A'?'MODIS':p}.platforms.${p}.presets.${preset}`;return <tr key={p}><th scope="row">{PLATFORM_NAMES[p]}</th>
    <td data-testid={`live-count-${p}`} data-source={`${prefix}.detections`}>{unavailable?'Unavailable':empty?'No new data':r?`${number(r.detections)} detections`:'Unavailable'}</td>
    <td data-testid={`live-time-${p}`} data-source={`${prefix}.median_daytime_local_solar_hour`}>{empty||unavailable||r?.median_daytime_local_solar_hour==null?'No observed daytime pass':hour(r.median_daytime_local_solar_hour)}</td>
    <td>{f?.status==='stale'?'Fetch failed; retained snapshot':empty?'CSV contains its header only':unavailable?'Fetch failed; no previous snapshot':'Fetched'}{f?.fetched_at&&<> · <time dateTime={f.fetched_at}>{f.fetched_at.slice(0,10)}</time></>} {f&&<a href={f.url}>Source CSV</a>}</td>
   </tr>;})}
  </tbody></table></div>
  {context?.snpp_cessation.verified&&data.feeds.N?.status==='header_only'&&<p><strong>S-NPP: no new data since <span data-testid="snpp-ended" data-source="context_sources.json → snpp_cessation.effective_at">{new Date(context.snpp_cessation.effective_at).toLocaleDateString('en-US',{day:'numeric',month:'short',year:'numeric',timeZone:'UTC'})}</span>.</strong> <a href={context.snpp_cessation.source}>NOAA confirms data delivery ended</a>; this fetched seven-day CSV contains only its header.</p>}
  <details><summary>Details: what these counts and times mean</summary><p>These are raw detections in the feed’s rolling seven-day window, with all published confidence levels and day/night observations. The displayed pass time uses daytime detections only: median of UTC hour + longitude ÷ 15, wrapped to a local solar day. A detection-based median does not describe every pass or show cloud and missing observations. These provisional feeds are never added to the historical merged calendar.</p><p>{data.freshness_note}</p><p><a href="/data/live/latest.json">Download snapshot</a> · <Reproduce id="liveSnapshot"/></p></details>
 </section>;
}
