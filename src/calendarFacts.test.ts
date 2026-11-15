import {describe,expect,it} from 'vitest';
import {calendarFacts} from './components/Calendar';
const months=(fn:(y:number,m:number)=>number)=>{const out:any[]=[];for(let y=2001;y<=2025;y++)for(let m=1;m<=12;m++)out.push({month:`${y}-${String(m).padStart(2,'0')}`,harm:fn(y,m)});return out;};
describe('calendar facts',()=>{
  it('finds the smallest run of months holding half a typical year, and compares the latest year',()=>{
    const f=calendarFacts(months((y,m)=>m===10||m===11?50:m===5?20:2))!;
    expect(f.peak).toBe('Oct–Nov');expect(Math.round(f.peakShare)).toBe(Math.round(100*100/138));
    expect(f.latestYear).toBe(2025);expect(Math.round(f.latestChange)).toBe(0);
  });
  it('splits separate peaks and ignores pre-2003 years for the busiest year',()=>{
    const f=calendarFacts(months((y,m)=>(y===2001?1000:1)*(m===5?30:m===11?30:1)))!;
    expect(f.peak).toBe('May and Nov');expect(f.busiestYear).not.toBe(2001);
  });
  it('needs at least ten complete baseline years',()=>{expect(calendarFacts(months(()=>1).filter((m:any)=>m.month>'2015'))).toBeNull();});
});
