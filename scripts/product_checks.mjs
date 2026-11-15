import {chromium} from 'playwright';
import AxeBuilder from '@axe-core/playwright';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {gunzipSync} from 'node:zlib';
import assert from 'node:assert/strict';
const base=process.env.BURN_CLOCK_URL||'http://127.0.0.1:5173';
const format=(n,d)=>new Intl.NumberFormat('en-US',{minimumFractionDigits:d,maximumFractionDigits:d}).format(n);
const data=JSON.parse(gunzipSync(readFileSync('public/data/punjab_receipt.json.gz')));
const browser=await chromium.launch({headless:true,args:['--enable-unsafe-swiftshader']});
const checks=[],accessibility=[],errors=[];mkdirSync('tmp/product-qa',{recursive:true});
const pass=s=>{checks.push(s);console.log('PASS',s)};
try{
 const context=await browser.newContext({viewport:{width:1440,height:1100},reducedMotion:'reduce'}),page=await context.newPage();
 page.on('pageerror',e=>errors.push(e.message));
 const start=performance.now();await page.goto(base);await page.locator('.heat-cell').first().waitFor({timeout:60000});const localReadyMs=Math.round(performance.now()-start);
 await page.keyboard.press('Tab');assert.equal(await page.locator('.skip-link').evaluate(e=>e===document.activeElement),true);await page.keyboard.press('Enter');assert.equal(await page.locator('main').evaluate(e=>e===document.activeElement),true);
 assert.equal(await page.locator('.so-what').getAttribute('data-rule'),'WITHIN_THRESHOLD');
 const actions=[];for(const role of ['air','policy','journalist','research']){await page.getByLabel('Decision role').selectOption(role);actions.push(await page.locator('.insight-action').innerText());}assert.equal(new Set(actions).size,4);
 pass('Keyboard skip link and all four deterministic decision roles work');
 assert.equal(await page.locator('.heat-cell .cell-clock').count(),60);
 await page.getByLabel('Include early archive').check();await page.locator('#month-2000-11').click();assert.equal(await page.locator('.so-what').getAttribute('data-rule'),'PRE_DIAGNOSTIC');assert.match(await page.locator('.overview-card .clock-badge-block').innerText(),/Before diagnostic window/);
 await page.locator('#month-2012-01').click();assert.match(await page.locator('.month-detail').innerText(),/VIIRS observed|MODIS converted/);
 await page.locator('#month-2024-11').click();assert.match(await page.locator('.so-what').innerText(),/coverage flags|missing days/);
 await page.locator('#month-2025-11').click();await page.getByLabel('Include early archive').uncheck();
 let download=page.waitForEvent('download');await page.getByRole('button',{name:'Save area claim card'}).click();await (await download).saveAs('tmp/product-qa/area-card.png');
 pass('Annual month markers, early archive, sensor transition, outage guidance and area card export');
 await page.locator('nav a[href="#receipt"]').click();await page.locator('[data-fact="late2025"]').waitFor();
 const h=data.gk2a_by_hour,sum=a=>a.reduce((a,b)=>a+b,0),share=a=>100*sum(a.filter((_,i)=>h.hours[i]>=16))/sum(a);
 const values={late2025:Math.round(share(h.pixel_hours_2025))+'%',late2021:Math.round(share(h.pixel_hours_2021))+'%',afternoonDecline:Math.round(100*(1-data.gk2a_unique_pixel_days['2025']/data.gk2a_unique_pixel_days['2021']))+'% lower',at17:(h.pixel_hours_2025[5]/h.pixel_hours_2021[5]).toFixed(2)+'× at 17:00',versus2019:(data.gk2a_unique_pixel_days['2025']/data.gk2a_unique_pixel_days['2019']).toFixed(2)+'×'};
 for(const [name,value]of Object.entries(values))assert.equal(await page.locator(`[data-fact="${name}"]`).innerText(),value);
 assert.match(await page.locator('h1').innerText(),/93%/);assert.match(await page.locator('.claim-note').innerText(),/Mixed MODIS \+ VIIRS/);
 for(let i=0;i<data.by_clock.length;i++)assert.equal(await page.locator('.ratio-number').nth(i).innerText(),'×'+format(data.by_clock[i].ratio,3));
 for(let i=0;i<h.hours.length;i++)assert.equal(await page.locator('.hour-column>span').nth(i).innerText(),'×'+format(h.ratio_2025_2021[i],2));
 for(const f of data.base_year_fan){await page.getByRole('button',{name:String(f.base),exact:true}).click();for(const mask of [true,false]){await page.getByLabel('Matched outage mask').setChecked(mask);for(const [i,key]of ['gk2a','snpp','noaa20'].entries())assert.equal(await page.locator('.fan-values strong').nth(i).innerText(),'×'+format(f[key+(mask?'':'_unmasked')],3));}}
 download=page.waitForEvent('download');await page.getByRole('button',{name:'Save Punjab claim card'}).click();await(await download).saveAs('tmp/product-qa/punjab-card.png');
 for(const file of ['area-card','punjab-card']){const bytes=readFileSync(`tmp/product-qa/${file}.png`);assert.equal(bytes.subarray(1,4).toString(),'PNG');assert.equal(bytes.readUInt32BE(16),1200);assert.ok(bytes.readUInt32BE(20)>650);}
 pass('Every Punjab summary, satellite ratio, hourly ratio and masked/unmasked fan value matches source arithmetic; both PNG cards export');
 await page.locator('nav a[href="#methods"]').click();await page.locator('.product-test-status').waitFor();assert.match(await page.locator('.test-status-pill').innerText(),/not yet run/);assert.match(await page.locator('.test-results').innerText(),/Pending actual observations/);
 for(const filename of ['USER_TEST_PROTOCOL.md','USER_TEST_RESULTS_TEMPLATE.csv','PRODUCT_EVIDENCE_AUDIT.md','PRODUCT_REQUIREMENTS.md'])assert.equal((await page.request.get(base+'/docs/'+filename)).status(),200);
 assert.equal(readFileSync('public/docs/USER_TEST_RESULTS_TEMPLATE.csv','utf8').trim().split(/\r?\n/).length,1);
 pass('Methods clearly marks real-person results pending and all test materials download; results sheet has no invented entries');
 for(const viewport of [{name:'desktop',width:1440,height:1100},{name:'mobile',width:390,height:844}]){
  await page.setViewportSize(viewport);
  for(const route of ['explorer','clock','receipt','validation','methods']){
   await page.evaluate(hash=>location.hash=hash,route);await page.waitForFunction(r=>document.querySelector('nav a[aria-current="page"]')?.getAttribute('href')==='#'+r,route);await page.locator('h1').waitFor();if(route==='explorer')await page.locator('.heat-cell').first().waitFor();
   assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),route+' '+viewport.name+' overflow');
   await page.evaluate(()=>document.fonts.ready);await page.evaluate(()=>window.scrollTo(0,0));
   const result=await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa','wcag21aa']).analyze();accessibility.push({viewport:viewport.name,route,violations:result.violations.map(v=>({id:v.id,impact:v.impact,nodes:v.nodes.map(n=>({target:n.target,summary:n.failureSummary}))})),incomplete:result.incomplete.map(v=>({id:v.id,nodes:v.nodes.length}))});
   await page.screenshot({path:`tmp/product-qa/${route}-${viewport.name}.png`,fullPage:true,animations:'disabled'});
  }
 }
 writeFileSync('product-checks.json',JSON.stringify({base,checks,localReadyMs,environment:'Headless Chromium, local server, no network/CPU throttling; not a field speed result',accessibility,errors,limitations:['No human comprehension, usability, crop interpretation or manual screen-reader sessions run','Automated WCAG2.1 AA rules; incomplete checks require human review']},null,2)+'\n');
 assert.deepEqual(accessibility.filter(r=>r.violations.length),[]);pass('No automated WCAG2.1 AA violations in all five routes at desktop and mobile widths');
 assert.deepEqual(errors,[]);pass('No JavaScript errors during tested product workflows');
 // Record passed checks only after assertions, then preserve the final report.
 writeFileSync('product-checks.json',JSON.stringify({base,checks,localReadyMs,environment:'Headless Chromium, local server, no network/CPU throttling; not a field speed result',accessibility,errors,limitations:['No human comprehension, usability, crop interpretation or manual screen-reader sessions run','Automated WCAG2.1 AA rules; incomplete checks require human review']},null,2)+'\n');
}finally{await browser.close()}
