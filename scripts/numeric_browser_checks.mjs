/** Finite-state browser numeric audit. Rebuild numeric_expected.json with Python first.
 * This does not certify every possible drawn AOI, scientific inputs, human usability,
 * decorative axis labels, or the numerical contents of supplied raster figures.
 */
import {chromium} from 'playwright';
import {readFileSync,writeFileSync} from 'node:fs';
import {gunzipSync} from 'node:zlib';
import {createHash} from 'node:crypto';
const root=new URL('../',import.meta.url);
const base=process.env.BURN_CLOCK_URL||'http://127.0.0.1:5173';
const fixtureBytes=readFileSync(new URL('./numeric_expected.json',import.meta.url));
const expected=JSON.parse(fixtureBytes);
const data=name=>JSON.parse(gunzipSync(readFileSync(new URL(`public/data/${name}.json.gz`,root))));
const manifest=data('manifest'),validation=data('validation'),countries=data('world/countries'),continents=data('world/continents'),pairs=data('same_day_pairs');
const catalog=JSON.parse(readFileSync(new URL('public/data/catalog.json',root),'utf8'));
const platforms={T:'Terra',A:'Aqua',N:'S-NPP',J1:'NOAA-20',J2:'NOAA-21'};
const monthNames=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const statuses={above:'Above typical',normal:'Within typical range',below:'Below typical',missing:'No baseline'};
const badgeNames={robust:'Within clock threshold',clock_sensitive:'Clock-sensitive',not_identifiable:'Not identifiable',not_evaluated:'Before diagnostic window'};
const fmt=(v,d=0)=>typeof v==='number'&&Number.isFinite(v)?new Intl.NumberFormat('en-US',{minimumFractionDigits:d,maximumFractionDigits:d}).format(Object.is(v,-0)?0:v):'—';
const signed=(v,d=1)=>typeof v==='number'&&Number.isFinite(v)?(v>0?'+':'')+fmt(v,d):'—';
// Clock tiles store hundredths of an hour; a median can add one decimal.
// Integer millihours keep expected half-minute rounding independent of float cancellation.
const lookChangeMinutes=(current,baseline)=>(Math.round(current*1000)-Math.round(baseline*1000))*6/100;
const clockTime=v=>{const mins=Math.round(v*60)%1440;return `${String(Math.floor(mins/60)).padStart(2,'0')}:${String(mins%60).padStart(2,'0')}`;};
const sourceName=s=>s==='V'?'VIIRS observed':s==='M'?'MODIS converted':'No data';
const label=m=>`${monthNames[Number(m.slice(5))-1]} ${m.slice(0,4)}`;
let assertions=0,failureCount=0;
const failures=[],runtimeErrors=[],groups=[];
const coverage={presetsCompleted:0,heatCellStates:0,harmonizedMonthDetailPanels:0,rawSelectedDetailPanels:0,csvRows:0,clockYearStates:0,countryRows:0,validationNumericFields:0,methodsDataFields:0};
const fail=(actual,wanted,where)=>{failureCount++;if(failures.length<100)failures.push({where,actual,expected:wanted});};
const check=(actual,wanted,where)=>{assertions++;if(actual!==wanted)fail(actual,wanted,where);};
const includes=(actual,wanted,where)=>check(actual.includes(wanted),true,`${where}: contains ${JSON.stringify(wanted)}`);
const close=(actual,wanted,where)=>{if(wanted===null){check(actual,'',where);return;}assertions++;const n=Number(actual);if(!Number.isFinite(n)||Math.abs(n-wanted)>Math.max(1e-8,Math.abs(wanted)*1e-10))fail(actual,wanted,where);};
const group=s=>{groups.push(s);console.log('CHECKED',s,`(${assertions.toLocaleString()} assertions)`);};
const text=async loc=>(await loc.innerText()).trim();
const tableRows=async loc=>loc.locator('tbody tr').evaluateAll(rows=>rows.map(row=>[...row.querySelectorAll('th,td')].map(cell=>cell.innerText.trim())));
const section=(page,name)=>page.locator('section.card').filter({has:page.getByRole('heading',{name,exact:true})});
const output=new URL('numeric-checks.json',root);
const started=Date.now();
const browser=await chromium.launch({headless:true,args:['--enable-unsafe-swiftshader']});
let fatal=null;

function parseCsv(csv){
 const rows=[];let row=[],field='',quoted=false;
 for(let i=0;i<csv.length;i++){const c=csv[i];if(c==='"'){if(quoted&&csv[i+1]==='"'){field+='"';i++;}else quoted=!quoted;}else if(c===','&&!quoted){row.push(field);field='';}else if(c==='\n'&&!quoted){row.push(field.replace(/\r$/,''));rows.push(row);row=[];field='';}else field+=c;}
 if(field||row.length){row.push(field.replace(/\r$/,''));rows.push(row);}return rows;
}

try{
 const page=await browser.newPage({viewport:{width:1440,height:1100}});
 page.on('pageerror',e=>runtimeErrors.push(e.message));
 await page.goto(base,{waitUntil:'domcontentloaded'});
 await page.locator('.heat-cell').first().waitFor({timeout:60000});
 const archive=await text(page.locator('.archive-strip'));
 includes(archive,fmt(manifest.totals.detections_processed),'Explorer processed detections');
 includes(archive,`${manifest.months[0].slice(0,4)}–${manifest.months.at(-1).slice(0,4)}`,'Explorer archive span');
 includes(archive,String(Object.keys(manifest.platforms).length),'Explorer platform count');
 for(const [id,preset] of Object.entries(expected.presets)){
   if(!page.url().endsWith('#explorer'))await page.locator('nav a[href="#explorer"]').click();
   await page.getByLabel('Region preset').selectOption(id);
   await page.waitForFunction(n=>document.querySelector('.map-bottom')?.textContent.includes(n+' active grid cells'),fmt(preset.cellCount),{timeout:60000});
   await page.locator('#month-2025-11').waitFor({timeout:60000});
   await page.getByLabel('Include early archive').check();
   const months=new Map(preset.months.map(m=>[m.month,m]));
   for(const mode of ['harm','T','A','N','J1','J2','anomaly']){
     if(mode==='harm')await page.getByRole('button',{name:'Harmonized',exact:true}).click();
     else if(mode==='anomaly')await page.getByRole('button',{name:'Anomaly',exact:true}).click();
     else{await page.getByRole('button',{name:'Raw observations',exact:true}).click();await page.getByLabel('Raw satellite').selectOption(mode);}
     const cells=await page.locator('button.heat-cell').evaluateAll(elements=>elements.map(el=>({month:el.id.replace('month-',''),title:el.title,aria:el.getAttribute('aria-label'),missing:el.classList.contains('missing'),color:el.style.backgroundColor})));
     check(cells.length,preset.months.length,`${id}/${mode}: month count`);
     for(const cell of cells){
       const m=months.get(cell.month);if(!m)throw new Error(`Unexpected month ${id}/${cell.month}`);
       const value=mode==='harm'||mode==='anomaly'?m.harm:m.raw[mode];
       const start=`${label(m.month)}: ${value===null?'No data':fmt(value,1)+' active cell-days'}.`;
       check(cell.title.match(/^.*?: (?:No data|[\d,]+(?:\.\d+)? active cell-days)\./)?.[0],start,`${id}/${mode}/${m.month}: numeric tooltip`);
       check(cell.aria,cell.title,`${id}/${mode}/${m.month}: accessible numeric tooltip`);
       check(cell.missing,value===null,`${id}/${mode}/${m.month}: null marker`);
       includes(cell.title,statuses[m.anomaly],`${id}/${mode}/${m.month}: anomaly`);
       includes(cell.title,`Source: ${sourceName(m.src)}.`,`${id}/${mode}/${m.month}: provenance`);
       if(mode==='anomaly'&&m.harm!==null){
         const color={above:'rgb(185, 79, 46)',below:'rgb(249, 228, 213)',normal:'rgb(233, 174, 141)',missing:'rgb(233, 174, 141)'}[m.anomaly];
         check(cell.color,color,`${id}/${mode}/${m.month}: anomaly colour`);
       }
       coverage.heatCellStates++;
     }
     if(mode!=='harm'&&mode!=='anomaly'){
       for(const month of ['2000-11','2011-12','2012-01','2012-02','2016-02','2024-07','2025-11']){
         await page.locator(`#month-${month}`).evaluate(el=>el.click());
         await page.waitForFunction(v=>document.querySelector('.month-detail h3')?.textContent===v,label(month));
         check(await text(page.locator('.detail-value')),fmt(months.get(month).raw[mode]),`${id}/raw/${mode}/${month}: selected value`);
         coverage.rawSelectedDetailPanels++;
       }
     }
   }
   await page.getByRole('button',{name:'Harmonized',exact:true}).click();
   // One animation frame after each native click allows React to commit before reading.
   const detailRows=await page.evaluate(async monthIds=>{
     const rows=[];
     for(const month of monthIds){
       document.getElementById('month-'+month).click();
       await new Promise(resolve=>requestAnimationFrame(()=>resolve()));
       const panel=document.querySelector('.month-detail');
       rows.push({month,heading:panel.querySelector('h3')?.textContent.trim(),value:panel.querySelector('.detail-value')?.textContent.trim(),
         anomaly:panel.querySelector('.anomaly-pill')?.textContent.trim(),
         fields:Object.fromEntries([...panel.querySelectorAll('dl > div')].map(el=>[el.querySelector('dt')?.textContent.trim(),el.querySelector('dd')?.textContent.trim()]))});
     }return rows;
   },preset.months.map(m=>m.month));
   for(const row of detailRows){const m=months.get(row.month),p=`${id}/detail/${m.month}`;
     check(row.heading,label(m.month),p+'/month');check(row.value,fmt(m.harm),p+'/harm');
     check(row.anomaly,statuses[m.anomaly],p+'/anomaly');
     check(row.fields['Historical median'],fmt(m.median),p+'/median');
     check(row.fields['Typical range'],`${fmt(m.p25)}–${fmt(m.p75)}`,p+'/quantiles');
     check(row.fields['Approx. interval'],`${fmt(m.lo)}–${fmt(m.hi)}`,p+'/interval');
     check(row.fields['Record source'],sourceName(m.src),p+'/source');
     check(row.fields['Satellites in estimate'],m.satellites.map(p=>platforms[p]).join(' + ')||'—',p+'/satellites');
     coverage.harmonizedMonthDetailPanels++;
   }
   const downloadPromise=page.waitForEvent('download');await page.getByRole('button',{name:'Export CSV',exact:true}).click();
   const stream=await(await downloadPromise).createReadStream();const buffers=[];for await(const part of stream)buffers.push(part);
   const csv=parseCsv(Buffer.concat(buffers).toString()),header=csv.shift();
   check(csv.length,preset.months.length,`${id}/CSV row count`);
   const rawColumns={T:'raw_terra',A:'raw_aqua',N:'raw_snpp',J1:'raw_noaa20',J2:'raw_noaa21'};
   for(const cells of csv){const row=Object.fromEntries(header.map((h,i)=>[h,cells[i]]));const m=months.get(row.month);if(!m)throw new Error(`CSV unknown month ${row.month}`);
     for(const p of Object.keys(platforms))close(row[rawColumns[p]],m.raw[p],`${id}/CSV/${m.month}/${p}`);
     for(const [col,key] of [['harmonized','harm'],['approx_lo','lo'],['approx_hi','hi'],['baseline_median','median']])close(row[col],m[key],`${id}/CSV/${m.month}/${col}`);
     for(const [i,col] of ['south','west','north','east'].entries())close(row[col],preset.box[i],`${id}/CSV/${m.month}/${col}`);
     check(row.anomaly,m.anomaly,`${id}/CSV/${m.month}/anomaly`);check(row.source_code,m.src,`${id}/CSV/${m.month}/source`);
     check(row.source_satellites,m.satellites.join('+'),`${id}/CSV/${m.month}/satellites`);
     const clock=preset.clock.find(c=>c.year===Number(m.month.slice(0,4)));
     check(row.clock_badge_annual,clock?.badge??'not_identifiable',`${id}/CSV/${m.month}/badge`);
     check(row.clock_drivers,clock?.drivers.join('+')??'',`${id}/CSV/${m.month}/drivers`);
     close(row.signed_bend_pct,clock?.bend??null,`${id}/CSV/${m.month}/bend`);coverage.csvRows++;
   }
   await page.locator('nav a[href="#clock"]').click();
   for(const clock of preset.clock){
     await page.getByLabel('Observation year').fill(String(clock.year));
     const state=await page.locator('.clock-explainer').evaluate(el=>({
       year:el.querySelector('.year-chip')?.textContent,
       badge:el.querySelector('.badge-title strong')?.textContent,
       bend:el.querySelector('.bend-value strong')?.textContent??null,
       times:[...el.querySelectorAll('.clock-time')].map(row=>({name:row.querySelectorAll('span')[1]?.textContent,time:row.querySelector('strong')?.textContent,change:row.querySelector('small')?.textContent})),
       tests:[...el.querySelectorAll('.clock-tests > div')].map(row=>({name:row.querySelector('strong')?.textContent,stat:row.querySelector('span')?.textContent,cells:row.querySelector('small')?.textContent}))
     }));
     const p=`${id}/clock/${clock.year}`;
     check(state.year,String(clock.year),p+'/year');check(state.badge,badgeNames[clock.badge],p+'/badge');
     check(state.bend,clock.bend===null?null:signed(clock.bend)+'%',p+'/bend');
     const available=Object.keys(platforms).filter(p=>clock.look[p]!==null);
     check(state.times.length,available.length,p+'/look row count');
     for(const [i,platform] of available.entries()){
       const now=state.times[i];check(now?.name,platforms[platform],p+'/'+platform+'/name');
       check(now?.time,clockTime(clock.look[platform]),p+'/'+platform+'/look');
       check(now?.change,clock.baselineLook[platform]===null?'—':signed(lookChangeMinutes(clock.look[platform],clock.baselineLook[platform]),0)+' min',p+'/'+platform+'/look change');
     }
     check(state.tests.length,clock.tests.length,p+'/test count');
     for(const [i,test] of clock.tests.entries()){
       check(state.tests[i]?.name,platforms[test.platform],p+'/'+test.platform+'/test name');
       check(state.tests[i]?.stat,test.testable?`Δρ ${signed(test.delta,3)} · threshold ${fmt(test.threshold,3)}`:test.reason,p+'/'+test.platform+'/statistic');
       check(state.tests[i]?.cells,`${fmt(test.cells)} matched 1° cells`,p+'/'+test.platform+'/support');
     }
     coverage.clockYearStates++;
   }
   coverage.presetsCompleted++;group(`${id}: calendar, selected detail, CSV, annual clock`);
 }
 const rows=await tableRows(page.locator('.country-table'));
 check(rows.length,countries.length,'World country row count');
 for(const c of countries){
   const row=rows.find(row=>row[0].includes(c.iso3));if(!row)throw new Error(`Missing country ${c.iso3}`);
   check(row[1],signed(c.bend_TA_pct)+'%',`${c.iso3}/combined bend`);
   check(row[2],signed(c.bend_T_pct)+(c.bend_T_pct==null?'':'%'),`${c.iso3}/Terra bend`);
   check(row[3],signed(c.bend_A_pct)+(c.bend_A_pct==null?'':'%'),`${c.iso3}/Aqua bend`);
   check(row[4],String(c.cells),`${c.iso3}/cells`);check(row[5],c.reliable?'Supported':'Limited cells',`${c.iso3}/support`);coverage.countryRows++;
 }
 const world=continents.find(c=>c.continent==='World');
 const metrics=await page.locator('.metric-panel').allInnerTexts();
 includes(metrics[0],signed(world.artifact_2019_2025_pct)+'%','World artifact');
 includes(metrics[0],`${signed(world.lo)}% to ${signed(world.hi)}%`,'World artifact interval');
 includes(metrics[1],fmt(validation.clock_checks.terra_day_night_opposite_share*100,1)+'%','World opposite sign');
 includes(metrics[2],signed(world.dt_T_h*60,0)+' min','World Terra time');
 includes(metrics[2],`Aqua ${signed(world.dt_A_h*60,0)} min`,'World Aqua time');
 group('All country-table values and world headline metrics');

 await page.locator('nav a[href="#validation"]').click();
 await section(page,'The transparent bridge won').waitFor();
 const vcheck=(actual,wanted,where)=>{check(actual,wanted,'Validation/'+where);coverage.validationNumericFields++;};
 const vinc=(actual,wanted,where)=>{includes(actual,wanted,'Validation/'+where);coverage.validationNumericFields++;};
 const regions=['global','punjab','parana'];
 const metricPanels=page.locator('.metric-panel');
 for(const [i,key] of regions.entries()){
   vcheck(await text(metricPanels.nth(i).locator('strong')),fmt(validation.loyo[key].median_annual_err_pct,2)+'%',`${key}/metric annual error`);
   vcheck(await text(metricPanels.nth(i).locator('b')),fmt(validation.loyo[key].r2_log_monthly,3),`${key}/metric R²`);
 }
 const models=validation.models.filter(m=>m.score.primary_tile_median_abs_annual_err_pct!=null);
 for(const [i,model] of models.entries())vcheck(await text(page.locator('.model-bars > div').nth(i).locator('strong')),fmt(model.score.primary_tile_median_abs_annual_err_pct,2)+'%',model.name+'/selection error');
 vinc(await text(page.locator('.lock-strip strong')),validation.locked_test_years.join(' & '),'locked years');
 check(await text(page.locator('.lock-strip code')),validation.config_hash,'Validation/config hash');
 const chosen=validation.models.find(m=>m.name===validation.chosen_model);
 const holds=await tableRows(section(page,'Time holdouts'));
 check(holds.length,regions.length,'Validation/time holdout row count');
 for(const [i,key] of regions.entries()){
   const lo=validation.loyo[key],locked=chosen.score.locked[key];
   for(const [col,wanted] of [[1,fmt(lo.median_annual_err_pct,2)+'%'],[2,fmt(lo.r2_log_monthly,3)],[3,fmt(locked.median_annual_err_pct,2)+'%'],[4,fmt(locked.r2_log_monthly,3)]])vcheck(holds[i][col],wanted,`${key}/holdout column ${col}`);
 }
 vinc(await text(section(page,'Time holdouts').locator('.chart-caption')),validation.training_years.join(', '),'training years');
 const spatial=await tableRows(section(page,'Factors do not travel well'));
 check(spatial.length,validation.loro.by_region.length,'Validation/spatial holdout row count');
 for(const [i,row] of validation.loro.by_region.entries()){
   check(spatial[i][0],row.region,'Validation/spatial region');
   vcheck(spatial[i][1],fmt(row.median_annual_err_pct,1)+'%',row.region+'/spatial error');
   vcheck(spatial[i][2],signed(row.mean_signed_err_pct,1)+'%',row.region+'/spatial signed');
 }
 const denial=await tableRows(section(page,'Take a satellite away'));
 check(denial.length,validation.denial.length,'Validation/denial row count');
 for(const [i,row] of validation.denial.entries()){
   vcheck(denial[i][1],fmt(row.median_err_pct,1)+'%',`denial ${i}/global`);
   vcheck(denial[i][2],fmt(row.punjab?.median_annual_err_pct,1)+'%',`denial ${i}/Punjab`);
 }
 const seams=await page.locator('.seam-comparison strong').allTextContents();
 for(const [i,key] of ['raw_jump','harm_jump','modis_only_jump'].entries())vcheck(seams[i],'×'+fmt(validation.changepoint.seam_2012[key],2),'seam/'+key);
 const drift=Object.entries(validation.changepoint.drift_2020_22.global.R_by_year),bars=page.locator('.drift-spark > div');
 check(await bars.count(),drift.length,'Validation/drift years count');
 for(const [i,[year,value]] of drift.entries()){
   vcheck(await text(bars.nth(i).locator('span')),fmt(value,2),'drift/'+year+'/ratio');
   vcheck(await text(bars.nth(i).locator('small')),year.slice(2),'drift/'+year+'/year');
 }
 vinc(await text(section(page,'Reconstructed MODIS versus observed VIIRS').locator('.chart-caption')),'×'+fmt(validation.changepoint.drift_2020_22.global.seam_2023_25_vs_training,3),'drift aggregate');
 const paired=await tableRows(section(page,'Two VIIRS looks, one day'));
 check(paired.length,pairs.by_region.length,'Validation/same-day pair row count');
 for(const [i,row] of pairs.by_region.entries()){
   vinc(paired[i][0],row.period,`pairs ${i}/period`);
   vcheck(paired[i][1],signed(row.pct_change_per_hour)+'%',`pairs ${i}/change`);
   vcheck(paired[i][2],`${signed(row.ci90[0])}% to ${signed(row.ci90[1])}%`,`pairs ${i}/interval`);
   vcheck(paired[i][3],String(row.n_days),`pairs ${i}/days`);
   vcheck(paired[i][4],signed(row.with_scan_control.pct_change_per_hour)+'%',`pairs ${i}/scan-control change`);
 }
 const weak=await section(page,'Known failures belong on the page').locator('li').allTextContents();
 vinc(weak[0],fmt(validation.loyo.parana.median_annual_err_pct,1)+'%','known Paraná failure');
 vinc(weak[1],fmt(validation.denial.find(r=>r.reconstructed_from==='T')?.punjab?.median_annual_err_pct,1)+'%','known Terra failure');
 const competitor=await text(section(page,'A fair comparison with FireClock').locator('.body-copy'));
 vinc(competitor,fmt(validation.benchmarks[0].median_annual_err_pct,1)+'%','FireClock reported error');
 vinc(competitor,'R² '+fmt(validation.benchmarks[0].r2_log_monthly,3),'FireClock reported R²');
 vinc(competitor,fmt(validation.benchmarks[1].loyo.median_annual_err_pct,1)+'% on LOYO','detections variant LOYO');
 vinc(competitor,fmt(validation.benchmarks[1].locked.median_annual_err_pct,1)+'% on locked','detections variant locked');
 group('Validation page rendered data fields, including holdouts and pair tests');

 await page.locator('nav a[href="#methods"]').click();
 const mcheck=(actual,wanted,where)=>{check(actual,wanted,'Methods/'+where);coverage.methodsDataFields++;};
 const minc=(actual,wanted,where)=>{includes(actual,wanted,'Methods/'+where);coverage.methodsDataFields++;};
 const observations=section(page,'Hotspots are observations, not individual fires');
 await observations.waitFor();
 const platformRows=await tableRows(observations);
 check(platformRows.length,Object.keys(manifest.totals.by_platform).length,'Methods/platform row count');
 for(const [i,[platform,count]] of Object.entries(manifest.totals.by_platform).entries()){
   mcheck(platformRows[i][0],platforms[platform],platform+'/name');mcheck(platformRows[i][1],fmt(count),platform+'/processed rows');
   const period=manifest.platforms[platform];mcheck(platformRows[i][2],period?`${period.first} → ${period.last}`:'Absent from supplied archive',platform+'/coverage');
 }
 const observationText=await text(observations);
 minc(observationText,fmt(manifest.totals.detections_processed),'total rows');
 minc(observationText,`${manifest.totals.archives} archives`,'archive count');
 minc(observationText,fmt(manifest.totals.type0_detections),'retained type0');
 minc(observationText,fmt(manifest.totals.detections_processed-manifest.totals.type0_detections),'excluded types');
 const harmonization=await text(section(page,'One VIIRS scale, with a pre-drift bridge'));
 minc(harmonization,`τ = ${validation.tau}`,'bridge tau');minc(harmonization,`τᵦ = ${validation.tau_b}`,'VIIRS bridge tau');
 const reproducibility=await text(section(page,'What was built and what was checked'));
 minc(reproducibility,`${manifest.totals.archives} manifest records`,'manifest audit count');
 minc(reproducibility,`${catalog.calendar_tiles} calendar tiles`,'calendar tile count');
 minc(reproducibility,fmt(catalog.compressed_json_bytes/1e6,1)+' MB','compressed JSON size');
 group('Methods manifest rows, archive counts, bridge parameters and package size');
 check(runtimeErrors.length,0,'Browser uncaught JavaScript errors');
}catch(error){fatal=error.stack||String(error);console.error(fatal);}
finally{
 await browser.close();
 const result={status:fatal||failureCount?'failed':'passed',base,assertions,failureCount,coverage,groups,failures,fatal,runtimeErrors,
   elapsedSeconds:Number(((Date.now()-started)/1000).toFixed(2)),
   fixtureSha256:createHash('sha256').update(fixtureBytes).digest('hex'),
   scope:'All six supplied presets, all 302 available months in seven display modes, all harmonized selected-month panels, representative raw selected panels, every exported CSV row, all 13 clock years per preset, all 72 country rows, listed validation data fields, and Methods manifest data fields.',
   exclusions:['Arbitrary custom AOIs are covered separately by edge-case tests, not exhaustively enumerated here.','Punjab receipt and new decision text are audited separately.','Raster-figure pixels, visual chart positions, explanatory constants and external scientific claims are not certified by this suite.','No real-person usability test results are implied.'],
   humanUserTesting:'Not performed by this automated suite.'};
 writeFileSync(output,JSON.stringify(result,null,2)+'\n');
 console.log(JSON.stringify({status:result.status,assertions,failureCount,coverage,failures:failures.slice(0,10),elapsedSeconds:result.elapsedSeconds},null,2));
 if(fatal||failureCount)process.exitCode=1;
}
