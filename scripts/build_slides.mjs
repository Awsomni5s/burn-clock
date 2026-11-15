// Burn Clock seven-slide overview. All reported metrics read from delivered JSON.
// Run with the Codex bundled Node runtime. No application or scientific input is changed.
import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
const APP=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const ROOT=path.dirname(APP),DATA=path.join(ROOT,'public/data'),TMP=path.join(APP,'.artifact-build/slides');
const DEP=process.env.CODEX_ARTIFACT_DEPENDENCIES??'/Users/ottoskibeli/.cache/codex-runtimes/codex-primary-runtime/dependencies';
const SKILL=process.env.CODEX_PRESENTATIONS_SKILL??'/Users/ottoskibeli/.codex/plugins/cache/openai-primary-runtime/presentations/26.905.11957/skills/presentations';
process.env.RUNTIME_NODE_MODULES=path.join(DEP,'node/node_modules');
process.env.RUNTIME_NODE=path.join(DEP,'node/bin/node');
process.env.RUNTIME_BIN_DIR=path.join(DEP,'bin/override');
const {Presentation,PresentationFile}=await import(pathToFileURL(path.join(DEP,'node/node_modules/@oai/artifact-tool/dist/artifact_tool.mjs')));
const {resolvePresentationFont,applyPresentationChartFont,finalizePresentation}=await import(pathToFileURL(path.join(SKILL,'container_tools/artifact_tool_utils.mjs')));
const load=async f=>JSON.parse(await fs.readFile(path.join(DATA,f),'utf8'));
const [M,V,R,CONT]=await Promise.all([load('manifest.json'),load('validation.json'),load('punjab_receipt.json'),load('world/continents.json')]);
const W=CONT.find(x=>x.continent==='World'),family=resolvePresentationFont({fontFamily:'Arial',availableFonts:['Arial']});
const INK='#272c29',MUTED='#5d665f',ORANGE='#cc6541',GREEN='#497d6a',PAPER='#ffffff';
await fs.mkdir(TMP,{recursive:true});await fs.mkdir(path.join(APP,'public/docs'),{recursive:true});
const pres=Presentation.create({slideSize:{width:1280,height:720}});
const pct=(v,d=1)=>`${v.toFixed(d)}%`;
function text(s,t,x,y,w,h,size=25,color=INK,bold=false){
 const b=s.shapes.add({geometry:'textbox',position:{left:x,top:y,width:w,height:h},fill:'none',line:{fill:'none',width:0}});
 b.text=t;b.text.style={typeface:family,fontSize:size,color,bold,autoFit:'none'};return b;
}
function slide(title,sub){
 const s=pres.slides.add();s.background.fill=PAPER;
 text(s,title,64,44,1152,76,44,INK,true);
 if(sub)text(s,sub,64,130,1152,55,23,MUTED);
 text(s,`${pres.slides.items.length} / 7`,1130,670,85,25,15,MUTED);
 return s;
}
function notes(s,t){s.speakerNotes.textFrame.setText(t);}
function chart(s,type,cfg){const c=s.charts.add(type,{chartFill:PAPER,plotAreaFill:PAPER,chartLine:{fill:'none',width:0},...cfg});applyPresentationChartFont(c,{fontFamily:family});return c;}
function table(s,values,x,y,w,h,widths,size=23){
 const t=s.tables.add({rows:values.length,columns:values[0].length,left:x,top:y,width:w,height:h,columnWidths:widths,values});
 t.styleOptions={headerRow:true,bandedRows:false};t.borders.assign({style:'solid',fill:'#dfe4df',width:.5});
 for(let r=0;r<values.length;r++)for(let c=0;c<values[0].length;c++){
  const cell=t.getCell(r,c);cell.fill=r===0?'#eef3ef':PAPER;
  cell.text.style={typeface:family,fontSize:size,bold:r===0,color:r===0?GREEN:INK};
 }
 return t;
}
const axis={textStyle:{typeface:family,fontSize:18,fill:MUTED},line:{fill:'#c9d1c9',width:1}};

// 1. Purpose and the real delivered data.
{
const s=slide('Burn Clock','A historical fire calendar that makes satellite observation time visible');
text(s,`${(M.totals.detections_processed/1e6).toFixed(1)} million`,64,226,620,88,66,ORANGE,true);
text(s,`FIRMS input rows recorded by the supplied pipeline\n${M.totals.archives} archives · ${M.months.length}-month calendar\n${M.months[0]} to ${M.months.at(-1)}`,64,333,590,137,27);
text(s,'Select an area. Compare months.\nInspect the clocks. Export the evidence.',64,520,650,100,30,GREEN,true);
chart(s,'bar',{position:{left:720,top:215,width:490,height:355},title:'Input rows (millions)',titleTextStyle:{typeface:family,fontSize:20,fill:MUTED},categories:['Terra','Aqua','S-NPP','NOAA-20'],series:[{name:'Input rows (millions)',values:['T','A','N','J1'].map(k=>M.totals.by_platform[k]/1e6),fill:GREEN}],barOptions:{direction:'bar',grouping:'clustered'},hasLegend:false,xAxis:{...axis,numberFormatCode:'0',title:'Input rows (millions)'},yAxis:axis,dataLabels:{showValue:false}});
text(s,'Historical release. No 2026 observations or live feed.',64,636,1030,30,19,MUTED);
notes(s,'Source: public/data/manifest.json. Input-row totals include all types/confidences before de-duplication; they are not fire counts. Coverage is 2000-11 through 2025-12. NASA FIRMS: https://firms.modaps.eosdis.nasa.gov/. Full pipeline was supplied, not rerun in this app build.');
}
// 2. Ratio bridge and the measured model choice.
{
const s=slide('One VIIRS scale','Convert the MODIS era with pre-drift overlap; bridge and average usable VIIRS');
text(s,'k = (V + τ × kparent) / (M + τ)',64,215,1150,72,40,GREEN,true);
text(s,`Production fit: 2013–2019\nLocal → 1° → 5° → global shrinkage\nτ = ${V.tau}; NOAA-20 bridge τb = ${V.tau_b}`,64,332,560,157,28);
text(s,'V  Observed VIIRS\nM  Converted MODIS\nX  No usable data',64,530,510,106,25);
chart(s,'bar',{position:{left:675,top:330,width:540,height:280},title:'Held-out 5° tile-year error (%)',titleTextStyle:{typeface:family,fontSize:20,fill:MUTED},categories:['Ratio bridge','Gradient boosting'],series:[{name:'Median annual error (%)',values:[V.model_choice.primary_bridge,V.model_choice.primary_gbm],fill:ORANGE}],barOptions:{direction:'bar',grouping:'clustered'},hasLegend:false,xAxis:{...axis,min:0,max:12,title:'Held-out 5° tile-year error (%)'},yAxis:{...axis,min:0,max:12},dataLabels:{showValue:true,position:'outEnd',textStyle:{typeface:family,fontSize:22,fill:INK}}});
notes(s,'Source: public/data/validation.json, model_choice and tau/tau_b. Decision rule: ship GBM only if its primary error is <= 0.9 times bridge error. Scores are 8.83% and 10.55% on the pre-registered metric. Training years 2013,2014,2015,2017,2018; locked 2016 and 2019. Production fit uses 2013–2019. NOAA-20 bridge excludes locked 2019. This is within-pipeline model selection, not competitor benchmarking.');
}
// 3. Small real calendar excerpt, aggregated with the application's half-open rule.
{
const years=[2010,2015,2020,2025],monthLabels=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const sums=M.months.map(()=>0),missing=M.months.map(()=>false);let cells=0;
for(const name of ['p25_p070','p25_p075','p30_p070','p30_p075']){
 const t=await load(`tiles/${name}.json`);
 t.cells.forEach(([lat,lon],i)=>{const a=lat+.125,b=lon+.125;if(a>=27.6&&a<32.6&&b>=73.8&&b<77.6){cells++;M.months.forEach((m,j)=>{const v=t.harm[i]?.[j];if(v==null||t.harm_lo[i]?.[j]==null||t.harm_hi[i]?.[j]==null)missing[j]=true;else sums[j]+=v;});}});
}
const s=slide('Calendar & units','Punjab + Haryana excerpt · harmonized daytime active cell-days, thousands');
const values=[['Year',...monthLabels],...years.map(y=>[String(y),...monthLabels.map((_,i)=>{const j=M.months.indexOf(`${y}-${String(i+1).padStart(2,'0')}`);return missing[j]?'—':(sums[j]/1000).toFixed(1);})])];
const t=table(s,values,64,222,1152,276,[96,...Array(12).fill(88)],22);
for(let r=1;r<values.length;r++)for(let c=1;c<values[r].length;c++){
 const value=Number(values[r][c]);const strength=Number.isFinite(value)?Math.min(.74,Math.log1p(value)/6):0;
 const rgb=[255,255,255].map((x,i)=>Math.round(x+(parseInt(GREEN.slice(1+i*2,3+i*2),16)-x)*strength));t.getCell(r,c).fill=`#${rgb.map(x=>x.toString(16).padStart(2,'0')).join('')}`;
}
text(s,'0.05° cell with ≥1 detection in a local solar day',64,535,1130,43,29,GREEN,true);
text(s,'Calendar sums 0.25° cells by their centers. Missing cell-months keep the area missing.\nApproximate area bounds sum cell endpoints; they are not a calibrated 90% interval.',64,591,1120,67,23);
notes(s,`Source: final public/data/tiles/{p25_p070,p25_p075,p30_p070,p30_p075}.json and manifest.json. AOI [south,west,north,east]=[27.6,73.8,32.6,77.6], ${cells} cells, center inside south/west inclusive and north/east exclusive. All cell estimates/bounds must be non-null for an aggregate. Values displayed in thousands to one decimal, not fire counts. Four selected years are illustrative real historical rows, not the full calendar. Unit: daytime type-0 active 0.05-degree cell-days at all confidences on S-NPP scale. Anomaly baseline in app is 2003–2022, same calendar month, linear-interpolated quartiles.`);
}
// 4. Model-based atlas evidence, with its unit distinction visible.
{
const s=slide('The satellite clock changes the comparison','World atlas · supplied detection-based analysis, separate from calendar cell-days');
table(s,[['Region','Estimated distortion (%)'],...CONT.filter(x=>x.continent!=='World').map(x=>[x.continent,pct(x.artifact_2019_2025_pct)])],64,222,735,397,[385,350],25);
text(s,pct(W.artifact_2019_2025_pct),860,240,340,87,66,ORANGE,true);
text(s,`World estimate\nReported bounds:\n${pct(W.lo)} to ${pct(W.hi)}`,860,344,330,126,27);
text(s,'Conditional on attribution assumptions.\nA ratio change does not prove a clock-only cause.',860,500,345,133,24,MUTED);
notes(s,'Source: public/data/world/continents.json. artifact_2019_2025_pct differs from bend_TA_pct. Nominal/high-confidence detections are a different unit from calendar cell-days. This is supplied model-based attribution, not an independently reproduced causal result. The app annual badge uses common complete P/N cell support over 2013–2019 and target year, population SD, threshold=max(2 sigma,0.15), minimum counts P>=50 and N>=200. Clock-wheel look times are medians of cell medians, not pooled detection medians.');
}
// 5. The polar and geostationary evidence stay separate.
{
const s=slide('Punjab receipt: which clock, which baseline?','October–November 2025 / 2021 · ratios within each instrument');
const rows=[['Polar platform','2025 / 2021'],...R.by_clock.map(r=>[r.label,r.ratio.toFixed(3)])];
table(s,rows,64,225,510,290,[310,200],25);
text(s,'Daytime active cell-days.\nTerra and Aqua are drifting clocks.',64,541,510,90,23,MUTED);
chart(s,'line',{position:{left:650,top:220,width:560,height:345},title:'GK2A pixel-hour ratio',titleTextStyle:{typeface:family,fontSize:23,fill:GREEN,bold:true},categories:R.gk2a_by_hour.hours.map(x=>`${x}:00`),series:[{name:'GK2A pixel-hour ratio',values:R.gk2a_by_hour.ratio_2025_2021,line:{fill:ORANGE,width:3},marker:{symbol:'circle',size:7}}],hasLegend:false,xAxis:{...axis,title:'Indian Standard Time'},yAxis:{...axis,min:0,max:2.5,numberFormatCode:'0.0',title:'2025 / 2021'},lineOptions:{smooth:false}});
const ratio=R.gk2a_unique_pixel_days['2025']/R.gk2a_unique_pixel_days['2021'];
const fan21=R.base_year_fan.find(x=>x.base===2021),fan19=R.base_year_fan.find(x=>x.base===2019);
text(s,`Pixel-days, unmasked: ${ratio.toFixed(3)}× 2021\nMatched days: ${fan21.gk2a.toFixed(3)}× 2021 / ${fan19.gk2a.toFixed(3)}× 2019`,650,575,560,66,22,GREEN,true);
text(s,'Preliminary fire/hot-smoke evidence; not ground truth.',64,645,1115,25,18,MUTED);
notes(s,'Source: public/data/punjab_receipt.json. Polar rows use receipt masking. GK2A hourly ratio uses pixel-hours; unique pixel-days unmasked ratio is 16096/24447. Matched-calendar base-year fan: 0.636 against 2021 and 1.727 against 2019; do not conflate masking policies. Official 93% claim uses Sep15–Nov30, different from Oct–Nov receipt. Source https://www.pib.gov.in/PressReleseDetailm.aspx?PRID=2197201&lang=2&reg=3. GK2A source https://zenodo.org/records/20084790 and https://www.mdpi.com/2072-4292/18/10/1506. GK2A confidence>=2, coarse pixels and hour-dependent thresholds; 18:00 near sunset is not a headline. Hot-smoke check inconclusive.');
}
// 6. Validation must show difficult spatial transfer.
{
const s=slide('Validation includes the failures','Supplied pipeline scores · median annual error at different evaluation scales');
const values=[V.loyo.global.median_annual_err_pct,V.loyo.punjab.median_annual_err_pct,V.loyo.tile_5deg.median_abs_annual_err_pct_tile_years,V.loyo.parana.median_annual_err_pct,V.loro.tile_blocks_5deg.median_abs_annual_err_pct_tile_years];
chart(s,'bar',{position:{left:55,top:222,width:790,height:388},title:'Median annual error (%)',titleTextStyle:{typeface:family,fontSize:20,fill:MUTED},categories:['Global LOYO','Punjab + Haryana LOYO','5° tile-year LOYO','Paraná Delta LOYO','Spatial tile-block holdout'],series:[{name:'Median annual error (%)',values,fill:GREEN}],barOptions:{direction:'bar',grouping:'clustered'},hasLegend:false,xAxis:{...axis,min:0,max:50,title:'Median annual error (%)'},yAxis:{...axis,min:0,max:50},dataLabels:{showValue:true,position:'outEnd',textStyle:{typeface:family,fontSize:21,fill:INK}}});
text(s,'Global totals can hide regional errors',872,237,335,105,30,ORANGE,true);
text(s,'Sparse cells and spatial transfer remain weak.\n\nThe Terra-only era has no contemporaneous VIIRS check.\n\nZero MODIS may yield zero with a zero-width range.',872,364,335,270,24);
notes(s,'Source: public/data/validation.json. LOYO is leave one training year out; training years 2013,2014,2015,2017,2018. Locked test years 2016 and 2019. Spatial tile-block holdout is a different test; values must not be compared as identical designs. Global 1.06%, Punjab/Haryana 5.91%, tile-year8.83%, Paraná21.31%, spatial40.71%. GBM spatial holdout was not run. Full pipeline was not rerun because intermediate Parquet inputs were absent.');
}
// 7. Reproducible demo and explicit limits.
{
const s=slide('Use the record, then inspect its limits','Two-minute demonstration');
table(s,[['Time','Action'],['0:00–0:30','Choose Punjab + Haryana; inspect a calendar month'],['0:30–1:00','Open Satellite clock; compare Terra, Aqua and VIIRS'],['1:00–1:30','Open Punjab receipt; change the comparison year'],['1:30–2:00','Read validation limits; download CSV and methods']],64,220,1152,260,[200,952],25);
text(s,`${M.totals.archives} manifest records reconciled; one archive independently re-downloaded.\nThe full scientific pipeline was supplied and was not rerun in this app build.`,64,521,1140,80,23);
text(s,'burn-clock.ottoskibeli.chatgpt.site',64,612,1000,38,27,GREEN,true);
text(s,'Owner authentication may be required. AI-assisted build and documentation; independent project, not NASA-approved.',64,653,1070,32,17,MUTED);
notes(s,'App URL: https://burn-clock.vercel.app (public). Earlier note retired; no public-access claim. Source docs: DATA_PROVENANCE.md, SOURCE_AUDIT.md, VALIDATION_REPORT.md and JUDGE_DEMO.md. All 48 source URL/byte/hash/row records reconcile internally; MODIS 2000 independently checked (4,658,057 bytes; 261,363 rows; sha256 569669636fd149a5cbc41a9c77bef994c20a700e17011940046f12e69cf977a2). AI/SI disclosure: app, documentation and artifact preparation used Codex; supplied research pipeline separately used AI assistance. Scientific results require human review before policy or research use.');
}

const draft=path.join(TMP,'candidate.pptx');await (await PresentationFile.exportPptx(pres)).save(draft);
for(let i=0;i<pres.slides.items.length;i++){
 const s=pres.slides.items[i];const png=await pres.export({slide:s,format:'png',scale:1.2});await fs.writeFile(path.join(TMP,`slide-${i+1}.png`),new Uint8Array(await png.arrayBuffer()));
}
const finalDir=path.join(APP,'.artifact-build/final');await fs.mkdir(finalDir,{recursive:true});
const final=path.join(finalDir,`Burn_Clock_7_Slides_${Date.now()}.pptx`);
const result=await finalizePresentation({workspaceDir:APP,candidatePath:draft,finalPath:final,pythonExecutable:path.join(DEP,'python/bin/python3'),integrityValidatorPath:path.join(SKILL,'container_tools/inspect_presentation_package_integrity.py'),layoutValidatorPath:path.join(SKILL,'container_tools/inspect_presentation_layout_geometry.py'),layoutArgs:['--expected-slide-size-emu','12192000,6858000','--validate-heading-fit','--require-native-table-slide','3','--require-native-table-slide','4','--require-native-table-slide','5','--require-native-table-slide','7'],explicitTotalSlideCount:7,requiredNativeChartOwnerSlides:[1,2,5,6],requiredNativeTableOwnerSlides:[3,4,5,7],materializeLiteralChartWorkbooks:true,fontPolicy:{basis:'design',families:[family]},verifyArtifactToolImport:true,receiptPath:path.join(TMP,`${path.basename(final)}.validation.json`)});
await fs.copyFile(final,path.join(APP,'public/docs/Burn_Clock_7_Slides.pptx'));
console.log(JSON.stringify(result));
