/** Live check for every preset and supported country -> public/data/live/world_live.json (run after fetch_live_cells.py). */
import {readFileSync,writeFileSync} from 'node:fs';
import {gunzipSync} from 'node:zlib';
import {computeLiveWorld} from '../api/_lib/server.mjs';
const load=async p=>{const b=readFileSync('public/data/'+p);return JSON.parse((b[0]===0x1f&&b[1]===0x8b?gunzipSync(b):b).toString('utf8'));};
const doc=await computeLiveWorld(load);
writeFileSync('public/data/live/world_live.json',JSON.stringify(doc,null,1)+'\n');
const n=s=>doc.areas.filter(a=>a.status===s).length;
console.log(`areas ${doc.areas.length}: later ${n('signal')}, normal ${n('within')}, Aqua sees less ${n('below')}, can't tell ${n('unknown')}`);
console.log(doc.areas.filter(a=>a.status==='signal').map(a=>`${a.name} ${a.ratio.toFixed(2)} [${a.low.toFixed(2)}–${a.high.toFixed(2)}]`).join('\n'));
