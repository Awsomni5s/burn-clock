import {describe,expect,it} from 'vitest';
import {allocate,bestWindow,clock,fieldWindow,km,nearestPlace,patches} from './fieldPlan';

describe('field plan',()=>{
  it('splits teams by highest averages',()=>{
    expect(allocate([100,40,10],3)).toEqual([2,1,0]);
    expect(allocate([100,60,10],3)).toEqual([2,1,0]);
    expect(allocate([10,10,10],2)).toEqual([1,1,0]);
    expect(allocate([5,0],4)).toEqual([4,0]);
    expect(allocate([],3)).toEqual([]);
  });
  it('groups nearby squares into one patrol area seeded by the busiest square',()=>{
    const p=patches([{lat:-5.13,lon:-45.38,n:34},{lat:-5.38,lon:-45.38,n:19},{lat:-12.88,lon:-43.13,n:26},{lat:-12.63,lon:-43.13,n:17}]);
    expect(p).toHaveLength(2);
    expect(p[0].n).toBe(53);expect(p[0].squares).toBe(2);expect(p[0].top.n).toBe(34);
    expect(p[1].n).toBe(43);
  });
  it('measures distance and finds the nearest town',()=>{
    expect(km({lat:0,lon:0},{lat:0,lon:1})).toBeCloseTo(111.2,0);
    expect(nearestPlace(-5.1,-45.4,[{name:'A',lat:-5,lon:-45.4,pop:1},{name:'B',lat:-9,lon:-45,pop:1}])?.name).toBe('A');
  });
  it('picks the busiest 3-hour run from an hourly profile',()=>{
    const w=bestWindow([12,13,14,15,16,17,18],[38,120,91,489,4395,11858,2401])!;
    expect([w.first,w.last]).toEqual([16,18]);expect(w.share).toBeCloseTo(96.2,1);
    expect(clock(16)).toBe('4 pm');expect(clock(13.5)).toBe('1:30 pm');expect(clock(15.73)).toBe('3:45 pm');
  });
  it('only claims a later window when the live check found one, and says there is no hourly record',()=>{
    const s=fieldWindow('signal',13.5,15.75,'America/Fortaleza');expect(s.when).toBe('1:30 pm until at least 4 pm');expect(s.basis).toMatch(/no hourly satellite record/);
    const w=fieldWindow('within',13.5,15.75,'X');expect(w.when).toBe('1:30 pm–3:45 pm');expect(w.basis).toMatch(/No sign this week/);
    expect(fieldWindow('unknown',null,null,'X').basis).toMatch(/Too little data/);
  });
});
