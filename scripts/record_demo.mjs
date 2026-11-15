import {chromium} from 'playwright';
import {mkdirSync,writeFileSync} from 'node:fs';
const base=process.env.BURN_CLOCK_URL||'http://127.0.0.1:4173',output='../output/demo';mkdirSync(output,{recursive:true});
const browser=await chromium.launch({headless:true,args:['--enable-unsafe-swiftshader']});
const context=await browser.newContext({viewport:{width:1440,height:900},recordVideo:{dir:output,size:{width:1440,height:900}},reducedMotion:'reduce'});const page=await context.newPage(),start=performance.now(),shots=[];
const hold=async(label,ms)=>{shots.push({atSeconds:Math.round((performance.now()-start)/100)/10,label});await page.waitForTimeout(ms);};
try{
 await page.goto(base);await page.getByTestId('home-at17').waitFor();await hold('Reported count, whole-afternoon evidence and peak-year caveat',7000);
 await page.locator('#why > .deferred').scrollIntoViewIfNeeded();await page.waitForTimeout(1800);await page.locator('.burning-panel').scrollIntoViewIfNeeded();await page.waitForTimeout(1500);await hold('Same-instrument comparison, 2021 and 2025',6000);
 const hour=page.getByLabel('GK2A map hour in India time');await hour.fill('14');await hour.dispatchEvent('input');await page.locator('.burning-panel .burning-pair').last().scrollIntoViewIfNeeded();await hold('14:00 IST',6000);await hour.fill('17');await hour.dispatchEvent('input');await page.locator('.burning-panel .burning-pair').last().scrollIntoViewIfNeeded();await hold('17:00 IST',8000);
 await page.locator('nav a[href="#receipt"]').click();await page.locator('main h1').waitFor();await page.evaluate(()=>scrollTo(0,0));await hold('Receipt: official source, peak baseline and preliminary GK2A caveat',8000);
 await page.getByRole('link',{name:'Check a place',exact:true}).click();await page.getByRole('button',{name:'California',exact:true}).click();await page.getByTestId('claim-sentence').waitFor();await page.waitForFunction(()=>document.querySelector('[data-testid="claim-sentence"]')?.textContent.includes('California'));
 for(const m of ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']){const control=page.getByLabel('Claim month '+m,{exact:true});await control.setChecked(['Aug','Sep'].includes(m));}
 await page.getByLabel('Claim year A',{exact:true}).selectOption('2019');await page.getByLabel('Claim year B',{exact:true}).selectOption('2024');await page.getByTestId('claim-sentence').scrollIntoViewIfNeeded();await hold('California: August–September, 2019 versus 2024',8000);
 await page.locator('.claim-checker .so-what').scrollIntoViewIfNeeded();await hold('Fixed guidance and export with context',6000);
 const download=page.waitForEvent('download');await page.getByRole('button',{name:'Make a claim card',exact:true}).click();await(await download).saveAs(output+'/california-claim.png');
 await page.locator('nav a[href="#validation"]').click();await page.locator('main h1').waitFor();await page.evaluate(()=>scrollTo(0,0));await hold('Validation includes method errors and known weaknesses',7000);
 await page.locator('nav a[href="#methods"]').click();await page.locator('.product-test-status').scrollIntoViewIfNeeded();await hold('Human testing is explicitly pending',8000);
}finally{const video=page.video();await context.close();if(video)await video.saveAs(output+'/burn-clock-demo.webm');await browser.close();writeFileSync(output+'/recording.json',JSON.stringify({recordedAt:new Date().toISOString(),base,shots,durationSeconds:Math.round((performance.now()-start)/1000),note:'Automated capture of the actual app. Silent; separate narration draft supplied. Not a participant study or submitted competition entry.'},null,2)+'\n');}
