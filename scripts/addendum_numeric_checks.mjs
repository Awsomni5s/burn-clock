/** Browser checks against independent Python source-file calculations. No app math is imported. */
import {chromium} from 'playwright';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {gunzipSync} from 'node:zlib';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
const root=new URL('../',import.meta.url),base=process.env.BURN_CLOCK_URL||'http://127.0.0.1:5173';
const fixtureBytes=readFileSync(new URL('stats_expected.json',import.meta.url)),fixture=JSON.parse(fixtureBytes);
const calendar=JSON.parse(readFileSync(new URL('numeric_expected.json',import.meta.url)));
const receipt=JSON.parse(gunzipSync(readFileSync(new URL('public/data/punjab_receipt.json.gz',root))));
const names={punjab:'Punjab + Haryana',parana:'Paraná Delta',cerrado:'Cerrado / MATOPIBA',africa:'Central African savanna',kalimantan:'Kalimantan',california:'California'};
const platformNames={T:'Terra',A:'Aqua',N:'S-NPP',J1:'NOAA-20',J2:'NOAA-21'},months=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const badges={clock_sensitive:'Timing check: the answer depends on when satellites look',robust:'Timing check: OK',not_identifiable:'Timing check: not enough fires to tell',not_evaluated:'Timing check starts in 2021'};
const fmt=(v,d=0)=>typeof v==='number'&&Number.isFinite(v)?new Intl.NumberFormat('en-US',{minimumFractionDigits:d,maximumFractionDigits:d}).format(Number(v.toPrecision(14))):'—';
const signed=(v,d=1)=>typeof v==='number'&&Number.isFinite(v)?(v>0?'+':'')+fmt(v,d):'—';
const change=v=>v==null?'unavailable':`${v<0?'down':v>0?'up':'unchanged by'} ${fmt(Math.abs(v),1)}%`;
const expectedSentence=(c,name)=>c.harmonized.status==='ok'?`Between ${c.a} and ${c.b}, the ${c.months.map(m=>months[m-1]).join(', ')} combined fire-activity record in ${name} was ${change(c.harmonized.changePct)} (approximate change range ${signed(c.harmonized.rangePct[0],1)}% to ${signed(c.harmonized.rangePct[1],1)}%).`:`A complete ${c.a}–${c.b} comparison is unavailable for ${name}: ${c.harmonized.status.replaceAll('_',' ')}.`;
const shotDir=new URL('tmp/addendum-qa/',root);mkdirSync(shotDir,{recursive:true});
let assertions=0,failureCount=0,fatal=null;const failures=[],errors=[],groups=[];
const coverage={claims:0,trends:0,sliderStates:0,sourceAttributes:0,homeNumbers:0,customAreas:0,edgeStates:0,permalinkRoundTrips:0,pngExports:0};
const check=(actual,wanted,where)=>{assertions++;if(actual!==wanted){failureCount++;if(failures.length<100)failures.push({where,actual,expected:wanted});}};
const includes=(actual,wanted,where)=>check(actual.includes(wanted),true,`${where}: ${wanted}`);
const close=(actual,wanted,where)=>{assertions++;if(!Number.isFinite(actual)||Math.abs(actual-wanted)>Math.max(1e-8,Math.abs(wanted)*1e-10)){failureCount++;if(failures.length<100)failures.push({where,actual,expected:wanted});}};
const group=name=>{groups.push(name);console.log('CHECKED',name,`(${assertions} assertions)`);};
const text=async locator=>(await locator.innerText()).trim();
const started=Date.now(),browser=await chromium.launch({headless:true,args:['--enable-unsafe-swiftshader']});
const page=await browser.newPage({viewport:{width:1440,height:1100}});page.on('pageerror',e=>errors.push(e.message));
const goto=async(box,c={months:[10,11],a:2021,b:2025})=>{
  const url=new URL(base);url.searchParams.set('box',box.join(','));url.searchParams.set('months',c.months.join(','));url.searchParams.set('a',String(c.a));url.searchParams.set('b',String(c.b));url.hash='explorer';
  await page.goto(url.href,{waitUntil:'domcontentloaded'});await page.waitForFunction(()=>document.querySelector('.claim-sentence')||document.querySelector('.empty-state'),undefined,{timeout:60000});
};
const openDetails=async()=>{await page.locator('.claim-checker > details').evaluateAll(elements=>elements.forEach(el=>{el.open=true;}));};
const setMonths=async selected=>{for(let month=1;month<=12;month++){const control=page.getByLabel('Claim month '+months[month-1],{exact:true});if(await control.isChecked()!==selected.includes(month))await control.setChecked(selected.includes(month));}};
const setCase=async c=>{await setMonths(c.months);await page.getByLabel('Claim year A',{exact:true}).selectOption(String(c.a));await page.getByLabel('Claim year B',{exact:true}).selectOption(String(c.b));await openDetails();};
const sourced=async(id,path)=>{const locator=page.getByTestId(id);check(await locator.count(),1,`${id}: unique test id`);const source=await locator.evaluate(el=>el.closest('[data-source]')?.getAttribute('data-source')??'');check(source.length>0,true,`${id}: source annotation`);if(path)includes(source,path,`${id}: expected source`);coverage.sourceAttributes++;};
async function checkClaim(c,name,label){
  check(await text(page.getByTestId('claim-sentence')),expectedSentence(c,name),label+'/sentence');await sourced('claim-sentence');
  for(const p of c.platforms){
    check(await text(page.getByTestId('claim-'+p.platform)),p.status==='ok'?change(p.changePct):p.status==='too_few'?'too few observations':'missing months',label+'/'+p.platform+'/change');
    await sourced('claim-'+p.platform,`raw.${p.platform}`);
    for(const [suffix,value,digits] of [['a',p.sumA,2],['b',p.sumB,2],['ratio',p.ratio,4]]){const id=`claim-${p.platform}-${suffix}`;check(await text(page.getByTestId(id)),fmt(value,digits),label+'/'+id);await sourced(id);}
  }
  for(const [suffix,value,digits] of [['a',c.harmonized.sumA,2],['b',c.harmonized.sumB,2],['ratio',c.harmonized.ratio,4]]){const id='claim-harm-'+suffix;check(await text(page.getByTestId(id)),fmt(value,digits),label+'/'+id);await sourced(id);}
  check(await text(page.getByTestId('claim-converted-share')),fmt(c.convertedShare*100,1)+'%',label+'/converted share');await sourced('claim-converted-share');
  const badge=c.b<2021?badges.not_evaluated:badges[c.timing?.badge??'not_identifiable'];check(await text(page.locator('.claim-checker > .clock-badge-block .badge-title strong')),badge,label+'/timing check');
  for(const [code,wanted] of [['seam_2012',Math.min(c.a,c.b)<2012&&Math.max(c.a,c.b)>=2012],['converted_modis',c.convertedShare>.3],['outage',c.outages.length>0]])check(await page.locator(`.claim-warnings [data-warning="${code}"]`).count()>0,wanted,label+'/warning '+code);
  if(c.outages.length){const warning=await text(page.locator('[data-warning="outage"]'));for(const o of c.outages)includes(warning,`${o.platform} ${o.month}`,label+'/named outage');}
  check(await page.getByRole('button',{name:'Make a claim card',exact:true}).isDisabled(),c.harmonized.status!=='ok',label+'/export availability');coverage.claims++;
}

try{
  await goto(calendar.presets.punjab.box);await openDetails();
  const h=receipt.gk2a_by_hour,u=receipt.gk2a_unique_pixel_days,total=values=>values.reduce((a,b)=>a+b,0);
  const late=values=>100*values.filter((_,i)=>h.hours[i]>=16).reduce((a,b)=>a+b,0)/total(values);
  const home=[['home-official-decline',fmt(100*(1-receipt.claim_source.value_2025/receipt.claim_source.value_2021))+'%'],['home-afternoon-decline',fmt(100*(1-u['2025']/u['2021']))+'% lower'],['home-at17',fmt(h.pixel_hours_2025[h.hours.indexOf(17)]/h.pixel_hours_2021[h.hours.indexOf(17)],2)+'× at 5 pm'],['home-late-share',fmt(late(h.pixel_hours_2025))+'% versus '+fmt(late(h.pixel_hours_2021))+'%'],['home-2019-ratio',fmt(u['2025']/u['2019'],2)+'×']];
  for(const [id,wanted] of home){check(await text(page.getByTestId(id)),wanted,id);await sourced(id);coverage.homeNumbers++;}
  for(const fan of receipt.base_year_fan){await page.getByLabel('Punjab baseline year').selectOption(String(fan.base));for(const masked of [false,true]){await page.getByLabel('Match satellite outage days').setChecked(masked);check(await text(page.getByTestId('home-fan-ratio')),fmt(fan[masked?'gk2a':'gk2a_unmasked'],3)+'×',`Home fan ${fan.base}/${masked}`);await sourced('home-fan-ratio');coverage.homeNumbers++;}}
  group('Homepage headline, afternoon metrics and every base-year/mask combination');
  for(const [id,cases] of Object.entries(fixture.presets)){
    await goto(calendar.presets[id].box,cases.claims[0]);await openDetails();
    for(const c of cases.claims){await setCase(c);await checkClaim(c,names[id],`${id}/${c.a}-${c.b}/${c.months}`);}
    for(const t of cases.trends){
      await setMonths(t.months);await openDetails();await page.getByLabel('Trend start year').selectOption(String(t.start));
      check(await text(page.getByTestId('trend-slope')),fmt(t.pctPerYear,3),`${id}/trend/${t.start}/slope`);
      check(await text(page.getByTestId('trend-range')),`${fmt(t.rangePct?.[0],3)} to ${fmt(t.rangePct?.[1],3)}`,`${id}/trend/${t.start}/range`);
      const verdict=await text(page.getByTestId('trend-verdict'));
      includes(verdict,t.status!=='ok'?'Not enough complete data':t.verdict==='no_clear_trend'?'No clear trend':`Recorded activity is ${t.verdict} about ${fmt(Math.abs(t.pctPerYear),1)}% a year.`,`${id}/trend/${t.start}/verdict`);
      if(t.rangePct)includes(verdict,`${signed(t.rangePct[0],1)}% to ${signed(t.rangePct[1],1)}% per year`,`${id}/trend/${t.start}/bounds sentence`);
      check((await text(page.locator('.trend-panel'))).includes('A MODIS-only record would show the opposite trend here.'),t.modisOpposite,`${id}/trend/${t.start}/MODIS sign`);
      for(const testid of ['trend-slope','trend-range','trend-verdict'])await sourced(testid);coverage.trends++;
    }
    group(`${id}: independent Claim Checker and trend comparisons`);
  }
  // The supplied California task must survive a reload of the actual generated permalink.
  const california=fixture.presets.california.claims.find(c=>c.a===2019&&c.b===2024);
  await goto(calendar.presets.california.box,california);await openDetails();const before=await text(page.getByTestId('claim-sentence'));
  const link=await page.locator('.claim-permalink').getAttribute('href'),url=new URL(link);
  check(url.searchParams.get('months'),'8,9','California permalink months');check(url.searchParams.get('a'),'2019','California permalink A');check(url.searchParams.get('b'),'2024','California permalink B');check(url.searchParams.get('box'),calendar.presets.california.box.join(','),'California permalink box');
  await page.goto(link,{waitUntil:'domcontentloaded'});await page.getByTestId('claim-sentence').waitFor({timeout:60000});await openDetails();check(await text(page.getByTestId('claim-sentence')),before,'California permalink roundtrip result');
  await checkClaim(california,names.california,'California permalink');coverage.permalinkRoundTrips++;
  const cardText=await page.locator('.claim-image').textContent();for(const phrase of ['2019 versus 2024','baseline is 2019','Approximate bounds','not unique fires','Timing check:','Source: NASA FIRMS',link])includes(cardText,phrase,'Card embedded context');
  const downloadPromise=page.waitForEvent('download');await page.getByRole('button',{name:'Make a claim card',exact:true}).click();const download=await downloadPromise;await download.saveAs(fileURLToPath(new URL('california-claim-card.png',shotDir)));
  const png=readFileSync(new URL('california-claim-card.png',shotDir));check(png.subarray(0,8).toString('hex'),'89504e470d0a1a0a','Claim card PNG signature');check(png.readUInt32BE(16),1000,'Claim card PNG width');check(png.readUInt32BE(20)>600,true,'Claim card contains full context height');coverage.pngExports++;group('California task permalink, embedded source/context and actual PNG export');
  await goto(calendar.presets.punjab.box);const illustration=page.locator('.clock-illustration');await illustration.scrollIntoViewIfNeeded();
  const max=Math.max(...h.pixel_hours_2021,...h.pixel_hours_2025);
  for(const state of fixture.curve){
    await page.getByLabel('Shift burning later',{exact:true}).fill(String(state.shift));check(await text(page.getByTestId('shift-share')),fmt(state.ratio*100,1)+'%',`Clock slider ${state.shift} hours`);await sourced('shift-share');
    const path=await illustration.locator('svg > path').nth(1).getAttribute('d'),points=[...path.matchAll(/[ML]([^, ]+),([^ ]+)/g)].map(m=>[+m[1],+m[2]]);
    check(points.length,121,`Shift ${state.shift}/curve samples`);for(let i=0;i<h.hours.length;i++){close(points[i*20][0],55+i/6*650,`Shift ${state.shift}/x${i}`);close(points[i*20][1],250-state.curve[i]/max*205,`Shift ${state.shift}/y${i}`);}coverage.sliderStates++;
  }
  await page.getByLabel('Show what really happened in 2025').check();check(await illustration.locator('svg > path').count(),3,'Actual 2025 overlay visible');
  const actualPath=await illustration.locator('svg > path').nth(2).getAttribute('d'),actualPoints=[...actualPath.matchAll(/[ML]([^, ]+),([^ ]+)/g)].map(m=>[+m[1],+m[2]]);
  for(let i=0;i<h.hours.length;i++)close(actualPoints[i*20][1],250-h.pixel_hours_2025[i]/max*205,`Actual 2025 curve point ${i}`);group('Eight real-source clock shifts and actual 2025 overlay');
  await openDetails();await setMonths([]);includes(await text(page.getByTestId('claim-sentence')),'invalid selection','Empty month selection');check(await page.getByRole('button',{name:'Make a claim card',exact:true}).isDisabled(),true,'Empty selection cannot export');check(await page.getByRole('button',{name:'Copy claim and link',exact:true}).isDisabled(),true,'Empty selection cannot copy a different comparison');check(await page.locator('.claim-permalink').count(),0,'Empty selection has no ambiguous permalink');coverage.edgeStates++;
  for(const [id,edge] of Object.entries(fixture.edges)){
    await goto(edge.box,edge.claim);includes(await text(page.locator('.area-name')),fmt(edge.cellCount)+' archived grid cells',id+'/selected cell count');
    if(!edge.cellCount){includes(await text(page.locator('.empty-state')),'No archived fire cells in this box',id+'/no data message');check(await page.locator('.claim-checker').count(),0,id+'/no invented claim');}
    else{await openDetails();await checkClaim(edge.claim,'Custom area',id);await page.getByLabel('Include early archive').check();await page.locator('#month-2000-11').click();check(await text(page.locator('.detail-value')),fmt(edge.earlyMonth.harm),id+'/earliest harmonized month');}
    coverage.customAreas++;coverage.edgeStates++;
  }
  await goto(calendar.presets.punjab.box);await page.getByLabel('Include early archive').check();await page.getByRole('button',{name:'By satellite',exact:true}).click();await page.getByLabel('Raw satellite').selectOption('T');await page.locator('#month-2000-11').click();check(await text(page.locator('.detail-value')),fmt(calendar.presets.punjab.months[0].raw.T),'Early 2000 Terra counts');await page.getByLabel('Raw satellite').selectOption('A');check(await text(page.locator('.detail-value')),'—','Early 2000 Aqua is missing');coverage.edgeStates++;
  group('Empty months, empty area, one-cell/equator/date-line areas and Terra-only archive edge');check(errors.length,0,'Uncaught browser JavaScript errors');
}catch(error){fatal=error.stack||String(error);console.error(fatal);}
finally{
  await browser.close();const result={generatedAt:new Date().toISOString(),status:fatal||failureCount?'failed':'passed',base,assertions,failureCount,coverage,groups,failures,fatal,runtimeErrors:errors,elapsedSeconds:Number(((Date.now()-started)/1000).toFixed(2)),fixtureSha256:createHash('sha256').update(fixtureBytes).digest('hex'),scope:'Independent Python reference for every six-preset Claim Checker/trend fixture, source annotations, home Punjab metrics and base-year fan, eight curve shifts, real 2025 overlay, California permalink/PNG and explicit geographic/missing-data edge states.',limitations:['Finite enumerated states, not every possible drawn area or year/month combination.','PNG export integrity and embedded context are checked; malicious cropping resistance and human comprehension require people.','These checks do not imply any real-person testing results.']};writeFileSync(new URL('addendum-numeric-checks.json',root),JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify({status:result.status,assertions,failureCount,coverage,failures:failures.slice(0,10),fatal,elapsedSeconds:result.elapsedSeconds},null,2));if(fatal||failureCount)process.exitCode=1;
}
