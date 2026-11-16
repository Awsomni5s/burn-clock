/** Field-team plan: split N teams across this week's fire hotspots in proportion to NASA detections, and say WHEN to be there
 * only as far as the data supports it. Pure helpers (tested in fieldPlan.test.ts). */
import type {LiveStatus} from './liveCheck';

export type Square={lat:number;lon:number;n:number};
export interface Patch{lat:number;lon:number;n:number;squares:number;top:Square}

const R=6371;
export function km(a:{lat:number;lon:number},b:{lat:number;lon:number}){
  const r=Math.PI/180,dl=(b.lat-a.lat)*r,dn=(b.lon-a.lon)*r,s=Math.sin(dl/2)**2+Math.cos(a.lat*r)*Math.cos(b.lat*r)*Math.sin(dn/2)**2;
  return 2*R*Math.asin(Math.min(1,Math.sqrt(s)));
}

/** Group this week's squares into patrol areas: the busiest square seeds an area, and every square within `radiusKm` of a seed joins
 * the nearest one. One area is roughly what a team can cover from one base in a day. */
export function patches(sq:Square[],radiusKm=45):Patch[]{
  const s=[...sq].filter(x=>x.n>0).sort((a,b)=>b.n-a.n),seeds:Square[]=[],groups:Square[][]=[];
  for(const x of s){let best=-1,bd=Infinity;seeds.forEach((c,i)=>{const d=km(c,x);if(d<=radiusKm&&d<bd){bd=d;best=i;}});
    if(best<0){seeds.push(x);groups.push([x]);}else groups[best].push(x);}
  return groups.map(g=>{const n=g.reduce((a,x)=>a+x.n,0);return {lat:g.reduce((a,x)=>a+x.lat*x.n,0)/n,lon:g.reduce((a,x)=>a+x.lon*x.n,0)/n,n,squares:g.length,top:g[0]};}).sort((a,b)=>b.n-a.n);
}

/** Highest-averages (D'Hondt) split of `teams` across weights: the busiest areas get the first teams, a second team only when
 * an area has more than twice the detections of the next unstaffed one, and so on. */
export function allocate(weights:number[],teams:number):number[]{
  const out=weights.map(()=>0);const t=Math.max(0,Math.floor(teams));
  for(let k=0;k<t;k++){let bi=-1,bv=-1;weights.forEach((w,i)=>{const v=w/(out[i]+1);if(w>0&&v>bv){bv=v;bi=i;}});if(bi<0)break;out[bi]++;}
  return out;
}

export interface Place{name:string;lat:number;lon:number;pop:number}
/** Nearest named town, with its distance, so a team knows where to base. */
export function nearestPlace(lat:number,lon:number,places:Place[]):{name:string;km:number}|null{
  let best:Place|null=null,bd=Infinity;for(const p of places){const d=km({lat,lon},p);if(d<bd){bd=d;best=p;}}
  return best?{name:best.name,km:bd}:null;
}

export const clock=(h:number)=>{let hh=Math.floor(h),mm=Math.round((h-hh)*60/15)*15;if(mm===60){hh++;mm=0;}hh=((hh%24)+24)%24;const ap=hh<12?'am':'pm',h12=hh%12===0?12:hh%12;return `${h12}${mm?':'+String(mm).padStart(2,'0'):''} ${ap}`;};

/** When to be in the field, and what that rests on. Only Punjab has hourly (GK2A) data; elsewhere the advice is bounded by
 * when the satellites look (VIIRS ~1:30 pm, Aqua ~3:45 pm local) and by this week's Aqua-vs-VIIRS timing check. */
export function fieldWindow(status:LiveStatus,viirsLocal:number|null,aquaLocal:number|null,zone:string,period='this week'){
  const v=viirsLocal??13.5,a=aquaLocal??15.75,z=` ${zone}`,P=period[0].toUpperCase()+period.slice(1);
  if(status==='signal')return {when:`${clock(v)} until at least ${clock(Math.max(16,a+0.25))}`,end:Math.max(16,a+0.25),
    basis:`${P} Aqua, passing about ${clock(a)}${z}, saw more fire next to the ~${clock(v)} VIIRS satellites than in 2013–19, so burning runs later than the main passes. There is no hourly satellite record in Burn Clock for this area, so how late it goes is not measured: stay out longer if you see fires starting.`};
  if(status==='within')return {when:`${clock(v)}–${clock(a)}`,end:a,
    basis:`No sign ${period} that burning moved later. These are the hours the satellites cover (VIIRS ~${clock(v)}, Aqua ~${clock(a)}${z}); there is no hourly record here.`};
  return {when:`${clock(v)}–${clock(a)}`,end:a,
    basis:`Too little data ${period} to test whether burning moved later. These are the hours the satellites cover (VIIRS ~${clock(v)}, Aqua ~${clock(a)}${z}); there is no hourly record here.`};
}

/** Best contiguous run of `len` hours in an hourly profile (GK2A pixel-hours by IST hour). */
export function bestWindow(hours:number[],values:number[],len=3){
  const t=values.reduce((a,b)=>a+b,0);if(!t||values.length<len)return null;
  let bi=0,bs=-1;for(let i=0;i+len<=values.length;i++){const s=values.slice(i,i+len).reduce((a,b)=>a+b,0);if(s>bs){bs=s;bi=i;}}
  return {first:hours[bi],last:hours[bi+len-1],share:100*bs/t};
}

export interface Assignment{rank:number;where:string;detail:string;lat:number;lon:number;teams:number;people:number;n:number;share:number;when:string;basis:string}
export function planText({name,dates,teams,perTeam,rows,covered,uncovered,link,noun='detections'}:{name:string;dates:string;teams:number;perTeam:number;rows:Assignment[];covered:number;uncovered:number;link:string;noun?:string}){
  const staffed=rows.filter(r=>r.teams>0);
  return [`Field plan: ${name}, ${/^\d{4}-/.test(dates)?'week of '+dates:dates}`,`${teams} team${teams===1?'':'s'} × ${perTeam} = ${teams*perTeam} people, split by NASA satellite fire data (${/^\d{4}-/.test(dates)?'this week, provisional':dates}).`,'',
    ...staffed.map(r=>`${r.rank}. ${r.where}: ${r.teams} team${r.teams===1?'':'s'} (${r.people} people). ${Math.round(r.n)} ${noun} (${Math.round(r.share)}% of the area). Be there ${r.when}. Start: https://www.google.com/maps/@${r.lat.toFixed(3)},${r.lon.toFixed(3)},11z`),
    '',`Covers ${Math.round(covered)}% of the area’s fire signal${uncovered?`; ${uncovered} smaller hotspot area${uncovered===1?'':'s'} left unstaffed`:''}.`,
    'Each team: log every active fire or fresh burn with GPS, time and a photo; note what is burning and the field size; report the day’s count.',
    `Plan and evidence: ${link}`].join('\n');
}
