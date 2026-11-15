/** Fetch only public seven-day NRT CSVs; never reads or modifies the archive. */
import {readFile,writeFile,mkdir,rename} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {resolve,dirname} from 'node:path';

export const FEEDS = [
  {id:'MODIS',platforms:['T','A'],url:'https://firms.modaps.eosdis.nasa.gov/data/active_fire/modis-c6.1/csv/MODIS_C6_1_Global_7d.csv'},
  {id:'N',platforms:['N'],url:'https://firms.modaps.eosdis.nasa.gov/data/active_fire/suomi-npp-viirs-c2/csv/SUOMI_VIIRS_C2_Global_7d.csv'},
  {id:'J1',platforms:['J1'],url:'https://firms.modaps.eosdis.nasa.gov/data/active_fire/noaa-20-viirs-c2/csv/J1_VIIRS_C2_Global_7d.csv'},
  {id:'J2',platforms:['J2'],url:'https://firms.modaps.eosdis.nasa.gov/data/active_fire/noaa-21-viirs-c2/csv/J2_VIIRS_C2_Global_7d.csv'},
];
export const NAMES={T:'Terra',A:'Aqua',N:'S-NPP',J1:'NOAA-20',J2:'NOAA-21'};
export function parseLine(line){
  const out=[];let value='',quoted=false;
  for(let i=0;i<line.length;i++){
    const c=line[i];
    if(c==='"'&&line[i+1]==='"'&&quoted){value+='"';i++;}
    else if(c==='"')quoted=!quoted;
    else if(c===','&&!quoted){out.push(value);value='';}else value+=c;
  }
  if(quoted)throw Error('Unclosed quoted CSV field');out.push(value);return out;
}
export const median=(values)=>{if(!values.length)return null;const a=[...values].sort((a,b)=>a-b);const n=a.length;return n%2?a[(n-1)/2]:(a[n/2-1]+a[n/2])/2;};
export function solarHour(time,longitude){
  const s=String(time).padStart(4,'0');if(!/^\d{4}$/.test(s))throw Error('Invalid acquisition time');
  const h=Number(s.slice(0,2)),m=Number(s.slice(2));if(h>23||m>59)throw Error('Invalid acquisition time');
  return ((h+m/60+longitude/15)%24+24)%24;
}
export const inside=(lat,lon,b)=>lat>=b[0]&&lat<b[2]&&(b[1]<=b[3]?(lon>=b[1]&&lon<b[3]):(lon>=b[1]||lon<b[3]));
export async function readPresets(root){
  // Read the actual app definitions; fail rather than maintain a diverging second list.
  const source=await readFile(resolve(root,'src/types.ts'),'utf8');
  const rows=[...source.matchAll(/\{id:'([^']+)',name:'([^']+)',country:'([^']+)',box:\[([^\]]+)\]/g)].map(m=>({id:m[1],name:m[2],box:m[4].split(',').map(Number)}));
  if(rows.length!==6||rows.some(r=>r.box.length!==4||!r.box.every(Number.isFinite)))throw Error('Could not read all six app preset boxes');
  return rows;
}
export function summarizeCSV(csv,feed,presets){
  const lines=csv.replace(/^\uFEFF/,'').trim().split(/\r?\n/);const header=parseLine(lines.shift()||'');
  for(const key of ['latitude','longitude','acq_date','acq_time','satellite'])if(!header.includes(key))throw Error(`Missing CSV field: ${key}`);
  const platforms={};let firstDate=null,lastDate=null,rows=0;
  for(const p of feed.platforms)platforms[p]={name:NAMES[p],detections:0,times:[],dayTimes:[],presets:Object.fromEntries(presets.map(r=>[r.id,{name:r.name,box:r.box,detections:0,times:[],dayTimes:[]}]))};
  for(const line of lines){
    if(!line.trim())continue;const values=parseLine(line);if(values.length!==header.length)throw Error('CSV row width does not match header');
    const r=Object.fromEntries(header.map((h,i)=>[h,values[i]]));
    if(r.latitude.trim()===''||r.longitude.trim()==='')throw Error('Missing CSV coordinates');
    const lat=Number(r.latitude),lon=Number(r.longitude);
    if(!Number.isFinite(lat)||Math.abs(lat)>90||!Number.isFinite(lon)||Math.abs(lon)>180||!/^\d{4}-\d{2}-\d{2}$/.test(r.acq_date))throw Error('Invalid CSV location or date');
    const p=feed.id==='MODIS'?({Terra:'T',Aqua:'A',T:'T',A:'A'}[r.satellite]):feed.id;
    if(!platforms[p])throw Error(`Unexpected satellite ${r.satellite}`);
    const h=solarHour(r.acq_time,lon),target=platforms[p];target.detections++;target.times.push(h);if(r.daynight==='D')target.dayTimes.push(h);
    for(const preset of presets)if(inside(lat,lon,preset.box)){const s=target.presets[preset.id];s.detections++;s.times.push(h);if(r.daynight==='D')s.dayTimes.push(h);}
    firstDate=firstDate===null||r.acq_date<firstDate?r.acq_date:firstDate;lastDate=lastDate===null||r.acq_date>lastDate?r.acq_date:lastDate;rows++;
  }
  const finish=t=>{t.median_local_solar_hour=median(t.times);t.daytime_detections=t.dayTimes.length;t.median_daytime_local_solar_hour=median(t.dayTimes);delete t.times;delete t.dayTimes;};
  for(const p of Object.values(platforms)){finish(p);for(const s of Object.values(p.presets))finish(s);}
  return {rows,first_observation_date:firstDate,last_observation_date:lastDate,platforms};
}
export async function fetchWithRetry(url,{fetchImpl=fetch,sleep=ms=>new Promise(r=>setTimeout(r,ms)),attempts=5}={}){
  let error;for(let i=0;i<attempts;i++){
    try{const r=await fetchImpl(url,{signal:AbortSignal.timeout(30000),headers:{'User-Agent':'BurnClock/1.0 (public NRT data snapshot)'}});if(!r.ok)throw Error(`HTTP ${r.status}`);return await r.text();}
    catch(e){error=e;if(i+1<attempts)await sleep(Math.min(1000*2**i,16000));}
  }throw error;
}
export async function buildSnapshot({presets,previous=null,fetchText=fetchWithRetry,now=new Date().toISOString()}){
  const feeds={};
  for(const feed of FEEDS){
    try{
      const text=await fetchText(feed.url);const summary=summarizeCSV(text,feed,presets);
      feeds[feed.id]={...summary,url:feed.url,status:summary.rows?'ok':'header_only',fetched_at:now,last_attempt_at:now,sha256:createHash('sha256').update(text).digest('hex'),error:null};
    }catch(e){
      const old=previous?.feeds?.[feed.id];
      feeds[feed.id]={...(old||{url:feed.url,platforms:{},rows:null,fetched_at:null}),status:old?.fetched_at?'stale':'unavailable',last_attempt_at:now,error:String(e?.message||e)};
    }
  }
  return {schema_version:1,generated_at:now,feeds,presets,provisional:true,archive_mixed:false,
    definition:'All rows returned by NASA FIRMS public seven-day near-real-time CSVs, including day and night and all published confidence levels. Raw detections, not unique fires. Bounding boxes use inclusive south/west and exclusive north/east edges.',
    time_definition:'Median of (UTC acquisition hour + longitude/15) modulo 24 for observed detections. All-observation and daytime-only medians are separate; neither describes every overpass, cloud, or nondetection.',
    freshness_note:'Snapshot refreshes only when fetch_live.mjs is run and the site is deployed. GitHub workflow is a supplied template; the current Sites remote does not execute GitHub Actions.'};
}
export async function main(){
  const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');const path=resolve(root,'public/data/live/latest.json');
  let previous=null;try{previous=JSON.parse(await readFile(path,'utf8'));}catch(e){if(e.code!=='ENOENT')throw e;}
  const snapshot=await buildSnapshot({presets:await readPresets(root),previous});
  await mkdir(dirname(path),{recursive:true});await writeFile(path+'.tmp',JSON.stringify(snapshot,null,2)+'\n');await rename(path+'.tmp',path);
  console.log(JSON.stringify({generated_at:snapshot.generated_at,feeds:Object.fromEntries(Object.entries(snapshot.feeds).map(([k,v])=>[k,{status:v.status,rows:v.rows,fetched_at:v.fetched_at,error:v.error}]))},null,2));
  if(Object.values(snapshot.feeds).some(f=>['stale','unavailable'].includes(f.status)))process.exitCode=2;
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url))await main();
