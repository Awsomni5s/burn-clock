import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {dirname,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const map=await readFile(resolve(root,'src/provenance.ts'),'utf8');
const entries=[...map.matchAll(/file:'([^']+)',line:(\d+)/g)];
const files=new Set(entries.map(m=>m[1]));
const esc=s=>s.replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;');
for(const file of files){
 const source=await readFile(resolve(root,file),'utf8'),lines=source.split('\n');
 for(const m of entries.filter(m=>m[1]===file))if(!lines[Number(m[2])-1]?.trim())throw Error(`Empty or absent provenance anchor ${file}:${m[2]}`);
 const dest=resolve(root,'public/reproduce',file);await mkdir(dirname(dest),{recursive:true});
 await writeFile(dest+'.txt',source);
 await writeFile(dest+'.html',`<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>${esc(file)} · Burn Clock source</title><style>body{font:16px system-ui,sans-serif;color:#222;background:#fff;margin:24px}pre{overflow:auto;line-height:1.6;font-size:14px}code{display:block;white-space:pre;min-width:max-content}code:target{background:#fff0cf}code a{display:inline-block;width:4em;color:#555}h1{font-size:22px}p{max-width:75ch}</style><h1>${esc(file)}</h1><p>Source distributed with this build. A source link does not establish that all upstream inputs or generators are available. <a href="${esc(file.split('/').at(-1))}.txt">Download plain text</a> · <a href="/docs/ADDENDUM_IMPLEMENTATION.md">Reproduction limits</a></p><pre aria-label="Source code with line numbers">${lines.map((line,i)=>`<code id="L${i+1}"><a href="#L${i+1}" aria-label="Line ${i+1}">${i+1}</a>${esc(line)||' '}</code>`).join('')}</pre></html>`);
}
console.log(`Published ${files.size} source files with ${entries.length} checked line anchors`);
