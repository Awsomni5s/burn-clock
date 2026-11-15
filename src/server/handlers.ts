/** HTTP handlers (Web Request → Response) for the Vercel functions in /api. Bundled by scripts/build_api.mjs. */
import {gunzipSync} from 'node:zlib';
import {checkPlace,parseQuery,type Loader} from './place';
import {punjabSummary,summaryText} from './punjab';
import {answer,type Store,type Update} from './telegram';
import {ask,DEFAULT_MODEL} from './ask';

type Env=Record<string,string|undefined>;
const cache=new Map<string,Promise<any>>();
/** Reads the site's own published /data files over HTTP (the deployment is public), gunzipping when needed. */
export function originLoader(origin:string,fetchImpl:typeof fetch=fetch):Loader{
  return path=>{const key=origin+path;if(!cache.has(key))cache.set(key,(async()=>{const r=await fetchImpl(`${origin}/data/${path}`);if(!r.ok)throw Error(`${path}: HTTP ${r.status}`);const b=Buffer.from(await r.arrayBuffer());return JSON.parse((b[0]===0x1f&&b[1]===0x8b?gunzipSync(b):b).toString('utf8'));})().catch(e=>{cache.delete(key);throw e;}));return cache.get(key)!;};
}
const json=(body:unknown,status=200,maxAge=900)=>new Response(JSON.stringify(body,null,1),{status,headers:{'content-type':'application/json; charset=utf-8','access-control-allow-origin':'*','cache-control':status===200&&maxAge>0?`public, s-maxage=${maxAge}, stale-while-revalidate=86400`:'no-store'}});
const site=(request:Request,env:Env)=>env.PUBLIC_SITE_URL||new URL(request.url).origin;

export async function handleCheck(request:Request,env:Env={},loader?:Loader){
  const u=new URL(request.url),q=parseQuery(u.searchParams);
  if('error' in q)return json({status:'bad_request',message:q.error,example:`${u.origin}/api/check?box=27.6,73.8,32.6,77.6&months=10,11&a=2021&b=2025`},400);
  try{return json(await checkPlace(q,loader??originLoader(u.origin),site(request,env)));}catch(e){return json({status:'error',message:e instanceof Error?e.message:String(e)},502);}
}
export async function handlePunjab(request:Request,env:Env={},loader?:Loader){
  const u=new URL(request.url),q=u.searchParams.get('district')??'all';
  try{const s=await punjabSummary(q,loader??originLoader(u.origin),site(request,env));
    if(u.searchParams.get('format')==='text')return new Response(summaryText(s),{status:s.status==='ok'?200:404,headers:{'content-type':'text/plain; charset=utf-8','access-control-allow-origin':'*'}});
    return json(s,s.status==='ok'?200:404);}catch(e){return json({status:'error',message:e instanceof Error?e.message:String(e)},502);}
}

/** Subscriptions live in Upstash Redis (REST) when UPSTASH_REDIS_REST_URL and _TOKEN are set; otherwise there is no store. */
export function upstashStore(env:Env,fetchImpl:typeof fetch=fetch):Store|null{
  const url=env.UPSTASH_REDIS_REST_URL,token=env.UPSTASH_REDIS_REST_TOKEN;if(!url||!token)return null;
  const cmd=async(args:string[])=>{const r=await fetchImpl(url,{method:'POST',headers:{authorization:`Bearer ${token}`,'content-type':'application/json'},body:JSON.stringify(args)});if(!r.ok)throw Error('store '+r.status);return (await r.json()).result;};
  return {set:async(c,d)=>{await cmd(['HSET','burnclock:subs',c,d]);},del:async c=>{await cmd(['HDEL','burnclock:subs',c]);},all:async()=>{const a:string[]=await cmd(['HGETALL','burnclock:subs'])??[];const o:Record<string,string>={};for(let i=0;i+1<a.length;i+=2)o[a[i]]=a[i+1];return o;}};
}
async function send(env:Env,chat:number|string,text:string,fetchImpl:typeof fetch=fetch){
  const r=await fetchImpl(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendMessage`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({chat_id:chat,text,disable_web_page_preview:true})});
  return r.ok;
}
export async function handleTelegram(request:Request,env:Env,loader?:Loader,fetchImpl:typeof fetch=fetch){
  if(!env.TELEGRAM_BOT_TOKEN||!env.TELEGRAM_WEBHOOK_SECRET)return json({status:'not_configured',message:'Set TELEGRAM_BOT_TOKEN and TELEGRAM_WEBHOOK_SECRET.'},503);
  if(request.method!=='POST')return json({status:'method_not_allowed'},405);
  if(request.headers.get('x-telegram-bot-api-secret-token')!==env.TELEGRAM_WEBHOOK_SECRET)return json({status:'forbidden'},403);
  const update=await request.json() as Update,u=new URL(request.url);
  try{const load=loader??originLoader(u.origin,fetchImpl),text=update.message?.text?.trim()??'';
    if(env.ANTHROPIC_API_KEY&&text&&!text.startsWith('/')&&update.message){const chat=update.message.chat.id,limit=await allowed('tg:'+chat,env,fetchImpl);if(limit){await send(env,chat,limit,fetchImpl);return json({ok:true});}
      const r=await ask(text.slice(0,500),env,load,site(request,env),fetchImpl);await send(env,chat,r.answer+(r.status==='unverified'?`\n\n⚠️ Some numbers above could not be checked against Burn Clock data: ${r.unverified.join(', ')}. Treat them with care.`:'\n\n✓ Numbers checked against Burn Clock data.'),fetchImpl);return json({ok:true});}
    const a=await answer(update,load,site(request,env),upstashStore(env,fetchImpl));if(a)await send(env,a.chat,a.text,fetchImpl);}
  catch(e){const chat=update.message?.chat.id;if(chat)await send(env,chat,'Sorry, that failed. Please try again later.',fetchImpl);}
  return json({ok:true});
}
/** Vercel Cron calls this weekly with Authorization: Bearer CRON_SECRET. */
export async function handleDigest(request:Request,env:Env,loader?:Loader,fetchImpl:typeof fetch=fetch){
  if(!env.CRON_SECRET||request.headers.get('authorization')!==`Bearer ${env.CRON_SECRET}`)return json({status:'forbidden'},403);
  const store=upstashStore(env,fetchImpl);if(!store||!env.TELEGRAM_BOT_TOKEN)return json({status:'not_configured'},503);
  const u=new URL(request.url),load=loader??originLoader(u.origin,fetchImpl),subs=await store.all();let sent=0;
  for(const [chat,district] of Object.entries(subs)){const s=await punjabSummary(district,load,site(request,env));if(await send(env,chat,'Weekly update\n'+summaryText(s),fetchImpl))sent++;}
  return json({status:'ok',subscribers:Object.keys(subs).length,sent});
}
/** One-time setup: GET /api/telegram-setup with Authorization: Bearer TELEGRAM_WEBHOOK_SECRET registers the webhook. */
export async function handleSetup(request:Request,env:Env,fetchImpl:typeof fetch=fetch){
  if(!env.TELEGRAM_BOT_TOKEN||!env.TELEGRAM_WEBHOOK_SECRET)return json({status:'not_configured',message:'Set TELEGRAM_BOT_TOKEN and TELEGRAM_WEBHOOK_SECRET in Vercel, then redeploy.'},503);
  const u=new URL(request.url);if(request.headers.get('authorization')!==`Bearer ${env.TELEGRAM_WEBHOOK_SECRET}`&&u.searchParams.get('key')!==env.TELEGRAM_WEBHOOK_SECRET)return json({status:'forbidden'},403);
  const base=`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}`;
  const hook=await (await fetchImpl(`${base}/setWebhook`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({url:`${site(request,env)}/api/telegram`,secret_token:env.TELEGRAM_WEBHOOK_SECRET,allowed_updates:['message']})})).json();
  await fetchImpl(`${base}/setMyCommands`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({commands:[{command:'district',description:'Check window and this week for a Punjab district'},{command:'week',description:'This week across Punjab'},{command:'check',description:'Verdict for any place: /check lat lon'},{command:'subscribe',description:'Weekly message for a district'},{command:'unsubscribe',description:'Stop weekly messages'},{command:'help',description:'How to use the bot'}]})});
  return json({status:'ok',webhook:hook});
}

const hits=new Map<string,number[]>();
/** Per-instance limit (20 questions an hour per address) plus an optional daily cap kept in Upstash (ASK_DAILY_LIMIT, default 500). */
async function allowed(ip:string,env:Env,fetchImpl:typeof fetch):Promise<string|null>{
  const now=Date.now(),list=(hits.get(ip)??[]).filter(t=>now-t<3600e3),all=(hits.get('*')??[]).filter(t=>now-t<3600e3);if(list.length>=20)return 'Too many questions from this address this hour. Please try again later.';if(all.length>=Number(env.ASK_HOURLY_LIMIT||150))return 'The assistant is busy. Please try again in a while.';list.push(now);all.push(now);hits.set(ip,list);hits.set('*',all);
  if(env.UPSTASH_REDIS_REST_URL&&env.UPSTASH_REDIS_REST_TOKEN){try{const day=new Date().toISOString().slice(0,10);const r=await fetchImpl(env.UPSTASH_REDIS_REST_URL,{method:'POST',headers:{authorization:`Bearer ${env.UPSTASH_REDIS_REST_TOKEN}`,'content-type':'application/json'},body:JSON.stringify(['INCR',`burnclock:ask:${day}`])});const n=(await r.json()).result;if(n>Number(env.ASK_DAILY_LIMIT||300))return 'The assistant has reached today’s question limit. The site’s pages answer the same questions.';}catch{/* no cap if the store is down */}}
  return null;
}
/** GET → whether the assistant is switched on. POST {question} → an answer built only from Burn Clock tools, numbers checked. */
export async function handleAsk(request:Request,env:Env,loader?:Loader,fetchImpl:typeof fetch=fetch){
  const on=!!env.ANTHROPIC_API_KEY;
  if(request.method==='GET')return json({configured:on,model:on?(env.ANTHROPIC_MODEL||DEFAULT_MODEL):null},200,60);
  if(!on)return json({status:'not_configured',message:'The assistant is not switched on (ANTHROPIC_API_KEY is not set).'},503);
  if(request.method!=='POST')return json({status:'method_not_allowed'},405);
  let question='',history:any[]=[],role='';try{const b=await request.json();question=String(b.question??'').trim();history=Array.isArray(b.history)?b.history:[];role=typeof b.role==='string'?b.role:'';}catch{return json({status:'bad_request',message:'Send JSON: {"question": "…", "history"?: [...], "role"?: "policy"|"air"|"journalist"|"research"|"public"}'},400);}
  if(!question||question.length>500)return json({status:'bad_request',message:'Ask a question of up to 500 characters.'},400);
  const limit=await allowed(request.headers.get('x-forwarded-for')?.split(',')[0].trim()||'unknown',env,fetchImpl);if(limit)return json({status:'rate_limited',message:limit},429);
  const u=new URL(request.url);
  try{return json(await ask(question,env,loader??originLoader(u.origin,fetchImpl),site(request,env),fetchImpl,{history,role}),200,0);}catch(e){return json({status:'error',message:'The assistant could not answer right now.'},502);}
}
