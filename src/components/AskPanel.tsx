import {useEffect,useState} from 'react';

interface Answer{status:'ok'|'unverified'|'error';answer:string;tools:{name:string;input:unknown}[];unverified:number[];model:string}
const EXAMPLES=['Punjab says farm fires fell 93% since 2021. Can I trust that?','When should field teams check for fires in Sangrur?','Is burning happening later than usual in California this week?'];
const linkify=(t:string)=>t.split(/(https?:\/\/\S+)/g).map((p,i)=>/^https?:\/\//.test(p)?<a key={i} href={p.replace(/[).,]+$/,'')}>{p.replace(/^https?:\/\/[^/]+/,'').replace(/[).,]+$/,'')||'link'}</a>:p);

/** Ask Burn Clock: shown only when the server says the assistant is switched on. */
export default function AskPanel({compact=false}:{compact?:boolean}){
  const [on,setOn]=useState(false),[q,setQ]=useState(''),[busy,setBusy]=useState(false),[a,setA]=useState<Answer|null>(null),[err,setErr]=useState('');
  useEffect(()=>{fetch('/api/ask').then(r=>r.ok?r.json():null).then(d=>setOn(!!d?.configured)).catch(()=>setOn(false));},[]);
  if(!on)return null;
  const send=async(text:string)=>{if(!text.trim())return;setBusy(true);setErr('');setA(null);
    try{const r=await fetch('/api/ask',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({question:text})});const j=await r.json();if(!r.ok)throw Error(j.message||'The assistant could not answer.');setA(j);}catch(e){setErr(e instanceof Error?e.message:'The assistant could not answer.');}finally{setBusy(false);}};
  return <section className={'ask-panel'+(compact?' compact':'')} aria-labelledby="ask-title" data-testid="ask-panel">
    <h2 id="ask-title">Ask Burn Clock</h2>
    <p>Ask in plain words. Answers use only Burn Clock’s own checks and data, and every number is checked against that data before you see it.</p>
    <form onSubmit={e=>{e.preventDefault();send(q);}}><label htmlFor="ask-input" className="visually-hidden">Your question</label><input id="ask-input" value={q} maxLength={500} onChange={e=>setQ(e.target.value)} placeholder="e.g. Is the fire drop in my district real?"/><button className="button primary" disabled={busy||!q.trim()}>{busy?'Checking…':'Ask'}</button></form>
    <div className="ask-examples">{EXAMPLES.map(x=><button key={x} type="button" className="link-button" onClick={()=>{setQ(x);send(x);}}>{x}</button>)}</div>
    {err&&<p role="alert">{err}</p>}
    {a&&<div className={'ask-answer ask-'+a.status} role="status" data-testid="ask-answer"><p>{linkify(a.answer)}</p>
      <p className="ask-check">{a.status==='ok'?'✓ Every number above was checked against Burn Clock data.':a.status==='unverified'?`⚠️ These numbers could not be checked against Burn Clock data: ${a.unverified.join(', ')}. Treat them with care.`:''}</p>
      {a.tools.length>0&&<details><summary>What it looked up</summary><ul>{a.tools.map((t,i)=><li key={i}><code>{t.name}</code> {JSON.stringify(t.input)}</li>)}</ul><p className="plain-limit">Model: {a.model} (Anthropic Claude). AI-written wording; the numbers come from Burn Clock’s code.</p></details>}</div>}
  </section>;
}
