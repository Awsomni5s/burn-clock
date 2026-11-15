import {describe,it,expect} from 'vitest';
import {areaTiles,inside,validBox,quantile,createAccumulator,computeClock,csvForArea,hour,number,lookChangeMinutes,signed} from './data';
import {PLATFORMS,type Manifest,type CalendarTile,type ClockTile,type BBox,type Platform} from './types';
const box:BBox=[0,0,2,2];
const manifest=(months:string[]):Manifest=>({generated_utc:'2026-11-14',months,tiles:['p00_p000'],sources:[],outage_months:[],platforms:{T:{first:'2000-11',last:'2025-12'},A:{first:'2002-07',last:'2025-12'},N:{first:'2012-01',last:'2025-12'},J1:{first:'2018-04',last:'2025-12'}},totals:{detections_processed:0,by_platform:{T:0,A:0,N:0,J1:0,J2:0},type0_detections:0,active_cell_days:0,archives:0}});
function tile(values:(number|null)[][]):CalendarTile{return {tile:'p00_p000',cells:values.map((_,i)=>[i*.25,0]),harm:values,harm_lo:values.map(r=>r.map(v=>v==null?null:v*.8)),harm_hi:values.map(r=>r.map(v=>v==null?null:v*1.2)),raw:Object.fromEntries(PLATFORMS.map(p=>[p,p==='J2'?[]:values])) as CalendarTile['raw'],src:values.map(r=>r.map(v=>v==null?'X':'V').join(''))};}
function clockFixture():ClockTile{const years=[2013,2014,2015,2016,2017,2018,2019,2020,2021,2022,2023,2024,2025];const day=Object.fromEntries(PLATFORMS.map(p=>[p,[years.map(()=>p==='N'?1000:p==='T'?100:200)]])) as ClockTile['day'];return {tile:'p00_p000',cells:[[0,0]],years,season_months:[[1,2,3]],day,night:day,look:Object.fromEntries(PLATFORMS.map(p=>[p,[years.map(()=>p==='T'?10:13)]])) as ClockTile['look']};}
describe('geographic selection',()=>{
  it('selects negative and positive tile origins across the date line',()=>{expect(areaTiles(['m05_p175','m05_m180','p00_p170','p00_p000'],[-4,174,1,-176])).toEqual(['m05_p175','m05_m180','p00_p170']);});
  it('uses half-open bounds and supports date-line boxes',()=>{expect(inside(1,179,[0,170,2,-170])).toBe(true);expect(inside(1,-179,[0,170,2,-170])).toBe(true);expect(inside(1,0,[0,170,2,-170])).toBe(false);expect(inside(2,1,box)).toBe(false);});
  it('rejects invalid or empty bounds',()=>{expect(validBox([2,0,1,2])).toBe(false);expect(validBox([-91,0,10,2])).toBe(false);expect(validBox([0,0,1,0])).toBe(false);expect(validBox([-90,-180,90,180])).toBe(true);});
  it('selects cell centers rather than southwest corners',()=>{const acc=createAccumulator(manifest(['2025-01']));acc.add(tile([[7]]),[.1,.1,.2,.2]);expect(acc.finish().cellCount).toBe(1);});
});
describe('monthly sums, nulls and anomalies',()=>{
  it('retains observed zeros but never substitutes zero for missing values',()=>{const acc=createAccumulator(manifest(['2025-01','2025-02','2025-03']));acc.add(tile([[0,null,8],[0,null,2]]),box);const r=acc.finish();expect(r.months.map(m=>m.harm)).toEqual([0,null,10]);expect(r.months[2].lo).toBeCloseTo(8);expect(r.months[0].raw.J2).toBe(null);});
  it('does not display a partial sum when one included cell is missing',()=>{const acc=createAccumulator(manifest(['2025-01']));acc.add(tile([[5],[null]]),box);expect(acc.finish().months[0].harm).toBe(null);expect(acc.finish().months[0].raw.N).toBe(null);});
  it('an area with no archived cell centers is no data',()=>{const acc=createAccumulator(manifest(['2025-01']));acc.add(tile([[0]]),[10,10,11,11]);expect(acc.finish().cellCount).toBe(0);expect(acc.finish().months[0].harm).toBe(null);});
  it('calculates same-month baseline quantiles only within 2003–2022',()=>{const months=['2002-01','2003-01','2004-01','2005-01','2006-01','2023-01','2025-01','2003-02'];const acc=createAccumulator(manifest(months));acc.add(tile([[10000,10,20,30,40,20000,35,1000]]),box);const r=acc.finish().months[6];expect(r.median).toBe(25);expect(r.p25).toBe(17.5);expect(r.p75).toBe(32.5);expect(r.anomaly).toBe('above');});
  it('keeps valid harmonization when raw monthly coverage is masked',()=>{const m=manifest(['2024-07']);m.outage_months=[{platform:'N',month:'2024-07',missing_days:Array.from({length:13},(_,i)=>`2024-07-${i+1}`),masked:true}];const t=tile([[5]]);t.raw.N=[[null]];const a=createAccumulator(m);a.add(t,box);expect(a.finish().months[0]).toMatchObject({harm:5,raw:{N:null},satellites:['N','J1']});});
  it('interpolates quantiles and formats midnight correctly',()=>{expect(quantile([40,10,20,30],.25)).toBe(17.5);expect(quantile([],.5)).toBe(null);expect(hour(23.999)).toBe('00:00');});
});
describe('clock diagnostic',()=>{
  it('a weak Terra count does not suppress a testable Aqua signal',()=>{const t=clockFixture();t.day.T[0][12]=12;t.day.A[0][12]=400;const c=computeClock([t],box).at(-1)!;expect(c.badge).toBe('clock_sensitive');expect(c.drivers).toEqual(['A']);expect(c.tests[0].testable).toBe(false);expect(c.tests[1].delta).toBeCloseTo(Math.log(2));});
  it('marks insufficient VIIRS support as not identifiable',()=>{const t=clockFixture();t.day.N[0][12]=199;expect(computeClock([t],box).at(-1)?.badge).toBe('not_identifiable');});
  it('does not issue a drift verdict before 2021',()=>{const t=clockFixture();expect(computeClock([t],box)[0].badge).toBe('not_evaluated');});
  it('uses a two-sided threshold and preserves the robust state',()=>{const t=clockFixture();expect(computeClock([t],box).at(-1)?.badge).toBe('robust');t.day.T[0][12]=50;expect(computeClock([t],box).at(-1)?.drivers).toContain('T');});
  it('compares the same complete cells over baseline and target',()=>{const t=clockFixture();t.cells.push([1,1]);for(const p of PLATFORMS){t.day[p].push(t.years.map(()=>100000));t.look[p].push(t.years.map(()=>12));}t.day.N[1][12]=null;const c=computeClock([t],box).at(-1)!;expect(c.badge).toBe('robust');expect(c.tests[0].cells).toBe(1);expect(c.bend).toBeCloseTo(0);});
  it('never interprets incomplete baseline support as zero',()=>{const t=clockFixture();t.day.N[0][0]=null;expect(computeClock([t],box).at(-1)?.badge).toBe('not_identifiable');});
});
describe('CSV evidence',()=>{
  it('exports blanks for null, zero for zero, and provenance with explicitly monthly timing checks',()=>{const a=createAccumulator(manifest(['2025-01']));a.add(tile([[0]]),box);const csv=csvForArea(a.finish().months,computeClock([clockFixture()],box),box);expect(csv).toContain('timing_later_burning');expect(csv).toContain('timing_modis_relationship');expect(csv).toContain('source_satellites');expect(csv).toContain('unknown');expect(csv).toContain(',0,0,0,0,,0,0,0,');expect(csv).toContain('not a calibrated AOI 90% interval');});
});

describe('decimal display boundaries',()=>{
 it('preserves exact hundredth totals before display rounding',()=>{const a=createAccumulator(manifest(['2025-01']));const t=tile(Array.from({length:500},(_,i)=>[i===0?.79:.29]));t.cells=t.cells.map((_,i)=>[0,i*.25]);a.add(t,[-90,-180,90,180]);expect(a.finish().months[0].harm).toBe(145.5);expect(number(a.finish().months[0].harm)).toBe('146');});
 it('does not round interpolated floating noise to the wrong tenth',()=>{expect(number(580.9499999999999,1)).toBe('581.0');expect(number(145.5)).toBe('146');expect(number(-1.1499999999999999,1)).toBe('-1.2');});
 it('preserves positive and negative half-minute satellite shifts',()=>{expect(lookChangeMinutes(13.085,13.11)).toBe(-1.5);expect(signed(lookChangeMinutes(13.085,13.11),0)).toBe('-2');expect(signed(lookChangeMinutes(14.325,13.15),0)).toBe('+71');});
});
