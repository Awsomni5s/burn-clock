import {chromium} from 'playwright';
import {writeFileSync} from 'node:fs';
const base=process.env.BURN_CLOCK_URL||'http://127.0.0.1:4173',browser=await chromium.launch({headless:true,args:['--enable-unsafe-swiftshader']}),runs=[];
try{for(const profile of ['desktop','throttled-4G']){
 const context=await browser.newContext({viewport:profile==='desktop'?{width:1440,height:1000}:{width:375,height:812}}),page=await context.newPage(),cdp=await context.newCDPSession(page);
 await cdp.send('Network.enable');await cdp.send('Network.setCacheDisabled',{cacheDisabled:true});if(profile==='throttled-4G'){await cdp.send('Network.emulateNetworkConditions',{offline:false,latency:150,downloadThroughput:200000,uploadThroughput:93750});await cdp.send('Emulation.setCPUThrottlingRate',{rate:4});}
 const start=performance.now();await page.goto(base,{waitUntil:'domcontentloaded'});await page.getByTestId('home-at17').waitFor();await page.locator('.baseline-note').waitFor();const answerMs=Math.round(performance.now()-start);await page.locator('.claim-sentence').waitFor({timeout:60000});const claimReadyMs=Math.round(performance.now()-start);
 runs.push({profile,firstUsefulAnswerMs:answerMs,claimReadyMs,underThreeSeconds:answerMs<3000});console.log(runs.at(-1));await context.close();
 }
 const report={status:runs.every(r=>r.underThreeSeconds)?'passed':'failed',runs,definition:'First useful answer: source-derived Punjab headline, afternoon comparison and baseline caveat rendered. Cold cache; production preview on local machine; one observation per profile.',throttling:'4G profile: 1.6 Mbps down, 0.75 Mbps up, 150 ms latency, 4× CPU slowdown; headless Chromium. Vite preview assets may be uncompressed, unlike production hosting.',limits:'Lab measurements, not field percentiles or real-device results. Full maps/claim preparation measured separately; participant card timing not inferred.'};writeFileSync('addendum-performance-checks.json',JSON.stringify(report,null,2)+'\n');if(report.status!=='passed')process.exitCode=1;
}finally{await browser.close()}
