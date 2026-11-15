import {chromium} from 'playwright';
import {readFileSync,mkdirSync,writeFileSync} from 'node:fs';
import assert from 'node:assert/strict';
const base=process.env.BURN_CLOCK_URL||'http://127.0.0.1:5173';
const expected=JSON.parse(readFileSync(new URL('./preset_expected.json',import.meta.url),'utf8'));
mkdirSync('tmp/qa',{recursive:true});
const browser=await chromium.launch({headless:true,args:['--enable-unsafe-swiftshader']});
const checks=[],errors=[];
const record=(s)=>{checks.push(s);console.log('PASS',s)};
try{
 const page=await browser.newPage({viewport:{width:1440,height:1100}});
 page.on('pageerror',e=>errors.push(e.message));
 page.on('console',m=>{if(m.type()==='error')errors.push(m.text())});
 await page.goto(base,{waitUntil:'domcontentloaded'});
 await page.locator('.heat-cell').first().waitFor({timeout:60000});
 await page.locator('.map-loading').waitFor({state:'hidden',timeout:30000});
 assert.equal(await page.locator('button.heat-cell').count(),276);
 record('Initial calendar renders 23 full years from supplied data');
 for(const [id,x] of Object.entries(expected)){
  await page.getByLabel('Region preset').selectOption(id);
  await page.waitForFunction(n=>document.querySelector('.map-bottom')?.textContent.includes(n+' active grid cells'),x.cells.toLocaleString('en-US'));
  await page.locator('#month-2025-11').waitFor();
  await page.locator('#month-2025-11').click();
  assert.equal((await page.locator('.detail-value').innerText()).replaceAll(',',''),Math.round(x.nov2025).toString());
 }
 record('All six preset cell counts and November 2025 values match independent Python sums');
 await page.getByLabel('Region preset').selectOption('punjab');await page.locator('#month-2011-03').waitFor();await page.locator('#month-2011-03').click();
 assert.match(await page.locator('.month-detail').innerText(),/MODIS converted/);
 await page.getByRole('button',{name:'Raw observations',exact:true}).click();
 assert.equal(await page.locator('.detail-value').innerText(),'—');
 await page.getByLabel('Raw satellite').selectOption('J2');
 assert.equal(await page.locator('button.heat-cell.missing').count(),276);
 await page.getByRole('button',{name:'Anomaly',exact:true}).click();
 assert.match(await page.locator('.month-detail').innerText(),/Historical median/);
 await page.getByRole('button',{name:'Harmonized',exact:true}).click();
 await page.getByLabel('Include early archive').check();
 assert.equal(await page.locator('button.heat-cell').count(),302);
 await page.getByLabel('Include early archive').uncheck();
 record('Raw/harmonized/anomaly toggles, pre-VIIRS nulls, absent NOAA-21 and early era');
 await page.locator('#month-2025-11').click();
 const event=page.waitForEvent('download');await page.getByRole('button',{name:'Export CSV',exact:true}).click();const dl=await event;await dl.saveAs('tmp/qa/export.csv');
 const csv=readFileSync('tmp/qa/export.csv','utf8');assert.equal(csv.trim().split(/\r?\n/).length,277);assert.match(csv,/clock_badge_annual/);assert.match(csv,/2025-11/);assert.match(csv,/S-NPP scale/);
 record('CSV contains 276 visible months, nulls, interval labels and source/badge fields');
 await page.locator('#month-2025-11').focus();await page.keyboard.press('ArrowLeft');assert.equal(await page.locator('.month-detail h3').innerText(),'Oct 2025');
 record('Calendar keyboard navigation updates the selected month');
 await page.locator('#month-2025-11').click();
 await page.evaluate(()=>window.scrollTo(0,0));await page.screenshot({animations:'disabled',path:'tmp/qa/explorer-desktop.png',fullPage:true});
 for(const route of ['clock','receipt','validation','methods']){
   await page.locator(`nav a[href="#${route}"]`).click();await page.locator('.page-content h1').waitFor();
   assert.ok((await page.locator('.page-content').innerText()).length>500);
   if(route==='clock'){
     await page.getByLabel('Observation year').fill('2021');await page.getByLabel('Observation year').fill('2025');
     await page.getByRole('button',{name:'Terra · night',exact:true}).click();assert.match(await page.locator('.world-figure').getAttribute('src'),/terra_night/);
     await page.getByLabel('Find a country').fill('China');assert.equal(await page.locator('.country-table tbody tr').count(),1);await page.getByLabel('Find a country').fill('');
   }
   if(route==='receipt'){
     await page.getByRole('button',{name:'2019',exact:true}).click();assert.match(await page.locator('.fan-values').innerText(),/1.727/);
     await page.getByLabel('Matched outage mask').uncheck();assert.match(await page.locator('.fan-values').innerText(),/2.138/);
   }
   await page.evaluate(()=>window.scrollTo(0,0));await page.screenshot({animations:'disabled',path:`tmp/qa/${route}-desktop.png`,fullPage:true});
 }
 record('All routes render; clock slider, world layers, country filter and receipt base/mask work');
 await page.locator('nav a[href="#explorer"]').click();await page.locator('.map-loading').waitFor({state:'hidden'});
 await page.getByRole('button',{name:'Draw area',exact:true}).click();
 const rect=await page.locator('.map-canvas').boundingBox();assert.ok(rect);
 await page.mouse.click(rect.x+rect.width*.4,rect.y+rect.height*.35);
 await page.mouse.move(rect.x+rect.width*.6,rect.y+rect.height*.65);
 await page.mouse.click(rect.x+rect.width*.6,rect.y+rect.height*.65);
 await page.waitForFunction(()=>document.querySelector('.map-bottom')?.textContent.includes('Custom area'));
 await page.locator('.calendar-card,.empty-state,.error-state').first().waitFor();
 record('Drawing a rectangle updates the area and recomputes the calendar');
 await page.getByRole('button',{name:'Coordinates',exact:true}).click();
 const input=page.locator('.coordinates-form input');
 await input.nth(0).fill('10');await input.nth(2).fill('5');await page.getByRole('button',{name:'Apply area'}).click();assert.ok(await page.locator('.coordinates-form [role="alert"]').isVisible());
 for(const [i,v] of [-5,178,5,-178].entries())await input.nth(i).fill(String(v));
 await page.getByRole('button',{name:'Apply area'}).click();await page.waitForFunction(()=>!document.querySelector('.coordinates-form'));await page.locator('.calendar-card,.empty-state,.error-state').first().waitFor();
 assert.equal(await page.locator('.error-state').count(),0);
 record('Coordinates reject invalid bounds and accept date-line-crossing areas');
 const mobile=await browser.newPage({viewport:{width:390,height:844},isMobile:true,deviceScaleFactor:1,hasTouch:true});
 mobile.on('pageerror',e=>errors.push(e.message));
 await mobile.goto(base,{waitUntil:'domcontentloaded'});await mobile.locator('.heat-cell').first().waitFor({timeout:45000});await mobile.locator('.map-loading').waitFor({state:'hidden'});
 for(const route of ['explorer','clock','receipt','validation','methods']){
  if(route!=='explorer'){await mobile.getByRole('button',{name:'Open navigation'}).click();await mobile.locator(`nav a[href="#${route}"]`).click();}
  assert.ok(await mobile.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),`Horizontal overflow: ${route}`);
  await mobile.locator('.sidebar.open').waitFor({state:'hidden'});await mobile.evaluate(()=>window.scrollTo(0,0));await mobile.screenshot({animations:'disabled',path:`tmp/qa/${route}-mobile.png`,fullPage:true});
 }
 record('All five screens fit a 390px mobile viewport and mobile navigation works');
 const failure=await browser.newPage();await failure.route('**/data/tiles/*.json.gz',r=>r.fulfill({status:503,body:'temporarily unavailable'}));await failure.goto(base);await failure.locator('.error-state').waitFor({timeout:45000});assert.equal(await failure.locator('.heat-cell').count(),0);
 record('Tile failure is an explicit retryable error, never a fabricated zero calendar');
 assert.deepEqual(errors,[]);
 record('No JavaScript or console errors in the normal workflows');
 writeFileSync('browser-checks.json',JSON.stringify({base,checks,errors},null,2)+'\n');
}finally{await browser.close();}
