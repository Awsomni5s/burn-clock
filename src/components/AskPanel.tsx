import {useEffect,useRef,useState} from 'react';

interface Answer{status:'ok'|'unverified'|'error';answer:string;tools:{name:string;input:unknown}[];unverified:number[];model:string}
type Turn={role:'user'|'assistant';content:string;meta?:Answer};
const ROLES:[string,string][]=[['policy','I send field teams or enforce rules'],['air','I forecast air quality'],['journalist','I report or check claims'],['research','I study fire trends'],['public','I live with the smoke']];
const EXAMPLES:Record<string,string[]>={
  policy:['When should my teams check fields in Sangrur, and where should they go this week?','Can we say burning fell 93% in Punjab since 2021?'],
  air:['How should I adjust fire emissions timing for Punjab this season?','Is burning later than usual in Punjab this week?'],
  journalist:['Punjab says farm fires fell 93% since 2021. What can I accurately write?','Is the fire drop in Kalimantan since 2019 real?'],
  research:['Which record should I use for a 2003–2025 fire trend in Cerrado?','How reliable is the harmonized record, and where does it fail?'],
  public:['Is burning near Ludhiana happening later in the day now?','Why do some say Punjab’s fires fell when smoke is still bad?'],
};
const PAGE_NAMES:Record<string,string>={act:'Punjab planner',methods:'Methods',validation:'Validation',cases:'Case studies',clock:'Where it matters',receipt:'Punjab evidence',api:'Data and API',claim:'Check a claim',home:'Fire calendar',explorer:'Full report'};
const friendly=(u:string)=>{try{const x=new URL(u,location.origin);const page=x.hash.slice(1)||'home',d=x.searchParams.get('district');return `Open the ${PAGE_NAMES[page]??'page'}${d?`: ${d}`:''} →`;}catch{return 'Open →';}};
const linkify=(t:string)=>t.split(/((?:https?:\/\/\S+)|(?:\/\?[^\s)]+#[a-z]+)|(?:(?<=\s|^)#(?:act|methods|validation|cases|clock|receipt|api|claim)\b))/g).map((p,i)=>{if(!p)return p;const clean=p.replace(/[).,]+$/,'');if(/^(https?:\/\/|\/\?|#)/.test(clean)&&(/^https?:\/\//.test(clean)?new URL(clean).host===location.host||true:true))return /^https?:\/\//.test(clean)&&new URL(clean).host!==location.host?<a key={i} href={clean} target="_blank" rel="noopener noreferrer">{clean.replace(/^https?:\/\//,'')}</a>:<a key={i} href={clean.replace(/^https?:\/\/[^/]+/,'')} className="ask-open">{friendly(clean)}</a>;return p;});

/** “Ask what to do”: a role-aware advisor. Shown only when the server says it is switched on. */
export default function AskPanel({compact=false,offText,initialRole,context}:{compact?:boolean;offText?:string;initialRole?:string;context?:string}){
  const [on,setOn]=useState(false),[q,setQ]=useState(''),[role,setRole]=useState(initialRole??'policy'),[busy,setBusy]=useState(false),[turns,setTurns]=useState<Turn[]>([]),[err,setErr]=useState('');
  const end=useRef<HTMLDivElement>(null);
  useEffect(()=>{fetch('/api/ask').then(r=>r.ok?r.json():null).then(d=>setOn(!!d?.configured)).catch(()=>setOn(false));},[]);
  useEffect(()=>{if(turns.length)end.current?.scrollIntoView({block:'nearest'});},[turns]);
  if(!on)return offText?<p className="ask-off" role="status">{offText}</p>:null;
  const send=async(text:string)=>{if(!text.trim()||busy)return;setBusy(true);setErr('');const history=turns.map(t=>({role:t.role,content:t.content}));setTurns(t=>[...t,{role:'user',content:text}]);setQ('');
    try{const r=await fetch('/api/ask',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({question:text,history,role,context:context?`${context}; local time now ${new Date().toLocaleString('en-GB',{dateStyle:'medium',timeStyle:'short'})} (${Intl.DateTimeFormat().resolvedOptions().timeZone})`:undefined})});const j=await r.json();if(!r.ok)throw Error(j.message||'The assistant could not answer.');setTurns(t=>[...t,{role:'assistant',content:j.answer,meta:j}]);}
    catch(e){setErr(e instanceof Error?e.message:'The assistant could not answer.');setTurns(t=>t.slice(0,-1));setQ(text);}finally{setBusy(false);}};
  const lastAnswer=[...turns].reverse().find(t=>t.role==='assistant');
  return <section className={'ask-panel'+(compact?' compact':'')} aria-labelledby="ask-title" data-testid="ask-panel">
    <h2 id="ask-title">Ask what to do</h2>
    <p>Tell it your job and your place. It answers with steps for your role, using only Burn Clock’s data, and every number is checked against that data before you see it.</p>
    <div className="ask-roles" role="radiogroup" aria-label="Your role">{ROLES.map(([k,label])=><button key={k} type="button" role="radio" aria-checked={role===k} className={role===k?'on':''} onClick={()=>setRole(k)}>{label}</button>)}</div>
    {turns.length>0&&<div className="ask-thread" aria-live="polite">{turns.map((t,i)=><div key={i} className={'ask-turn '+t.role+(t.meta?' ask-'+t.meta.status:'')} data-testid={t.role==='assistant'&&t===lastAnswer?'ask-answer':undefined}>
      {t.role==='user'?<p><strong>You:</strong> {t.content}</p>:<><p>{linkify(t.content)}</p>
        <p className="ask-check">{t.meta?.status==='ok'?'✓ Every number above was checked against Burn Clock data.':t.meta?.status==='unverified'?`⚠️ These numbers could not be checked against Burn Clock data: ${t.meta.unverified.join(', ')}. Treat them with care.`:''}</p>
        {t.meta&&t.meta.tools.length>0&&<details><summary>What it looked up</summary><ul>{t.meta.tools.map((x,k)=><li key={k}><code>{x.name}</code> {JSON.stringify(x.input)}</li>)}</ul></details>}</>}
    </div>)}<div ref={end}/></div>}
    {busy&&<p role="status" className="loading-state">Checking the data…</p>}
    <form onSubmit={e=>{e.preventDefault();send(q);}}><label htmlFor="ask-input" className="visually-hidden">Your question</label><input id="ask-input" value={q} maxLength={500} onChange={e=>setQ(e.target.value)} placeholder={turns.length?'Ask a follow-up…':'e.g. What should my district do about late burning?'}/><button className="button primary" disabled={busy||!q.trim()}>{busy?'Checking…':'Ask'}</button></form>
    {!turns.length&&<div className="ask-examples">{EXAMPLES[role].map(x=><button key={x} type="button" className="link-button" onClick={()=>send(x)}>{x}</button>)}</div>}
    {turns.length>0&&<button type="button" className="link-button ask-reset" onClick={()=>{setTurns([]);setErr('');}}>Start over</button>}
    {err&&<p role="alert">{err}</p>}
    <p className="plain-limit">AI-written wording (Anthropic Claude{lastAnswer?.meta?.model?`, ${lastAnswer.meta.model}`:''}); the numbers come from Burn Clock’s code. Questions are sent to Anthropic to answer them and are not stored by Burn Clock.</p>
  </section>;
}
