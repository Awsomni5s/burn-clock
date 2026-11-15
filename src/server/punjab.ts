/** Punjab district summary for the API and the Telegram bot. Same calculations as the Act on it page (src/act.ts). */
import {ALL,MIN_HOURLY,bestWindow,busiestDays,countGap,findDistrict,lateShare,passShare,sum,weekRatio,windowLabel,wording,type DistrictDoc,type WeekDoc} from '../act';
import type {Loader} from './place';

const ALIASES:Record<string,string>={mohali:'Sahibzada Ajit Singh Nagar','sas nagar':'Sahibzada Ajit Singh Nagar',nawanshahr:'Shahid Bhagat Singh Nagar','sbs nagar':'Shahid Bhagat Singh Nagar',ferozepur:'Firozpur','sri muktsar sahib':'Muktsar','muktsar sahib':'Muktsar',ropar:'Rupnagar',jullundur:'Jalandhar',malerkotla:'Sangrur',punjab:ALL,all:ALL};
const norm=(s:string)=>s.toLowerCase().normalize('NFKD').replace(/[^a-z ]/g,' ').replace(/\s+/g,' ').trim();
export function matchDistrict(doc:DistrictDoc,query:string):string|null{
  const q=norm(query);if(!q)return null;if(ALIASES[q])return ALIASES[q];
  const names=doc.districts.map(d=>d.name);
  return names.find(n=>norm(n)===q)??names.find(n=>norm(n).startsWith(q))??names.find(n=>norm(n).includes(q))??null;
}

export async function punjabSummary(query:string,load:Loader,appUrl:string,year=2025,base=2021){
  const doc=await load('punjab_districts.json') as DistrictDoc;
  const name=matchDistrict(doc,query);
  if(!name)return {status:'not_found' as const,message:`No Punjab district matches “${query}”. Districts: ${doc.districts.map(d=>d.name).sort().join(', ')}.`};
  const d=findDistrict(doc,name),v=d.gk2a_pixel_hours[year],enough=sum(v)>=MIN_HOURLY,w=bestWindow(v,3),peak=busiestDays(d,doc,year),gap=countGap(d,doc,base,year),words=wording(d,doc,base,year);
  let week:null|{window:WeekDoc['window'];aqua:number;noaa:number;ratio:number|null;fetched:string}=null;
  try{const wk=await load('punjab_week.json') as WeekDoc;const r=weekRatio(wk);const row=wk.districts.find(x=>x.name===name);
    week={window:wk.window,aqua:name===ALL?sum(wk.districts.map(x=>x.daytime.A??0)):row?.daytime.A??0,noaa:name===ALL?sum(wk.districts.map(x=>(x.daytime.J1??0)+(x.daytime.J2??0))):(row?.daytime.J1??0)+(row?.daytime.J2??0),ratio:r.ratio,fetched:wk.generated_utc};}catch{week=null;}
  const link=new URL(appUrl);link.searchParams.set('district',name);link.hash='act';
  return {status:'ok' as const,district:name,season:year,
    check_window:enough?{label:windowLabel(w.start,w.end),hours_ist:w.hours,share_pct:w.share,pass_hours_share_pct:passShare(v),late_share_pct:lateShare(v)}:null,
    busiest_two_weeks:enough&&peak.share!=null?{from:peak.from,to:peak.to,share_pct:peak.share}:null,
    count_gap:gap.ok?{base,snpp_change_pct:gap.snppChange,afternoon_change_pct:gap.gkChange,factor:gap.factor}:{reason:gap.reason},
    wording:words&&{say:words.say,dont:words.dont,why:words.why},
    this_week:week,link:link.toString(),
    limits:'GK2A pixels are ~4 km: they miss small fires and can flag hot smoke. This week’s counts are provisional NASA FIRMS detections, not unique fires.'};
}

const r0=(x:number|null|undefined)=>x==null?'—':String(Math.round(x));
/** Plain-text message (Telegram, SMS-length where possible). */
export function summaryText(s:Awaited<ReturnType<typeof punjabSummary>>){
  if(s.status!=='ok')return s.message;
  const lines=[`🔥 Burn Clock · ${s.district===ALL?'Punjab (all districts)':s.district}`];
  if(s.check_window)lines.push(`Check fields ${s.check_window.label} (India time): in ${s.season} this held ${r0(s.check_window.share_pct)}% of the afternoon fire signal. The 1–2 pm satellite hour held ${r0(s.check_window.pass_hours_share_pct)}%.`);
  else lines.push('Too little hourly fire signal here to suggest a check window.');
  if(s.busiest_two_weeks)lines.push(`Busiest two weeks last season: ${s.busiest_two_weeks.from}–${s.busiest_two_weeks.to}.`);
  if('factor' in s.count_gap)lines.push(`${s.count_gap.base}→${s.season}: the ~1:40 pm satellite count changed ${r0(s.count_gap.snpp_change_pct)}%, the whole afternoon ${r0(s.count_gap.afternoon_change_pct)}%.`);
  if(s.this_week)lines.push(`This week (${s.this_week.window.first_date?.slice(5)}–${s.this_week.window.last_date?.slice(5)}): Aqua (~4 pm) saw ${s.this_week.aqua}, NOAA-20/21 (~2 pm) saw ${s.this_week.noaa} daytime detections here. Punjab-wide, Aqua saw ${s.this_week.ratio==null?'—':s.this_week.ratio.toFixed(1)} per NOAA-20 detection (2013–21: about 0.2).`);
  lines.push(s.link,'Provisional satellite data, not a count of fields burned.');
  return lines.join('\n');
}
