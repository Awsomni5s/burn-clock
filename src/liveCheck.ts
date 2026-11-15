import type {BBox,Month} from './types';
import {inside} from './data';

/** Live timing check for any place: this week's Aqua ÷ NOAA-20 cell-days (NASA FIRMS seven-day files) against the same
 * calendar month in 2013–19 (archive Aqua ÷ S-NPP), with NOAA-20 bridged to S-NPP using this area's own 2019–24 overlap. */
export interface LiveCells{generated_utc:string;window:{first_date:string|null;last_date:string|null};columns:string[];bin_deg:number;rows:number[][];median_daytime_local_solar_hour:Record<string,number|null>;feeds:Record<string,{rows:number;first_date:string|null;last_date:string|null}>;unit:string;definition:string;script:string}
export const LIVE_MIN_J1=100,LIVE_MIN_A=30;
export type LiveStatus='signal'|'within'|'below'|'unknown';
export interface LiveResult{status:LiveStatus;reason:string;month:number;aqua:number;noaa20:number;noaa21:number;bridge:number;ratio:number|null;baseline:number|null;low:number|null;high:number|null;delta:number|null;threshold:number|null;baselineYears:number}

export function liveSums(doc:LiveCells,box:BBox){
  const h=doc.bin_deg/2,s={T:0,A:0,J1:0,J2:0};
  for(const [south,west,T,A,J1,J2] of doc.rows)if(inside(south+h,west+h,box)){s.T+=T;s.A+=A;s.J1+=J1;s.J2+=J2;}
  return s;
}
export function liveTiming(doc:LiveCells,box:BBox,months:Month[]):LiveResult{
  const m=Number((doc.window.last_date??'2026-11-01').slice(5,7)),sums=liveSums(doc,box);
  const at=(y:number)=>months.find(x=>x.month===`${y}-${String(m).padStart(2,'0')}`);
  const base:number[]=[];
  for(let y=2013;y<=2019;y++){const r=at(y)?.raw;const A=r?.A,N=r?.N;if(A!=null&&N!=null&&A>0&&N>0)base.push(Math.log(A/N));}
  let sN=0,sJ=0;for(let y=2019;y<=2024;y++){const r=at(y)?.raw;if(r?.N!=null&&r?.J1!=null&&r.N>0&&r.J1>0){sN+=r.N;sJ+=r.J1;}}
  const bridge=sJ>0?sN/sJ:1;
  const empty={month:m,aqua:sums.A,noaa20:sums.J1,noaa21:sums.J2,bridge,ratio:null,baseline:null,low:null,high:null,delta:null,threshold:null,baselineYears:base.length};
  if(base.length<7)return {...empty,status:'unknown',reason:`The ${MONTHS[m-1]} 2013–19 comparison years are incomplete here.`};
  if(sums.J1<LIVE_MIN_J1)return {...empty,status:'unknown',reason:`Too few fires this week (${sums.J1} NOAA-20 cell-days; needs ${LIVE_MIN_J1}).`};
  if(sums.A<LIVE_MIN_A)return {...empty,status:'unknown',reason:`Too few Aqua cell-days this week (${sums.A}; needs ${LIVE_MIN_A}). Aqua may not have passed over much of this area.`};
  const mu=base.reduce((a,b)=>a+b,0)/base.length,sd=Math.sqrt(base.reduce((a,b)=>a+(b-mu)**2,0)/base.length),thr=Math.max(2*sd,0.15);
  const rho=Math.log(sums.A/(sums.J1*bridge)),delta=rho-mu;
  const status:LiveStatus=delta>thr?'signal':delta<-thr?'below':'within';
  return {...empty,ratio:Math.exp(rho),baseline:Math.exp(mu),low:Math.exp(mu-thr),high:Math.exp(mu+thr),delta,threshold:thr,status,reason:''};
}
export const MONTHS=['January','February','March','April','May','June','July','August','September','October','November','December'];
