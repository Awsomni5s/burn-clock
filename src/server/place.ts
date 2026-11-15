/** Server-side place check: the same code the app runs in the browser, for the public API and the Telegram bot. */
import {areaTiles,createAccumulator,computeClock,validBox} from '../data';
import {computeClaim} from '../stats';
import {verdictFor,verdictSentence,VERDICT_LABEL} from '../verdict';
import {lateLabel,modisLabel} from '../labels';
import {liveTiming,type LiveCells} from '../liveCheck';
import type {AreaResult,BBox,Catalog,CalendarTile,ClockTile,Manifest} from '../types';

/** Loads a file under /data by its published path (e.g. 'manifest.json.gz') and returns parsed JSON. */
export type Loader=(path:string)=>Promise<any>;
const MONTHS=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

export async function buildArea(box:BBox,load:Loader):Promise<{area:AreaResult;manifest:Manifest}>{
  const manifest=await load('manifest.json.gz') as Manifest,catalog=await load('catalog.json') as Catalog;
  const acc=createAccumulator(manifest),names=areaTiles(manifest.tiles,box);
  const tiles=await Promise.all(names.map(n=>load(`tiles/${n}.json.gz`) as Promise<CalendarTile>));
  for(const t of tiles)acc.add(t,box);
  const clocks=await Promise.all(areaTiles(catalog.clock_tiles,box).map(n=>load(`clock/${n}.json.gz`) as Promise<ClockTile>));
  return {area:{box,...acc.finish(),clock:computeClock(clocks,box),tileCount:names.length},manifest};
}

export interface PlaceQuery{box:BBox;months:number[];a:number;b:number}
export function parseQuery(params:URLSearchParams):PlaceQuery|{error:string}{
  let box:number[]|null=null;
  if(params.get('box'))box=params.get('box')!.split(',').map(Number);
  else if(params.get('lat')&&params.get('lon')){const lat=Number(params.get('lat')),lon=Number(params.get('lon')),r=Math.min(5,Math.max(0.25,Number(params.get('radius_deg')??1)));if(Number.isFinite(lat)&&Number.isFinite(lon))box=[Math.max(-90,lat-r),Math.max(-180,lon-r),Math.min(90,lat+r),Math.min(180,lon+r)];}
  if(!box||!validBox(box))return {error:'Give box=south,west,north,east or lat=…&lon=… (optional radius_deg, 0.25–5).'};
  if((box[2]-box[0])*(((box[3]-box[1])+360)%360||360)>400)return {error:'Area too large for the API (limit 400 square degrees). Use a smaller box.'};
  const months=(params.get('months')??'10,11').split(',').map(Number);
  if(!months.length||!months.every(m=>Number.isInteger(m)&&m>=1&&m<=12))return {error:'months must be 1–12, comma-separated.'};
  const a=Number(params.get('a')??2021),b=Number(params.get('b')??2025);
  if(!Number.isInteger(a)||!Number.isInteger(b)||a<2001||b>2025||a>=b)return {error:'a and b must be years 2001–2025 with a < b.'};
  return {box:box as BBox,months:[...new Set(months)].sort((x,y)=>x-y),a,b};
}

export async function checkPlace(q:PlaceQuery,load:Loader,appUrl:string){
  const {area,manifest}=await buildArea(q.box,load);
  if(!area.cellCount)return {status:'no_data' as const,message:'No archived fire cells in this box. Empty coverage is no data, not proof of no burning.',box:q.box};
  const r=computeClaim(area,q.months,q.a,q.b,manifest),v=verdictFor(r.checks),label=q.months.length>1&&q.months.every((m,i)=>i===0||m===q.months[i-1]+1)?`${MONTHS[q.months[0]-1]}–${MONTHS[q.months.at(-1)!-1]}`:q.months.map(m=>MONTHS[m-1]).join(', ');
  let live:ReturnType<typeof liveTiming>|null=null,liveWindow=null;
  try{const cells=await load('live/week_cells.json.gz') as LiveCells;live=liveTiming(cells,q.box,area.months);liveWindow=cells.window;}catch{live=null;}
  const link=new URL(appUrl);link.searchParams.set('box',q.box.join(','));link.searchParams.set('months',q.months.join(','));link.searchParams.set('a',String(q.a));link.searchParams.set('b',String(q.b));link.hash='explorer';
  return {status:'ok' as const,box:q.box,months:q.months,a:q.a,b:q.b,cells:area.cellCount,
    verdict:{id:v,label:VERDICT_LABEL[v],sentence:verdictSentence(v,r,label)},
    checks:{burning_moved_later:lateLabel(r.checks.late),older_modis_record_off:modisLabel(r.checks.relationship),late:r.checks.late,relationship:r.checks.relationship,drivers:r.checks.drivers},
    combined_record:{status:r.harmonized.status,change_pct:r.harmonized.changePct,range_pct:r.harmonized.rangePct,unit:'daytime active 0.05° cell-days, S-NPP VIIRS scale'},
    live:live&&{window:liveWindow,status:live.status,aqua_per_noaa20:live.ratio,normal_range:live.low!=null?[live.low,live.high]:null,reason:live.reason||null},
    link:link.toString(),
    limits:'Counts are satellite observations, not individual fires, burned area or emissions. Timing checks are diagnostics, not proof of cause. The live check is provisional (NASA FIRMS seven-day files).',
    source:'Burn Clock, NASA FIRMS MODIS C6.1 and VIIRS 375 m'};
}
