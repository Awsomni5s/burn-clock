import {chromium} from 'playwright';
import {writeFileSync} from 'node:fs';
const base=process.env.BURN_CLOCK_URL||'http://127.0.0.1:4173',browser=await chromium.launch({headless:true,args:['--enable-unsafe-swiftshader']}),runs=[],interactions=[];
try{
 for(const profile of ['desktop','throttled-4G']){
  const context=await browser.newContext({viewport:profile==='desktop'?{width:1440,height:1000}:{width:375,height:844}}),page=await context.newPage(),cdp=await context.newCDPSession(page);
  await cdp.send('Network.enable');await cdp.send('Network.setCacheDisabled',{cacheDisabled:true});if(profile==='throttled-4G'){await cdp.send('Network.emulateNetworkConditions',{offline:false,latency:150,downloadThroughput:200000,uploadThroughput:93750});await cdp.send('Emulation.setCPUThrottlingRate',{rate:4});}
  const start=performance.now();await page.goto(base,{waitUntil:'domcontentloaded'});await page.getByTestId('home-at17').waitFor();await page.locator('.baseline-note').waitFor();const firstUsefulAnswerMs=Math.round(performance.now()-start);await page.locator('.claim-sentence').waitFor({timeout:60000});const claimReadyMs=Math.round(performance.now()-start);runs.push({profile,firstUsefulAnswerMs,claimReadyMs,underThreeSeconds:firstUsefulAnswerMs<3000});
  // Measure event dispatch to two paint opportunities, excluding Playwright transport.
  for(const value of ['2019','2021','2023']){const ms=await page.getByLabel('Claim year A',{exact:true}).evaluate(async(el,value)=>{const start=performance.now();el.value=value;el.dispatchEvent(new Event('change',{bubbles:true}));await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));return performance.now()-start;},value);interactions.push({profile,action:'Change comparison year',value,eventToPaintMs:Math.round(ms*10)/10,under100ms:ms<100});}
  console.log(runs.at(-1),interactions.filter(x=>x.profile===profile));await context.close();
 }
 const report={generatedAt:new Date().toISOString(),status:runs.every(r=>r.underThreeSeconds)&&interactions.every(r=>r.under100ms)?'passed':'failed',runs,interactions,definition:'One cold-cache local production run per profile; useful answer includes headline, afternoon comparison and peak-baseline caveat. Interaction includes two animation frames after a comparison-year change.',limits:['Finite local lab samples; not field percentiles or real-device evidence.','Full area preparation and maps can exceed the first-answer budget; explicit loading text remains visible.','Throttled profile: 1.6 Mbps down, 150 ms latency, 4× CPU slowdown.','Run without competing browser, data-audit or build jobs.']};writeFileSync('polish-performance-checks.json',JSON.stringify(report,null,2)+'\n');if(report.status!=='passed')process.exitCode=1;
}finally{await browser.close();}
