/** Live timing check for every supported country (and the six presets), computed in the refresh workflow. */
import {areaTiles,createAccumulator} from '../data';
import {liveTiming,type LiveCells} from '../liveCheck';
import {PRESETS,type BBox,type CalendarTile,type Manifest} from '../types';
import type {Loader} from './place';

export async function computeLiveWorld(load:Loader){
  const manifest=await load('manifest.json.gz') as Manifest,cells=await load('live/week_cells.json.gz') as LiveCells,ranked=(await load('world_drift_ranked.json')).countries as any[];
  const tileCache=new Map<string,CalendarTile>(),tile=async(n:string)=>{let t=tileCache.get(n);if(t){tileCache.delete(n);tileCache.set(n,t);return t;}t=await load(`tiles/${n}.json.gz`) as CalendarTile;tileCache.set(n,t);if(tileCache.size>40)tileCache.delete(tileCache.keys().next().value!);return t;};
  const areas=[...PRESETS.map(p=>({id:p.id,name:p.name,kind:'preset',box:p.box as BBox})),...ranked.filter(c=>c.reliable).map(c=>({id:c.iso3,name:c.country,kind:'country',box:c.box as BBox}))];
  const out=[];
  for(const a of areas){const acc=createAccumulator(manifest);for(const n of areaTiles(manifest.tiles,a.box))acc.add(await tile(n),a.box);const months=acc.finish().months,r=liveTiming(cells,a.box,months);
    out.push({id:a.id,name:a.name,kind:a.kind,box:a.box,status:r.status,ratio:r.ratio,low:r.low,high:r.high,aqua:r.aqua,noaa20:r.noaa20,reason:r.reason||null});}
  const order={signal:0,below:2,within:1,unknown:3} as Record<string,number>;
  out.sort((x,y)=>order[x.status]-order[y.status]||(y.ratio&&y.high?y.ratio/y.high:0)-(x.ratio&&x.high?x.ratio/x.high:0));
  return {generated_utc:new Date().toISOString(),window:cells.window,month:Number((cells.window.last_date??'').slice(5,7)),areas:out,
    definition:'Same rule as the live check on place reports: this week’s Aqua ÷ NOAA-20 daytime cell-days vs Aqua ÷ S-NPP in the same month of 2013–19. Country areas are bounding rectangles and can include neighbours.',script:'scripts/build_live_world.mjs'};
}
