import {useEffect,useState} from 'react';
import {number} from '../data';
export default function BurnedAreaContext(){
 const [d,setData]=useState<Record<string,any>|null>(null);
 useEffect(()=>{fetch('/data/context_sources.json').then(r=>r.ok?r.json():null).then(x=>setData(x?.iforest??null)).catch(()=>{});},[]);
 if(!d?.verified)return null;
 return <section className="card burned-area-context" style={{padding:24}}><h2>What does burned-area mapping say?</h2><p>iFOREST’s published summary reports about <b data-testid="iforest-decline" data-source="context_sources.json:iforest.reported_decline_pct">{number(d.reported_decline_pct)}%</b> less Punjab burned area from {d.year_a} to {d.year_b}. It uses a different baseline and measure from fire counts or GK2A observations.</p><p>Source: <a href={d.source}>iFOREST’s {d.publication_date} summary</a>. Analysis through {d.analysis_cutoff}; the estimate may rise with later data.</p><details><summary>Details: source inconsistency</summary><p>{d.caveat}</p><a href={d.report}>Read the source report</a></details></section>;
}
