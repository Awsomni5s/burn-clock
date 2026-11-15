import {readFileSync} from 'node:fs';
import {gunzipSync} from 'node:zlib';
import {describe,expect,it} from 'vitest';
import {areaTiles,computeClock,createAccumulator} from './data';
import {computeClaim,computeTrend,formatClock,interpolateCurve,localClock,shiftedCurve,shiftedRatio,theilSen} from './stats';
import {PLATFORMS,PRESETS,type AreaResult,type CalendarTile,type Catalog,type ClockTile,type Manifest,type Month} from './types';

const manifest={outage_months:[]} as unknown as Manifest;
const row=(year:number,harm:number|null,opts:Partial<Month>={}):Month=>({month:`${year}-10`,harm,lo:harm==null?null:harm*.8,hi:harm==null?null:harm*1.2,raw:{T:100,A:200,N:300,J1:400,J2:null},src:'V',satellites:['N'],anomaly:'normal',median:null,p25:null,p75:null,...opts});
const area=(months:Month[]):AreaResult=>({box:[0,0,1,1],cellCount:1,tileCount:1,months,clock:[]});

describe('claim checker safeguards and defined math',()=>{
  it('sums selected months; uses cross-divided bounds and deduplicates months',()=>{
    const input=area([row(2021,100),row(2021,200,{month:'2021-11'}),row(2025,50),row(2025,100,{month:'2025-11'})]);
    const claim=computeClaim(input,[11,10,10],2021,2025,manifest);
    expect(claim.months).toEqual([10,11]);expect(claim.harmonized.status).toBe('ok');
    expect(claim.harmonized.sumA).toBe(300);expect(claim.harmonized.sumB).toBe(150);
    expect(claim.harmonized.ratio).toBe(.5);expect(claim.harmonized.range).toEqual([120/360,180/240]);
    expect(claim.platforms.find(p=>p.platform==='N')?.ratio).toBe(1);
    expect(claim.platforms.find(p=>p.platform==='J2')?.status).toBe('missing_months');
  });
  it('requires both raw totals >=50, distinguishing a missing month from zero',()=>{
    const input=area([row(2021,100,{raw:{T:50,A:49,N:null,J1:0,J2:null}}),row(2025,60,{raw:{T:50,A:100,N:100,J1:100,J2:null}})]);
    const claims=computeClaim(input,[10],2021,2025,manifest).platforms;
    expect(claims.map(p=>p.status)).toEqual(['ok','too_few','missing_months','too_few','missing_months']);
    expect(claims[3].sumA).toBe(0);expect(claims[3].ratio).toBeNull();
    expect(computeClaim(input,[10,11],2021,2025,manifest).harmonized.status).toBe('missing_months');
  });
  it('does not divide by zero, invent missing bounds, or accept reversed bounds',()=>{
    expect(computeClaim(area([row(2021,0),row(2025,1)]),[10],2021,2025,manifest).harmonized.status).toBe('zero_baseline');
    expect(computeClaim(area([row(2021,1,{lo:0}),row(2025,1)]),[10],2021,2025,manifest).harmonized.range).toBeNull();
    expect(computeClaim(area([row(2021,1,{lo:null}),row(2025,1)]),[10],2021,2025,manifest).harmonized.status).toBe('missing_months');
    expect(computeClaim(area([row(2021,1,{lo:2,hi:1}),row(2025,1)]),[10],2021,2025,manifest).harmonized.status).toBe('invalid_bounds');
  });
  it('returns explicit unavailable states for empty, malformed and absent selections',()=>{
    for(const months of [[],[0],[13],[1.1],[Number.NaN]])expect(computeClaim(area([]),months,2021,2025,manifest).harmonized.status).toBe('invalid_selection');
    expect(computeClaim(area([]),[10],2021,2025,manifest).harmonized.status).toBe('missing_months');
    expect(computeClaim(area([]),[10],2021.5,2025,manifest).harmonized.status).toBe('invalid_selection');
  });
  it('warns across 2012 and for a >30% converted share; source mixtures count as converted',()=>{
    const input=area([row(2011,100,{src:'MV'}),row(2012,110)]);
    const claim=computeClaim(input,[10],2011,2012,manifest);
    expect(claim.convertedShare).toBe(.5);expect(claim.selectedMonthCount).toBe(2);
    expect(claim.warnings.map(w=>w.code)).toContain('seam_2012');
    expect(claim.warnings.map(w=>w.code)).toContain('converted_modis');
    expect(claim.timingStatus).toBe('before_2021');
    const same=computeClaim(input,[10],2011,2011,manifest);
    expect(same.selectedMonthCount).toBe(1);expect(same.convertedShare).toBe(1);
  });
  it('reports selected outages without treating a partial interruption as a zero month',()=>{
    const withOutages={...manifest,outage_months:[{platform:'N' as const,month:'2024-11',missing_days:['2024-11-03','2024-11-04','2024-11-05','2024-11-06'],masked:false}]};
    const input=area([row(2021,100,{month:'2021-11'}),row(2024,80,{month:'2024-11'})]);
    const claim=computeClaim(input,[11],2021,2024,withOutages);
    expect(claim.harmonized.status).toBe('ok');expect(claim.outages).toHaveLength(1);
    expect(claim.warnings.find(w=>w.code==='outage')?.message).toContain('November 2024');
    expect(claim.timingStatus).toBe('missing');
    expect(computeClaim(input,[10],2021,2024,withOutages).outages).toHaveLength(0);
  });
});

describe('descriptive Theil–Sen trend',()=>{
  it('takes the median of every pairwise slope rather than ordinary least squares',()=>{
    expect(theilSen([{year:2000,value:0},{year:2001,value:1},{year:2002,value:2},{year:2003,value:100}])).toBe((1+100/3)/2);
    expect(theilSen([{year:2000,value:1}])).toBeNull();
  });
  it('normalizes both bound slopes by median central H and orders negative endpoints',()=>{
    const input=area([row(2012,100,{lo:50,hi:150}),row(2013,80,{lo:40,hi:120}),row(2014,60,{lo:30,hi:90})]);
    const result=computeTrend(input,[10],2012,2014);
    expect(result.median).toBe(80);expect(result.slope).toBe(-20);expect(result.pctPerYear).toBe(-25);
    expect(result.rangePct).toEqual([-37.5,-12.5]);expect(result.verdict).toBe('falling');
    expect(result.warnings.find(w=>w.code==='approximate_slope_range')?.message).toContain('not a calibrated confidence interval');
  });
  it('labels a bound-slope range crossing zero as no clear trend',()=>{
    const result=computeTrend(area([row(2012,10,{lo:8,hi:12}),row(2013,11,{lo:7,hi:15}),row(2014,12,{lo:6,hi:18})]),[10],2012,2014);
    expect(result.pctPerYear).toBeGreaterThan(0);expect(result.rangePct?.[0]).toBeLessThan(0);expect(result.verdict).toBe('no_clear_trend');
  });
  it('excludes incomplete years and uses actual year spacing, not a compact index',()=>{
    const result=computeTrend(area([row(2012,10),row(2013,null),row(2014,14)]),[10],2012,2014);
    expect(result.excludedYears).toEqual([2013]);expect(result.slope).toBe(2);expect(result.status).toBe('ok');
    expect(result.warnings.map(w=>w.code)).toContain('incomplete_years');
  });
  it('requires two complete years and a positive median for percentage trends',()=>{
    expect(computeTrend(area([row(2012,0),row(2013,0)]),[10],2012,2013).status).toBe('zero_median');
    expect(computeTrend(area([row(2012,10)]),[10],2012,2013).status).toBe('too_few_years');
    expect(computeTrend(area([]),[],2012,2025).status).toBe('invalid_selection');
    expect(computeTrend(area([]),[10],2025,2012).status).toBe('invalid_selection');
  });
  it('reports an opposite MODIS trend only with complete same-year Terra and Aqua',()=>{
    const input=area([row(2012,100,{raw:{T:50,A:50,N:100,J1:null,J2:null}}),row(2013,80,{raw:{T:60,A:60,N:80,J1:null,J2:null}})]);
    expect(computeTrend(input,[10],2012,2013).modisOpposite).toBe(true);
    input.months[1].raw.A=null;
    const incomplete=computeTrend(input,[10],2012,2013);
    expect(incomplete.modisSlope).toBeNull();expect(incomplete.modisOpposite).toBe(false);
    expect(incomplete.warnings.map(w=>w.code)).toContain('modis_incomplete');
  });
});

describe('clock illustration and fixed-offset conversion',()=>{
  it('interpolates between measured hours and drops the shifted curve beyond the displayed window',()=>{
    expect(interpolateCurve([12,13,14],[10,20,40],13.5)).toBe(30);
    expect(shiftedCurve([12,13,14],[10,20,40],1)).toEqual([0,10,20]);
    expect(shiftedRatio([12,13,14],[10,20,40],1,13.5)).toBe(.5);
    expect(shiftedRatio([12,13,14],[10,20,40],3,13.5)).toBe(0);
    expect(shiftedRatio([12,13,14],[0,0,0],1,13.5)).toBeNull();
    expect(interpolateCurve([12,12],[10,20],12)).toBeNull();
    expect(shiftedRatio([12,13],[10,20],-1,13)).toBeNull();
  });
  it('converts solar time with an explicit longitude and UTC offset; wraps clock rounding',()=>{
    expect(localClock(13.5,75,5.5)).toBe(14);
    expect(localClock(23,-150,14)).toBe(23);
    expect(localClock(null,75,5.5)).toBeNull();
    expect(formatClock(23.999)).toBe('00:00');expect(formatClock(-.5)).toBe('23:30');expect(formatClock(null)).toBe('—');
  });
});

const root=new URL('../',import.meta.url);
const read=<T,>(path:string):T=>JSON.parse(gunzipSync(readFileSync(new URL('public/data/'+path+'.json.gz',root))).toString());
const reference=JSON.parse(readFileSync(new URL('scripts/stats_expected.json',root),'utf8'));
const realManifest=read<Manifest>('manifest');
const catalog=JSON.parse(readFileSync(new URL('public/data/catalog.json',root),'utf8')) as Catalog;
let referenceLeaves=0;
function matches(actual:any,expected:any,path:string):void {
  if(typeof expected==='number'){
    expect(typeof actual,path).toBe('number');expect(Math.abs(actual-expected),path).toBeLessThanOrEqual(Math.max(1e-8,Math.abs(expected)*1e-10));referenceLeaves++;
  }else if(expected===null||typeof expected!=='object'){expect(actual,path).toEqual(expected);referenceLeaves++;}
  else if(Array.isArray(expected)){expect(actual?.length,path+'.length').toBe(expected.length);expected.forEach((v,i)=>matches(actual[i],v,`${path}[${i}]`));}
  else for(const [key,value] of Object.entries(expected))matches(actual?.[key],value,path+'.'+key);
}
describe('independent Python fixture loaded directly from source gzip files',()=>{
  for(const preset of PRESETS)it(`${preset.name}: all claim and trend cases`,()=>{
    const names=areaTiles(realManifest.tiles,preset.box),acc=createAccumulator(realManifest);
    for(const name of names)acc.add(read<CalendarTile>('tiles/'+name),preset.box);
    const input:AreaResult={box:preset.box,tileCount:names.length,...acc.finish(),clock:computeClock(areaTiles(catalog.clock_tiles,preset.box).map(name=>read<ClockTile>('clock/'+name)),preset.box)};
    const cases=reference.presets[preset.id];
    for(const expected of cases.claims)matches(computeClaim(input,expected.months,expected.a,expected.b,realManifest),expected,`${preset.id}.claim.${expected.a}.${expected.b}`);
    for(const expected of cases.trends)matches(computeTrend(input,expected.months,expected.start,expected.end),expected,`${preset.id}.trend.${expected.start}.${expected.end}`);
  });
  it('matches independent empty, one-cell, equator and antimeridian reference areas',()=>{
    for(const [id,edge] of Object.entries(reference.edges) as [string,any][]){
      const names=areaTiles(realManifest.tiles,edge.box),acc=createAccumulator(realManifest);
      for(const name of names)acc.add(read<CalendarTile>('tiles/'+name),edge.box);
      const input:AreaResult={box:edge.box,tileCount:names.length,...acc.finish(),clock:computeClock(areaTiles(catalog.clock_tiles,edge.box).map(name=>read<ClockTile>('clock/'+name)),edge.box)};
      matches(input.cellCount,edge.cellCount,id+'.cellCount');matches(input.months[0],edge.earlyMonth,id+'.earlyMonth');
      const c=edge.claim;matches(computeClaim(input,c.months,c.a,c.b,realManifest),c,id+'.claim');
    }
  });
  it('matches the real 2021 curve at eight shift values',()=>{
    const receipt=read<{gk2a_by_hour:{hours:number[];pixel_hours_2021:number[]}}>('punjab_receipt');
    const {hours,pixel_hours_2021:values}=receipt.gk2a_by_hour;
    for(const c of reference.curve){matches(shiftedCurve(hours,values,c.shift),c.curve,`shift.${c.shift}`);matches(shiftedRatio(hours,values,c.shift,c.hour),c.ratio,`ratio.${c.shift}`);}
    console.info(`Claim/trend/curve independent Python numerical and state comparisons: ${referenceLeaves}.`);
    expect(referenceLeaves).toBeGreaterThan(1000);
    expect(PLATFORMS).toHaveLength(5);
  });
});
