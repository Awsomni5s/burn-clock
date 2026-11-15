/** "Ask Burn Clock": Claude answers questions using only Burn Clock's own tools, and every number in the answer is
 * checked on the server against the tool results before it is shown. Needs ANTHROPIC_API_KEY. */
import {checkPlace,parseQuery,type Loader} from './place';
import {punjabSummary} from './punjab';
import {weekRatio,type WeekDoc} from '../act';

export const DEFAULT_MODEL='claude-haiku-5-5';
const SYSTEM=`You are Burn Clock's assistant. Burn Clock checks whether a satellite fire trend can be trusted, given that fire satellites look at fixed times of day and burning can move to other hours.
Answer ONLY from the tool results in this conversation. Never use outside knowledge for numbers, dates, places' fire counts or causes.
Every number you write must appear in a tool result (you may round it). If the tools cannot answer, say so and suggest what the user can try on the site.
Keep answers short (under 120 words), plain English, no markdown tables. Say what the numbers are: satellite observations, not individual fires or emissions. The live check is provisional.
For places, call check_place with a latitude and longitude (or a box) and the months and years the user asks about (defaults: October–November, 2021 vs 2025).
For Punjab districts (India), call punjab_district. For "this week in Punjab", call punjab_week. End with the most useful link from the tool result.`;
export const TOOLS=[
  {name:'check_place',description:'Verdict for any place on Earth: can you trust its fire trend, the two timing checks, the combined-record change and range, and this week’s live check. Give lat/lon (with optional radius_deg 0.25–5) or box.',
    input_schema:{type:'object',properties:{lat:{type:'number'},lon:{type:'number'},radius_deg:{type:'number'},box:{type:'array',items:{type:'number'},description:'[south, west, north, east]'},months:{type:'array',items:{type:'integer'},description:'Calendar months 1–12'},a:{type:'integer',description:'First year (2001–2024)'},b:{type:'integer',description:'Second year (2002–2025)'}}}},
  {name:'punjab_district',description:'For a district of Punjab, India: best field-check window (India time), busiest two weeks, how much further the ~1:40 pm satellite count fell than the whole afternoon, safe wording, and this week’s detections.',
    input_schema:{type:'object',properties:{district:{type:'string'}},required:['district']}},
  {name:'punjab_week',description:'This week across Punjab: Aqua (~4 pm) vs NOAA-20 (~2 pm) detections and the districts with the most late-afternoon detections.',input_schema:{type:'object',properties:{}}},
];

export async function runTool(name:string,input:any,load:Loader,appUrl:string):Promise<unknown>{
  if(name==='check_place'){const p=new URLSearchParams();
    if(Array.isArray(input.box))p.set('box',input.box.join(','));else{if(input.lat!=null)p.set('lat',String(input.lat));if(input.lon!=null)p.set('lon',String(input.lon));if(input.radius_deg!=null)p.set('radius_deg',String(input.radius_deg));}
    if(Array.isArray(input.months))p.set('months',input.months.join(','));if(input.a)p.set('a',String(input.a));if(input.b)p.set('b',String(input.b));
    const q=parseQuery(p);return 'error' in q?{status:'bad_request',message:q.error}:checkPlace(q,load,appUrl);}
  if(name==='punjab_district')return punjabSummary(String(input.district??''),load,appUrl);
  if(name==='punjab_week'){const wk=await load('punjab_week.json') as WeekDoc,r=weekRatio(wk);
    return {window:wk.window,aqua_per_noaa20:r.ratio,aqua_detections:r.aqua,noaa20_detections:r.viirs,typical_2013_2021:'about 0.2',aqua_crossing_ist:wk.median_pass_ist.A,noaa20_crossing_ist:wk.median_pass_ist.J1,
      districts_by_aqua:[...wk.districts].sort((x,y)=>(y.daytime.A??0)-(x.daytime.A??0)).slice(0,8).map(d=>({district:d.name,aqua:d.daytime.A??0,noaa20_noaa21:(d.daytime.J1??0)+(d.daytime.J2??0)})),link:appUrl.replace(/\/$/,'')+'/#act'};}
  return {status:'error',message:'Unknown tool'};
}

/** Numbers in a text, ignoring list markers. */
export function numbersIn(text:string):number[]{return [...text.replace(/(\d),(\d{3})/g,'$1$2').matchAll(/(?<![\w.])[-−]?\d+(?:\.\d+)?/g)].map(m=>Number(m[0].replace('−','-')));}
/** Numbers in the answer that cannot be traced to a tool result, the question, or harmless context (years, small counts, clock hours). */
export function unverified(answer:string,sources:string[],question:string):number[]{
  const pool=[...sources.flatMap(numbersIn),...numbersIn(question)],ok=(n:number)=>{
    const a=Math.abs(n);if(Number.isInteger(n)&&(a<=12||(a>=2000&&a<=2030)))return true;
    const r=(x:number,d:number)=>Math.round(x*10**d)/10**d;
    return pool.some(p=>{const q=Math.abs(p);for(let d=0;d<=3;d++)if(r(q,d)===a||r(q*100,d)===a)return true;return false;});};
  return numbersIn(answer.replace(/https?:\/\/\S+/g,'')).filter(n=>!ok(n));
}

type Msg={role:'user'|'assistant';content:any};
export interface AskResult{status:'ok'|'unverified'|'error';answer:string;tools:{name:string;input:unknown}[];unverified:number[];model:string}
export async function ask(question:string,env:Record<string,string|undefined>,load:Loader,appUrl:string,fetchImpl:typeof fetch=fetch):Promise<AskResult>{
  const model=env.ANTHROPIC_MODEL||DEFAULT_MODEL,tools:{name:string;input:unknown}[]=[],sources:string[]=[];
  const call=async(messages:Msg[])=>{const r=await fetchImpl('https://api.anthropic.com/v1/messages',{method:'POST',headers:{'x-api-key':env.ANTHROPIC_API_KEY!,'anthropic-version':'2023-06-01','content-type':'application/json'},body:JSON.stringify({model,max_tokens:600,system:SYSTEM,tools:TOOLS,messages})});
    if(!r.ok)throw Error(`Claude API ${r.status}`);return r.json() as Promise<{content:any[];stop_reason:string}>;};
  const messages:Msg[]=[{role:'user',content:question}];
  let final='';
  for(let round=0;round<5;round++){
    const res=await call(messages);messages.push({role:'assistant',content:res.content});
    const uses=res.content.filter((c:any)=>c.type==='tool_use');
    if(res.stop_reason!=='tool_use'||!uses.length){final=res.content.filter((c:any)=>c.type==='text').map((c:any)=>c.text).join('\n').trim();break;}
    const results=[];for(const u of uses){tools.push({name:u.name,input:u.input});let out:unknown;try{out=await runTool(u.name,u.input,load,appUrl);}catch(e){out={status:'error',message:e instanceof Error?e.message:String(e)};}const s=JSON.stringify(out);sources.push(s);results.push({type:'tool_result',tool_use_id:u.id,content:s.slice(0,12000)});}
    messages.push({role:'user',content:results});
  }
  if(!final)return {status:'error',answer:'No answer could be produced. Try the place search on the site.',tools,unverified:[],model};
  let bad=unverified(final,sources,question);
  if(bad.length){ // one retry, told exactly which numbers failed the check
    messages.push({role:'user',content:`These numbers in your answer do not appear in any tool result: ${bad.join(', ')}. Rewrite the answer using only numbers from the tool results.`});
    const res=await call(messages);const retry=res.content.filter((c:any)=>c.type==='text').map((c:any)=>c.text).join('\n').trim();
    if(retry){final=retry;bad=unverified(final,sources,question);}
  }
  return {status:bad.length?'unverified':'ok',answer:final,tools,unverified:bad,model};
}
