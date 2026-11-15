import {describe,expect,it} from 'vitest';
import {seasonRuns,nextSeasons,seasonICS,runLabel,whenAction,weekAction} from './nextMove';
import {parseShape,circlePolys,inPolys,shapeBox,simplify,encodeCircle,encodePoly,encodeProvince} from './shape';

describe('season runs',()=>{
  it('groups contiguous months and joins December to January',()=>{
    expect(seasonRuns([10,11])).toEqual([[10,11]]);
    expect(seasonRuns([4,5,10,11])).toEqual([[4,5],[10,11]]);
    expect(seasonRuns([1,2,12])).toEqual([[12,1,2]]);
    expect(runLabel([12,1,2])).toBe('Dec–Feb');
  });
  it('finds the current or next season',()=>{
    const now=new Date(Date.UTC(2026,10,15));
    const [s]=nextSeasons([10,11],now);expect(s.now).toBe(true);expect(s.start.toISOString().slice(0,10)).toBe('2026-10-01');expect(s.end.toISOString().slice(0,10)).toBe('2026-12-01');
    const [t]=nextSeasons([7,8,9],now);expect(t.now).toBe(false);expect(t.start.toISOString().slice(0,10)).toBe('2027-07-01');expect(t.daysToStart).toBe(228);
    const [w]=nextSeasons([12,1],new Date(Date.UTC(2027,0,10)));expect(w.now).toBe(true);expect(w.start.toISOString().slice(0,10)).toBe('2026-12-01');expect(w.end.toISOString().slice(0,10)).toBe('2027-02-01');
  });
  it('writes a valid iCalendar file with reminders',()=>{
    const ics=seasonICS({name:'Punjab + Haryana',months:[10,11],share:63.2,link:'https://burn-clock.vercel.app/#home',today:new Date(Date.UTC(2026,10,15))});
    expect(ics.startsWith('BEGIN:VCALENDAR\r\n')).toBe(true);expect(ics.trim().endsWith('END:VCALENDAR')).toBe(true);
    expect(ics.match(/BEGIN:VEVENT/g)).toHaveLength(2);expect(ics).toContain('DTSTART;VALUE=DATE:20261001');expect(ics).toContain('DTSTART;VALUE=DATE:20271001');
    expect(ics).toContain('TRIGGER:-P14D');expect(ics).toContain('63% of a typical year');
    for(const line of ics.split('\r\n'))expect(line.length).toBeLessThanOrEqual(75);
  });
  it('has an action for every job',()=>{
    for(const r of ['policy','air','journalist','research'] as const){expect(whenAction(r,'Oct–Nov',63)).toContain('Oct–Nov');expect(weekAction(r,'signal').length).toBeGreaterThan(20);}
    expect(weekAction('policy','within')).toContain('No timing shift');
  });
});

describe('area shapes',()=>{
  it('round-trips URL shapes',()=>{
    expect(parseShape(encodeCircle(30.5,75.5,100))).toEqual({kind:'circle',lat:30.5,lon:75.5,km:100});
    expect(parseShape(encodeProvince('IND','IND-3249'))).toEqual({kind:'province',a3:'IND',id:'IND-3249'});
    expect(parseShape('n:BRA')).toEqual({kind:'country',a3:'BRA'});
    expect(parseShape(encodePoly([[75,30],[76,30],[76,31]]))).toEqual({kind:'poly',ring:[[75,30],[76,30],[76,31]]});
    expect(parseShape('c:95,0,10')).toBeNull();expect(parseShape('x:1')).toBeNull();expect(parseShape('p:1,2;3,4')).toBeNull();
  });
  it('tests points inside circles and polygons with holes',()=>{
    const c=circlePolys(30,75,100);expect(inPolys(30,75,c)).toBe(true);expect(inPolys(30,76.2,c)).toBe(false);
    const [s,w,n,e]=shapeBox(c);expect(n-s).toBeCloseTo(200/111.32,1);expect(e).toBeGreaterThan(76);expect(w).toBeLessThan(74);
    const donut=[[[[0,0],[10,0],[10,10],[0,10],[0,0]],[[4,4],[6,4],[6,6],[4,6],[4,4]]]];
    expect(inPolys(2,2,donut)).toBe(true);expect(inPolys(5,5,donut)).toBe(false);
  });
  it('simplifies a hand-drawn line to at most the cap',()=>{
    const pts=Array.from({length:1000},(_,i)=>[Math.cos(i/159)*2+75,Math.sin(i/159)*2+30]);
    const closed=[...pts,pts[0]],rc=simplify(closed);expect(rc.length).toBeGreaterThanOrEqual(4);
    const r=simplify(pts,0.001,160);expect(r.length).toBeLessThanOrEqual(160);expect(r.length).toBeGreaterThan(10);
  });
});

import {liveAmount,type LiveCells} from './liveCheck';
import {thisWeekAction} from './nextMove';
describe('this week compared with usual',()=>{
  const months=Array.from({length:7},(_,i)=>({month:`${2019+i}-11`,raw:{T:null,A:null,N:null,J1:300*(i+1),J2:null},harm:null,lo:null,hi:null,src:'V',satellites:[],anomaly:'normal',median:null} as any));
  const doc=(j1:number):LiveCells=>({generated_utc:'',window:{first_date:'2026-11-08',last_date:'2026-11-14'},columns:[],bin_deg:0.25,rows:[[30,75,0,0,j1,0]],median_daytime_local_solar_hour:{} as any} as any);
  it('scales the archive month to a week of the same satellite and ranks this week',()=>{
    const r=liveAmount(doc(100),[29,74,32,77],months);
    expect(r.days).toBe(7);expect(r.median).toBeCloseTo(1200*7/30,6);expect(r.min).toBeCloseTo(300*7/30,6);expect(r.status).toBe('below');
    expect(liveAmount(doc(1000),[29,74,32,77],months).status).toBe('record');
    expect(liveAmount(doc(10),[29,74,32,77],months).status).toBe('lowest');
    expect(liveAmount(doc(10),[0,0,1,1],months).status).toBe('lowest');
    expect(liveAmount(doc(10),[29,74,32,77],months.slice(0,3)).status).toBe('unknown');
  });
  it('never calls a low count progress when burning moved later',()=>{
    expect(thisWeekAction('policy','below','signal')).toMatch(/Don’t call it progress/);
    expect(thisWeekAction('journalist','lowest','signal')).toMatch(/Don’t report “fewer fires”/);
    expect(thisWeekAction('journalist','below','within')).toMatch(/less burning was detected/);
  });
});
