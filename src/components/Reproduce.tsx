import {PROVENANCE,reproduceURL,type ProvenanceKey} from '../provenance';
export default function Reproduce({id}:{id:ProvenanceKey}){
 const p=PROVENANCE[id];
 return <a className="reproduce-link" href={reproduceURL(p)} target="_blank" rel="noreferrer" title={`${p.source}. ${'note' in p?p.note:''}`} aria-label={`Reproduce ${p.label}: ${p.file}, line ${p.line}`}>Reproduce</a>;
}
