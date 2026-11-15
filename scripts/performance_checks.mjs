import {chromium} from 'playwright';import {writeFileSync} from 'node:fs';
const base=process.env.BURN_CLOCK_URL||'http://127.0.0.1:4173';
const browser=await chromium.launch({headless:true,args:['--enable-unsafe-swiftshader']});const runs=[];
try{for(const profile of ['local-desktop','simulated-mobile']){
 const context=await browser.newContext({viewport:profile==='local-desktop'?{width:1440,height:1100}:{width:390,height:844}}),page=await context.newPage();const cdp=await context.newCDPSession(page);await cdp.send('Network.enable');await cdp.send('Network.setCacheDisabled',{cacheDisabled:true});
 if(profile==='simulated-mobile'){await cdp.send('Network.emulateNetworkConditions',{offline:false,latency:100,downloadThroughput:1250000,uploadThroughput:1250000});await cdp.send('Emulation.setCPUThrottlingRate',{rate:4});}
 const start=performance.now();await page.goto(base,{waitUntil:'domcontentloaded'});await page.locator('h1').waitFor();const headlineMs=Math.round(performance.now()-start);await page.locator('.heat-cell').first().waitFor({timeout:60000});const calendarMs=Math.round(performance.now()-start);await page.locator('.map-loading').waitFor({state:'hidden',timeout:60000});const mapMs=Math.round(performance.now()-start);
 runs.push({profile,headlineMs,calendarMs,mapMs,calendarUnder10Seconds:calendarMs<10000});console.log(JSON.stringify(runs.at(-1)));await context.close();
 }
 writeFileSync('performance-checks.json',JSON.stringify({base,runs,environment:'Cold browser contexts; headless Chromium on this local machine; production Vite preview; simulated mobile=10Mbps,100mslatency,4xCPU. One observation per profile, not a percentile or field metric.',limits:'Native map readiness does not measure full visual tile/font completion. Real-device and real-network testing still required.'},null,2)+'\n');
 if(runs.some(r=>!r.calendarUnder10Seconds))throw Error('Calendar exceeded the recorded 10-second lab budget');
}finally{await browser.close()}
