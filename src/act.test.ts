import {describe,expect,it} from 'vitest';
import {readFileSync} from 'node:fs';
import {gunzipSync} from 'node:zlib';
import {fieldCheckIcs,allDistricts,bestWindow,busiestDays,gapRange,seasonDates,districtAt,weekRatio,historyRatios,countGap,findDistrict,lateShare,pairMask,priority,profileCsv,districtCsv,sum,windowLabel,wording,ALL,type DistrictDoc} from './act';

const doc=JSON.parse(readFileSync('public/data/punjab_districts.json','utf8')) as DistrictDoc;
const state=JSON.parse(readFileSync('public/data/gk2a_hourly_by_year.json','utf8'));
const receipt=JSON.parse(gunzipSync(readFileSync('public/data/punjab_receipt.json.gz')).toString());

describe('Punjab district planner data',()=>{
  it('has 22 districts with 61 daily values per year',()=>{
    expect(doc.districts).toHaveLength(22);
    for(const d of doc.districts)for(const y of doc.years){expect(d.snpp_celldays[y]).toHaveLength(61);expect(d.gk2a_pixel_days[y]).toHaveLength(61);expect(d.gk2a_pixel_hours[y]).toHaveLength(7);}
  });
  it('district pixel-hours plus border pixels equal the statewide hourly file',()=>{
    const all=allDistricts(doc);
    for(const y of doc.years)expect(sum(all.gk2a_pixel_hours[y])+doc.gk2a_unassigned_pixel_hours[y]).toBe(sum(state.pixel_hours[y]));
  });
  it('the all-district comparison tracks the statewide base-year fan',()=>{
    const all=allDistricts(doc);
    for(const f of receipt.base_year_fan){
      const g=countGap(all,doc,f.base,2025);expect(g.ok).toBe(true);if(!g.ok)continue;
      expect(g.masked).toEqual(f.masked_calendar_days);
      expect(Math.abs((g.gkChange/100+1)-f.gk2a)).toBeLessThan(0.03);
      expect(Math.abs((g.snppChange/100+1)-f.snpp)).toBeLessThan(0.02);
    }
  });
});
describe('planner calculations',()=>{
  it('finds the best window and labels it',()=>{
    expect(bestWindow([0,0,0,1,5,9,2],3)).toMatchObject({start:16,end:18,hours:[16,17,18]});
    expect(bestWindow([0,0,0,1,5,10,4],1)).toMatchObject({start:17,share:50});
    expect(windowLabel(16,18)).toBe('4 pm to 6 pm');expect(windowLabel(12,12)).toBe('around noon');
    expect(lateShare([0,0,0,0,0,0,0])).toBeNull();
  });
  it('finds the busiest fortnight',()=>{const b=busiestDays(findDistrict(doc,ALL),doc,2025);expect(b.share).toBeGreaterThan(0);expect(b.from).toMatch(/^\d+ (Oct|Nov)$/);const v=Array(61).fill(0);v[40]=5;expect(busiestDays({name:'x',gk2a_pixel_days:{'2025':v},gk2a_pixel_hours:{},snpp_celldays:{},noaa20_celldays:{}},doc,2025,1)).toMatchObject({from:'10 Nov',share:100});});
  it('pairs outage masks from both years',()=>{expect(pairMask({outage_mmdd:{'2021':['10-04'],'2025':['10-06','10-04']}},2021,2025)).toEqual(['10-04','10-06']);});
  it('refuses thin districts and words only what the sources show',()=>{
    const thin=findDistrict(doc,'Pathankot');expect(countGap(thin,doc,2021).ok).toBe(false);expect(wording(thin,doc,2021)).toBeNull();
    const w=wording(findDistrict(doc,'Fazilka'),doc,2021)!;
    expect(w.say).toMatch(/^Satellite fire counts for Fazilka, taken at about 1:40 pm, fell \d+% between 2021 and 2025/);
    expect(w.dont).toMatch(/^Burning in Fazilka fell \d+%/);
    expect(w.why).toMatch(/whole afternoon fell \d+%.*at 4 pm or later/);
  });
  it('ranks districts by late signal and exports complete CSVs',()=>{
    const r=priority(doc,2025);expect(r).toHaveLength(22);for(let i=1;i<r.length;i++)expect(r[i-1].late).toBeGreaterThanOrEqual(r[i].late);
    expect(Math.round(sum(r.map(x=>x.shareOfState)))).toBe(100);
    expect(profileCsv(doc).trim().split('\n')).toHaveLength(1+23*7*7);
    expect(districtCsv(doc).trim().split('\n')).toHaveLength(1+23*7);
    expect(findDistrict(doc,'nowhere').name).toBe(ALL);
  });
});

describe('audit additions',()=>{
  const week=JSON.parse(readFileSync('public/data/punjab_week.json','utf8')),hist=JSON.parse(readFileSync('public/data/punjab_aqua_daily.json','utf8'));
  it('bootstrap range brackets the point factor and is reproducible',()=>{
    for(const n of [ALL,'Fazilka','Sangrur']){const d=findDistrict(doc,n),g=countGap(d,doc,2021);if(!g.ok)throw Error(n);const r=gapRange(d,doc,2021)!;expect(r[0]).toBeLessThan(g.factor);expect(r[1]).toBeGreaterThan(g.factor);expect(gapRange(d,doc,2021)).toEqual(r);}
    expect(gapRange(findDistrict(doc,'Pathankot'),doc,2021)).toBeNull();
  });
  it('season dates are ordered and refuse thin districts',()=>{
    const s=seasonDates(findDistrict(doc,ALL),doc,2025)!;const n=(x:string)=>(x.endsWith('Nov')?31:0)+parseInt(x);
    expect(n(s.start)).toBeLessThanOrEqual(n(s.mid));expect(n(s.mid)).toBeLessThanOrEqual(n(s.end));
    expect(seasonDates(findDistrict(doc,'Pathankot'),doc,2025)).toBeNull();
  });
  it('finds the district for a location and nothing outside Punjab',()=>{
    for(const d of doc.districts){const g=d.geometry!;const ring=(g.type==='Polygon'?g.coordinates[0]:g.coordinates[0][0]) as number[][];const cx=ring.reduce((s,p)=>s+p[0],0)/ring.length,cy=ring.reduce((s,p)=>s+p[1],0)/ring.length;const hit=districtAt(doc,cy,cx);if(hit)expect(typeof hit).toBe('string');}
    expect(districtAt(doc,30.9,75.85)).toBe('Ludhiana');expect(districtAt(doc,28.6,77.2)).toBeNull();
  });
  it('live week ratio uses only days both satellites recorded fire, and history uses the same calendar days',()=>{
    const w=weekRatio(week);for(const d of w.days){expect(week.by_date.A[d]).toBeGreaterThan(0);expect(week.by_date.J1[d]).toBeGreaterThan(0);}
    expect(w.ratio).toBeCloseTo(w.aqua/w.viirs,10);
    const h=historyRatios(hist,w.days.map((d:string)=>d.slice(5)));expect(h.map(x=>x.year)).toEqual([2013,2014,2015,2016,2017,2018,2019,2020,2021,2022,2023,2024,2025]);
    expect(h.find(x=>x.year===2017)!.ref).toBe('S-NPP');expect(h.find(x=>x.year===2018)!.ref).toBe('NOAA-20');
  });
});

describe('calendar file',()=>{
  it('has one event per day in India time with escaped text',()=>{
    const ics=fieldCheckIcs('Fazilka','2027-10-31',3,16,18,'Note; with, commas','https://x.test/?a=1#act',new Date(Date.UTC(2026,10,15,12,0)));
    expect(ics.match(/BEGIN:VEVENT/g)).toHaveLength(3);
    expect(ics).toContain('DTSTART;TZID=Asia/Kolkata:20271031T160000');expect(ics).toContain('DTEND;TZID=Asia/Kolkata:20271102T180000');
    expect(ics).toContain('DTSTART;TZID=Asia/Kolkata:20271101T160000');
    expect(ics).toContain('Note\\; with\\, commas');expect(ics.split('\r\n').every(l=>l.length<=75)).toBe(true);
  });
});
