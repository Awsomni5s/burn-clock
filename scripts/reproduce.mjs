/** Rebuild and verify all finite displayed-reference states from the supplied outputs. */
import {spawn} from 'node:child_process';
import {setTimeout as delay} from 'node:timers/promises';
const run=(cmd,args=[],env={})=>new Promise((resolve,reject)=>{const child=spawn(cmd,args,{stdio:'inherit',env:{...process.env,...env}});child.once('error',reject);child.once('exit',code=>code===0?resolve():reject(Error(`${cmd} exited ${code}`)));});
await run('python3',['scripts/verify_bundle.py']);
await run('python3',['scripts/numeric_reference.py']);
await run('python3',['pipeline/tests/claim_trend_reference.py']);
await run('npx',['vitest','run','src','--reporter=json','--outputFile=unit-checks.json']);
await run(process.execPath,['--test','scripts/fetch_live.test.mjs']);
await run(process.execPath,['scripts/build_provenance.mjs']);
await run('npm',['run','build']);
const port=4179,base=`http://127.0.0.1:${port}`;
const preview=spawn(process.execPath,['node_modules/vite/bin/vite.js','preview','--host','127.0.0.1','--port',String(port),'--strictPort'],{stdio:'inherit'});
try{let ready=false;for(let i=0;i<100;i++){try{if((await fetch(base)).ok){ready=true;break;}}catch{}await delay(100);}if(!ready)throw Error('Preview did not start');
 for(const script of ['numeric_browser_checks.mjs','addendum_numeric_checks.mjs','polish_checks.mjs'])await run(process.execPath,['scripts/'+script],{BURN_CLOCK_URL:base});
 console.log('Reproduction checks passed for the shipped-output reference states. Raw pipeline and human study remain separate.');
}finally{preview.kill('SIGTERM');}
