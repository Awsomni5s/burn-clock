import {useState} from 'react';
import {Download,Lightbulb} from 'lucide-react';
import type {AreaResult,Manifest} from '../types';
import {PLATFORM_NAMES} from '../types';
import {number} from '../data';
import {areaInsight,ROLES,type Role} from '../insights';
import {saveClaimCard} from '../claimCard';
export default function SoWhat({area,selected,name,manifest,error}:{area:AreaResult|null;selected:string;name:string;manifest:Manifest;error?:string}){
 const [role,setRole]=useState<Role>('air'),[status,setStatus]=useState('');
 const month=area?.months.find(m=>m.month===selected),clock=area?.clock.find(c=>c.year===Number(selected.slice(0,4)));
 const insight=areaInsight({area,month,clock,manifest,role,error});
 const save=async()=>{if(!area||!month||month.harm==null)return;try{setStatus('Preparing image…');await saveClaimCard({title:`${name} · ${selected}: ${insight.title}`,context:`Harmonized daytime activity · box south/west/north/east: ${area.box.join(', ')}`,lines:[`${selected}: ${number(month.harm)} active cell-days on the S-NPP scale; approximate summed bounds ${number(month.lo)}–${number(month.hi)}. These are observations, not unique fires.`,`Source: ${month.src==='M'?'MODIS converted':'VIIRS observed'}; ${month.satellites.map(p=>PLATFORM_NAMES[p]).join(' + ')}. Annual clock badge: ${clock?.badge??'not_identifiable'}.`,insight.meaning,insight.action,...insight.notes],source:'Source: supplied FIRMS calendar and clock tiles · area cell centers · approximate bounds, not a calibrated area interval',url:location.href},'burn-clock-area-claim');setStatus('Claim card saved. Keep the evidence and context together.');}catch(e){setStatus(e instanceof Error?e.message:'Card export failed.');}};
 return <section className="card so-what" aria-labelledby="so-what-title" data-rule={insight.rule}><div className="insight-top"><div><span className="eyebrow"><Lightbulb size={14}/> SO WHAT? · HARMONIZED RECORD</span><h2 id="so-what-title">{insight.title}</h2></div><label>Use this for<select aria-label="Decision role" value={role} onChange={e=>setRole(e.target.value as Role)}>{Object.entries(ROLES).map(([v,n])=><option key={v} value={v}>{n}</option>)}</select></label></div><p className="insight-meaning">{insight.meaning}</p><div className="insight-action"><strong>Next step</strong><p>{insight.action}</p></div>{insight.notes.length>0&&<ul>{insight.notes.map(n=><li key={n}>{n}</li>)}</ul>}<div className="insight-footer"><span>Fixed rules from the selected data · <a href="#methods">Read the rules and test status</a></span><button className="button secondary small" disabled={!month||month.harm==null||!!error} onClick={save}><Download size={14}/> Save area claim card</button></div><p role="status" className="export-status">{status}</p></section>;
}
