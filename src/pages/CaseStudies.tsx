import {useEffect,useState} from 'react';
import {VERDICT_SHORT,type Verdict} from '../verdict';

interface Case{id:string;title:string;season:string;months:number[];a:number;b:number;question:string;do:string;lesson:string;deep?:string;
  link:string;verdict:Verdict;verdict_label:string;sentence:string;late:string;modis:string;viirs:string;aqua:string}
const MONTHS=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

export default function CaseStudies(){
  const [data,setData]=useState<{generated_utc:string;producer:string;cases:Case[]}|null>(null),[error,setError]=useState('');
  useEffect(()=>{fetch('/data/case_studies.json').then(r=>{if(!r.ok)throw Error('Case studies could not be loaded.');return r.json();}).then(setData).catch(e=>setError(e.message));},[]);
  if(error)return <p role="alert">{error}</p>;
  if(!data)return <p className="loading-state" role="status">Loading case studies…</p>;
  const counts=data.cases.reduce<Record<string,number>>((m,c)=>(m[c.verdict]=(m[c.verdict]??0)+1,m),{});
  const kinds=Object.keys(counts).length;
  return <article className="case-studies">
    <p className="verdict-eyebrow">Case studies</p>
    <h1>Six places, {['zero','one','two','three','four','five','six'][kinds]} different answers</h1>
    <p className="home-lead">The same two timing checks give different answers in different places. That is the point: Burn Clock tells you when satellite timing changes a fire trend, and when it doesn’t.</p>
    <ul className="case-legend" aria-label="Verdicts in these case studies">{(['timing','modis','clear','unknown'] as Verdict[]).filter(v=>counts[v]).map(v=><li key={v}><span className={'v-chip verdict-'+v}>{VERDICT_SHORT[v]}</span> {counts[v]} {counts[v]===1?'place':'places'}</li>)}</ul>
    <div className="case-grid">{data.cases.map(c=><section key={c.id} className={'case-card verdict-'+c.verdict} aria-labelledby={'case-'+c.id} data-testid={'case-'+c.id}>
      <span className={'v-chip verdict-'+c.verdict} data-testid={'case-verdict-'+c.id}>{c.verdict_label}</span>
      <h2 id={'case-'+c.id}>{c.title}</h2>
      <p className="case-meta">{c.season} · {MONTHS[c.months[0]-1]}–{MONTHS[c.months[c.months.length-1]-1]} · {c.a} vs {c.b}</p>
      <p className="case-question">{c.question}</p>
      <h3>What Burn Clock finds</h3><p data-testid={'case-sentence-'+c.id}>{c.sentence}</p>
      <h3>What to do</h3><p>{c.do}</p>
      <p className="case-lesson"><strong>Lesson:</strong> {c.lesson}</p>
      <div className="case-actions"><a className="button primary" href={c.link}>Open this place</a>{c.deep&&<a className="button secondary" href={c.deep}>See the hourly evidence</a>}</div>
    </section>)}</div>
    <p className="case-source">Each verdict and sentence above is computed by the same code as the place reports ({data.producer}), from NASA FIRMS data. Built {data.generated_utc.slice(0,10)}. Open any place to change the months, years or area.</p>
  </article>;
}
