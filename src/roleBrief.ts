import type {ClaimResult} from './stats';
import {verdictFor,verdictSentence,VERDICT_LABEL} from './verdict';
import {lateLabel,modisLabel} from './labels';
import {ROLES,type Role} from './insights';

const esc=(s:string)=>s.replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]!));
const pct=(x:number|null|undefined)=>x==null||!Number.isFinite(x)?'not available':`${x>0?'+':x<0?'−':''}${Math.abs(Math.round(x))}%`;

export interface BriefInput{role:Role;name:string;monthLabel:string;result:ClaimResult;actions:string[];notes:string[];link:string;dataVersion:string;today:string}
/** The same content as the place report, in the order a busy reader needs: answer, action, evidence, limits. */
export function briefSections(i:BriefInput){
  const r=i.result,v=verdictFor(r.checks),h=r.harmonized;
  const plat=(k:string)=>r.platforms.find(p=>p.platform===k);
  const evidence=[
    `Combined record (VIIRS scale), ${i.monthLabel}, ${r.a}→${r.b}: ${h.status==='ok'?`${pct(h.changePct)} (approximate range ${pct(h.rangePct?.[0])} to ${pct(h.rangePct?.[1])})`:'not available for these months'}.`,
    `S-NPP VIIRS alone: ${plat('N')?.status==='ok'?pct(plat('N')!.changePct):'not available'}. Aqua MODIS alone: ${plat('A')?.status==='ok'?pct(plat('A')!.changePct):'not available'}.`,
    `Has burning moved to hours the satellites miss? ${lateLabel(r.checks.late)}. Is the older MODIS record off here? ${modisLabel(r.checks.relationship)}.`,
  ];
  return {title:`Burn Clock brief · ${ROLES[i.role]}`,place:`${i.name} · ${i.monthLabel} · ${r.a} compared with ${r.b}`,verdict:VERDICT_LABEL[v],verdictKey:v,sentence:verdictSentence(v,r,i.monthLabel),actions:i.actions,notes:i.notes,evidence,
    limits:'Counts are satellite observations (daytime active 0.05° cell-days), not individual fires, burned area or emissions. The timing checks are diagnostics, not proof of cause. Ranges are approximate.',
    footer:`Data: NASA FIRMS MODIS C6.1 and VIIRS 375 m. Data version ${i.dataVersion}. Made ${i.today}. Open this exact view: ${i.link}`};
}
export function briefText(i:BriefInput){
  const s=briefSections(i);
  return [s.title,s.place,'',`VERDICT: ${s.verdict}`,s.sentence,'','WHAT TO DO',...s.actions.map((a,n)=>`${n+1}. ${a}`),...(s.notes.length?['','ALSO KEEP IN MIND',...s.notes.map(n=>`- ${n}`)]:[]),'','THE EVIDENCE',...s.evidence.map(e=>`- ${e}`),'','LIMITS',s.limits,'',s.footer].join('\n')+'\n';
}
const COLOR:Record<string,string>={timing:'#c2410c',modis:'#b58105',clear:'#00703c',unknown:'#6f777b'};
export function briefHtml(i:BriefInput){
  const s=briefSections(i),c=COLOR[s.verdictKey];
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(s.title)} · ${esc(i.name)}</title><style>body{font:15px/1.45 Arial,Helvetica,sans-serif;color:#0b0c0c;background:#fff;max-width:760px;margin:24px auto;padding:0 18px}h1{font-size:22px;margin:4px 0}.eyebrow{font-size:12px;letter-spacing:.08em;text-transform:uppercase;color:#505a5f;margin:0}.place{color:#383f43;margin:0 0 14px}.verdict{border:2px solid ${c};border-left:10px solid ${c};padding:12px 16px;margin:12px 0}.chip{display:inline-block;font-weight:700;font-size:20px;color:${c};margin:0 0 6px}h2{font-size:14px;text-transform:uppercase;letter-spacing:.06em;color:#505a5f;margin:18px 0 6px;border-top:1px solid #d4d8db;padding-top:10px}li{margin-bottom:5px}.small{font-size:12px;color:#505a5f;word-break:break-all}@media print{body{margin:0}a{color:inherit}}</style></head><body><p class="eyebrow">${esc(s.title)}</p><h1>${esc(i.name)}</h1><p class="place">${esc(s.place)}</p><div class="verdict"><div class="chip">${esc(s.verdict)}</div><div>${esc(s.sentence)}</div></div><h2>What to do</h2><ol>${s.actions.map(a=>`<li>${esc(a)}</li>`).join('')}</ol>${s.notes.length?`<h2>Also keep in mind</h2><ul>${s.notes.map(n=>`<li>${esc(n)}</li>`).join('')}</ul>`:''}<h2>The evidence</h2><ul>${s.evidence.map(e=>`<li>${esc(e)}</li>`).join('')}</ul><h2>Limits</h2><p>${esc(s.limits)}</p><p class="small">${esc(s.footer.replace(i.link,''))}<a href="${esc(i.link)}">${esc(i.link)}</a></p></body></html>`;
}
