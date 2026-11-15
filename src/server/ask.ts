/** "Ask Burn Clock": Claude answers questions using only Burn Clock's own tools, and every number in the answer is
 * checked on the server against the tool results before it is shown. Needs ANTHROPIC_API_KEY. */
import {checkPlace,parseQuery,type Loader} from './place';
import {punjabSummary} from './punjab';
import {weekRatio,type WeekDoc} from '../act';
import {buildBriefing} from './briefing';

export const DEFAULT_MODEL='claude-sonnet-5-5';
export const INSTRUCTIONS=`You are Burn Clock's advisor. People come to you to decide what to do about a fire trend: field officers planning checks, air-quality forecasters setting fire inputs, reporters checking a claim, researchers choosing data, officials judging progress, and residents worried about smoke.

How to answer:
1. Work out the person's goal and role (a role may be given). If the place or role is unclear and it changes the advice, ask one short question instead of guessing.
2. Get facts from the briefing below and from the tools. Call check_place for any place on Earth (lat/lon or a box; default months October–November and years 2021 vs 2025 unless the person says otherwise). Call punjab_district for a district of Punjab, India, and punjab_week for what is happening this week.
3. Reply in this shape, under 180 words, plain text:
   - One or two sentences that answer the question directly.
   - "What to do:" then 2–4 numbered, concrete steps for this person's role (times of day, which record or satellite to use, exact wording to publish, which page or download on the site).
   - "Why:" one line with the key numbers.
   - The single most useful link from the briefing or a tool result.
Rules:
- Every number must come from the briefing or a tool result in this conversation (rounding is fine). Never use outside knowledge for numbers, dates, counts or causes. If the data cannot answer, say so and point to the page that comes closest.
- Say what numbers are: satellite observations, not individual fires, burned area or emissions. The live check is provisional. A verdict is a diagnostic, not proof of cause: do not credit or blame enforcement, weather or farmers.
- Be direct and practical. No markdown headers or tables. Stay neutral on politics.
- Never name your tools (check_place, punjab_district, punjab_week) to the person: they cannot run them. Point to the page instead, e.g. the Punjab planner (#act) for a district's check window.
- For “more or less burning than usual this week”, use this_week_vs_usual from check_place and always read it together with the live timing check.
- If someone describes a fire or smoke emergency happening now, tell them first to contact local emergency services.
- Only discuss fire records, satellites, smoke and what to do about them; politely decline anything else.`;
export const TOOLS=[
  {name:'check_place',description:'Verdict for any place on Earth: can you trust its fire trend, the two timing checks, the combined-record change and range, this week’s live timing check, and whether this week has more or less burning than an average week of the same month (this_week_vs_usual). Give lat/lon (with optional radius_deg 0.25–5) or box.',
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
export interface AskOptions{history?:{role:'user'|'assistant';content:string}[];role?:string}
const ROLE_NAMES:Record<string,string>={policy:'monitors or enforces burning rules (field teams, district officials)',air:'forecasts air quality or models smoke emissions',journalist:'reports news or checks claims',research:'studies fire trends',public:'is a resident or member of the public worried about smoke'};
export async function ask(question:string,env:Record<string,string|undefined>,load:Loader,appUrl:string,fetchImpl:typeof fetch=fetch,opts:AskOptions={}):Promise<AskResult>{
  const model=env.ANTHROPIC_MODEL||DEFAULT_MODEL,tools:{name:string;input:unknown}[]=[],sources:string[]=[];
  let briefing='{}';try{briefing=JSON.stringify(await buildBriefing(load,appUrl));}catch{/* answer from tools only */}
  sources.push(briefing);
  const system=[{type:'text',text:INSTRUCTIONS},{type:'text',text:`<burn_clock_briefing>\n${briefing}\n</burn_clock_briefing>`,cache_control:{type:'ephemeral'}}];
  const toolDefs=TOOLS.map((t,i)=>i===TOOLS.length-1?{...t,cache_control:{type:'ephemeral'}}:t);
  const call=async(messages:Msg[])=>{const r=await fetchImpl('https://api.anthropic.com/v1/messages',{method:'POST',headers:{'x-api-key':env.ANTHROPIC_API_KEY!,'anthropic-version':'2023-06-01','content-type':'application/json'},body:JSON.stringify({model,max_tokens:900,system,tools:toolDefs,messages})});
    if(!r.ok)throw Error(`Claude API ${r.status}`);return r.json() as Promise<{content:any[];stop_reason:string}>;};
  const history=(opts.history??[]).filter(m=>(m.role==='user'||m.role==='assistant')&&typeof m.content==='string'&&m.content.trim()).slice(-8).map(m=>({role:m.role,content:m.content.slice(0,1500)}));
  while(history.length&&history[0].role!=='user')history.shift();
  const fixed:Msg[]=[];for(const m of history){if(fixed.length&&fixed[fixed.length-1].role===m.role)fixed[fixed.length-1]={role:m.role,content:fixed[fixed.length-1].content+'\n'+m.content};else fixed.push(m);}
  if(fixed.length&&fixed[fixed.length-1].role==='user')fixed.pop();
  const role=opts.role&&ROLE_NAMES[opts.role]?`(My role: someone who ${ROLE_NAMES[opts.role]}.) `:'';
  const messages:Msg[]=[...fixed,{role:'user',content:role+question}];
  const asked=[question,...history.filter(m=>m.role==='user').map(m=>m.content)].join(' ');
  let final='';
  for(let round=0;round<5;round++){
    const res=await call(messages);messages.push({role:'assistant',content:res.content});
    const uses=res.content.filter((c:any)=>c.type==='tool_use');
    if(res.stop_reason!=='tool_use'||!uses.length){final=res.content.filter((c:any)=>c.type==='text').map((c:any)=>c.text).join('\n').trim();break;}
    const results=[];for(const u of uses){tools.push({name:u.name,input:u.input});let out:unknown;try{out=await runTool(u.name,u.input,load,appUrl);}catch(e){out={status:'error',message:e instanceof Error?e.message:String(e)};}const s=JSON.stringify(out);sources.push(s);results.push({type:'tool_result',tool_use_id:u.id,content:s.slice(0,12000)});}
    messages.push({role:'user',content:results});
  }
  if(!final)return {status:'error',answer:'No answer could be produced. Try the place search on the site.',tools,unverified:[],model};
  let bad=unverified(final,sources,asked);
  if(bad.length){ // one retry, told exactly which numbers failed the check
    messages.push({role:'user',content:`These numbers in your answer do not appear in the briefing or any tool result: ${bad.join(', ')}. Rewrite the answer using only numbers from the briefing or the tool results.`});
    const res=await call(messages);const retry=res.content.filter((c:any)=>c.type==='text').map((c:any)=>c.text).join('\n').trim();
    if(retry){final=retry;bad=unverified(final,sources,asked);}
  }
  return {status:bad.length?'unverified':'ok',answer:final,tools,unverified:bad,model};
}
