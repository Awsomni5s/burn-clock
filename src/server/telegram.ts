/** Telegram bot: commands answered from the same data and code as the site. Pure logic; HTTP lives in handlers.ts. */
import {checkPlace,parseQuery,type Loader} from './place';
import {matchDistrict,punjabSummary,summaryText} from './punjab';
import {districtAt,weekRatio,type DistrictDoc,type WeekDoc} from '../act';

export interface Store{set(chat:string,district:string):Promise<void>;del(chat:string):Promise<void>;all():Promise<Record<string,string>>}
export interface Update{message?:{chat:{id:number};text?:string;location?:{latitude:number;longitude:number}}}

export const HELP=['Burn Clock bot: when Punjab’s fires burn, and whether a fire trend is real.','',
  '/district Sangrur: check window, busiest weeks and this week’s fires for a district',
  '/week: this week across Punjab',
  '/check 30.9 75.85: verdict for any place on Earth (1° around the point, Oct–Nov 2021 vs 2025)',
  '/subscribe Sangrur: a weekly message for that district (/unsubscribe to stop)',
  'Or share your location.'].join('\n');

const verdictText=(r:Awaited<ReturnType<typeof checkPlace>>)=>r.status!=='ok'?r.message:[
  `Verdict: ${r.verdict.label}`,r.verdict.sentence,
  `Burning moved to hours the satellites miss? ${r.checks.burning_moved_later}. Older MODIS record off here? ${r.checks.older_modis_record_off}.`,
  r.live?(r.live.status==='unknown'?`This week: can’t tell (${r.live.reason}).`:`This week: Aqua ÷ NOAA-20 = ${r.live.aqua_per_noaa20?.toFixed(2)} (normal ${r.live.normal_range?.map(x=>x!.toFixed(2)).join('–')}) → ${r.live.status==='signal'?'burning probably later than usual':r.live.status==='within'?'no sign of later burning':'no sign of later burning (Aqua sees less)'}.`):'',
  r.link,'Satellite observations, not a count of fires.'].filter(Boolean).join('\n');

export async function answer(update:Update,load:Loader,appUrl:string,store:Store|null):Promise<{chat:number;text:string}|null>{
  const m=update.message;if(!m)return null;const chat=m.chat.id;
  if(m.location){
    const doc=await load('punjab_districts.json') as DistrictDoc,d=districtAt(doc,m.location.latitude,m.location.longitude);
    if(d)return {chat,text:summaryText(await punjabSummary(d,load,appUrl))};
    const q=parseQuery(new URLSearchParams({lat:String(m.location.latitude),lon:String(m.location.longitude)}));
    return {chat,text:'error' in q?q.error:verdictText(await checkPlace(q,load,appUrl))};
  }
  const text=(m.text??'').trim(),[cmdRaw,...rest]=text.split(/\s+/),cmd=cmdRaw.toLowerCase().replace(/@\w+$/,''),arg=rest.join(' ');
  if(cmd==='/start'){if(arg.startsWith('d_'))return {chat,text:summaryText(await punjabSummary(arg.slice(2).replace(/_/g,' '),load,appUrl))};return {chat,text:HELP};}
  if(cmd==='/help')return {chat,text:HELP};
  if(cmd==='/district')return {chat,text:arg?summaryText(await punjabSummary(arg,load,appUrl)):'Which district? For example: /district Sangrur'};
  if(cmd==='/week'){const wk=await load('punjab_week.json') as WeekDoc,r=weekRatio(wk);const top=[...wk.districts].sort((a,b)=>(b.daytime.A??0)-(a.daytime.A??0)).slice(0,5).map(d=>`${d.name} ${d.daytime.A??0}`).join(', ');
    return {chat,text:`This week in Punjab (${wk.window.first_date?.slice(5)}–${wk.window.last_date?.slice(5)}): Aqua, crossing at about 4 pm, recorded ${r.ratio?.toFixed(1)??'—'} fire detections per NOAA-20 detection at about 2 pm (2013–21: about 0.2). Most late-afternoon detections: ${top}.\n${appUrl.replace(/\/$/,'')}/#act\nProvisional NASA FIRMS data.`};}
  if(cmd==='/check'){const [lat,lon]=rest.map(Number);const q=parseQuery(new URLSearchParams({lat:String(lat),lon:String(lon)}));return {chat,text:'error' in q?'Send /check followed by latitude and longitude, e.g. /check 30.9 75.85':verdictText(await checkPlace(q,load,appUrl))};}
  if(cmd==='/subscribe'||cmd==='/unsubscribe'){
    if(!store)return {chat,text:'Weekly messages are not switched on for this bot yet. You can still ask /district any time.'};
    if(cmd==='/unsubscribe'){await store.del(String(chat));return {chat,text:'Stopped. You will get no more weekly messages.'};}
    const doc=await load('punjab_districts.json') as DistrictDoc,d=matchDistrict(doc,arg);
    if(!d)return {chat,text:'Which district? For example: /subscribe Sangrur'};
    await store.set(String(chat),d);return {chat,text:`Subscribed: a weekly Burn Clock message for ${d}. /unsubscribe to stop.`};
  }
  if(text)return {chat,text:HELP};
  return null;
}
