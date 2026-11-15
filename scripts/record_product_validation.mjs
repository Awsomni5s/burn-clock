import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';

const read=name=>JSON.parse(readFileSync(name,'utf8'));
const unit=read('unit-checks.json'),numeric=read('numeric-checks.json'),product=read('product-checks.json'),browser=read('browser-checks.json'),speed=read('performance-checks.json');
// Automated reruns must never overwrite actual participant results entered later.
const human=read('public/data/product_validation.json').human;
if(!unit.success||unit.numFailedTests||numeric.status!=='passed'||numeric.failureCount||numeric.fatal||numeric.runtimeErrors.length||product.errors.length||browser.errors.length||product.accessibility.some(a=>a.violations.length)||speed.runs.some(r=>!r.calendarUnder10Seconds))throw Error('A required software check has not passed; no passing report written.');
const manual=product.accessibility.reduce((n,a)=>n+a.incomplete.reduce((s,c)=>s+c.nodes,0),0);
const report={generatedAt:new Date().toISOString(),automated:[
 {name:'Calculation and rule tests',status:'Passed',detail:`${unit.numPassedTests}/${unit.numTotalTests} tests; independent source fixtures, missingness, annual diagnostics, deterministic guidance, claim-card context and decimal rounding boundaries.`},
 {name:'Rendered numbers and CSV',status:'Passed',detail:`${numeric.assertions.toLocaleString('en-US')}/${numeric.assertions.toLocaleString('en-US')} assertions; all six presets × 302 months × seven display modes, 1,812 harmonized month panels and CSV rows, 78 clock states, 72 country rows, validation and Methods data fields. Zero discrepancies within displayed rounding. Arbitrary rectangles and scientific inference are not exhaustively certified.`},
 {name:'Punjab evidence and product workflows',status:'Passed',detail:`${product.checks.length} workflow groups: source-count arithmetic, hourly and mask/baseline controls, both PNG exports, all four decision roles, annual markers and honest pending human results.`},
 {name:'Interaction and edge cases',status:'Passed',detail:`${browser.checks.length} workflow groups: six presets, missing values, empty/invalid/date-line areas, 2012 transition, platform coverage, outage guidance, CSV, keyboard navigation, mobile layouts and retryable load failure.`},
 {name:'Automated accessibility',status:'Passed automated rules; manual review pending',detail:`Zero WCAG 2.1 A/AA rule violations across ${product.accessibility.length} route/viewport combinations (five routes, desktop and mobile). ${manual} node-level incomplete findings across scans need manual review; these are not unique defects. Screen-reader usability and human accessibility sessions have not been run.`},
 {name:'Default-area production load',status:'Passed local lab budget',detail:speed.runs.map(r=>`${r.profile}: headline ${r.headlineMs} ms, usable calendar ${r.calendarMs} ms`).join('; ')+'. Cold Chromium contexts, one observation per profile, local production preview. Simulated mobile: 10 Mbps, 100 ms latency, 4× CPU slowdown. Calendar budget set before measurement: under 10 seconds. These are not field or real-device results.'}
],human,evidence:{numeric:'/qa/numeric-checks.json',product:'/qa/product-checks.json',interactions:'/qa/browser-checks.json',performance:'/qa/performance-checks.json',unit:'/qa/unit-checks.json'},limitations:[...numeric.exclusions,...product.limitations,speed.limits]};
mkdirSync('public/qa',{recursive:true});
for(const name of ['numeric','product','browser','performance'])writeFileSync(`public/qa/${name}-checks.json`,JSON.stringify(read(`${name}-checks.json`),null,2)+'\n');
writeFileSync('public/qa/unit-checks.json',JSON.stringify({success:unit.success,total:unit.numTotalTests,passed:unit.numPassedTests,failed:unit.numFailedTests,tests:unit.testResults.flatMap(r=>r.assertionResults.map(t=>({name:t.fullName,status:t.status})))},null,2)+'\n');
writeFileSync('public/data/product_validation.json',JSON.stringify(report,null,2)+'\n');
console.log(`Recorded ${unit.numPassedTests} tests, ${numeric.assertions} numerical assertions, ${product.accessibility.length} accessibility scans; preserved human status: ${human.status}.`);
