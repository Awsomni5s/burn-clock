import {describe,expect,it} from 'vitest';
import {claimInsights} from './insights';
import type {ClaimResult} from './stats';
import type {ClockYear} from './types';

const clock=(override:Partial<ClockYear>={}):ClockYear=>({year:2025,badge:'robust',drivers:[],bend:0,tests:[],look:{T:null,A:null,N:null,J1:null,J2:null},baselineLook:{T:null,A:null,N:null,J1:null,J2:null},clockCells:1,...override});
const claim=(override:Partial<ClaimResult>={}):ClaimResult=>({months:[10,11],a:2021,b:2025,platforms:[],harmonized:{status:'ok',sumA:100,sumB:50,loA:90,hiA:110,loB:40,hiB:60,ratio:.5,range:[.4,.6],changePct:-50,rangePct:[-60,-40]},timing:clock(),timingStatus:'available',convertedShare:0,convertedMonths:0,selectedMonthCount:4,outages:[],warnings:[],...override});
const ids=(c:ClaimResult,failed=false)=>claimInsights(c,failed).map(r=>r.id);
const deltaTest=(delta:number)=>({platform:'A' as const,testable:true,delta,sigma:.1,threshold:.2,count:300,reference:400,cells:10,reason:'Enough observations'});

describe('addendum fixed insight rules',()=>{
  it('requires a clock-sensitive Aqua driver and a positive ratio departure',()=>{
    expect(ids(claim({timing:clock({badge:'clock_sensitive',drivers:['A'],tests:[deltaTest(.3)]})}))).toEqual(['aqua_later']);
    for(const delta of [0,-.3])expect(ids(claim({timing:clock({badge:'clock_sensitive',drivers:['A'],tests:[deltaTest(delta)]})}))).not.toContain('aqua_later');
    expect(ids(claim({timing:clock({badge:'robust',drivers:['A'],tests:[deltaTest(.3)]})}))).not.toContain('aqua_later');
    expect(ids(claim({timing:clock({badge:'clock_sensitive',drivers:['T'],tests:[deltaTest(.3)]})}))).not.toContain('aqua_later');
  });
  it('names Terra only when Terra drives a clock-sensitive badge',()=>{
    expect(ids(claim({timing:clock({badge:'clock_sensitive',drivers:['T']})}))).toEqual(['terra_drift']);
    expect(ids(claim({timing:clock({badge:'robust',drivers:['T']})}))).toEqual(['timing_ok']);
  });
  it('qualifies an OK timing result instead of certifying a real trend',()=>{
    const rules=claimInsights(claim(),false);expect(rules.map(r=>r.id)).toEqual(['timing_ok']);
    expect(rules[0].meaning).toContain('does not certify the trend as real');
  });
  it('handles both low support and an earlier-than-diagnostic comparison',()=>{
    expect(ids(claim({timing:clock({badge:'not_identifiable'})}))).toEqual(['not_enough']);
    expect(claimInsights(claim({timing:null,b:2020,timingStatus:'before_2021'}),false)[0].meaning).toBe('The timing check starts in 2021.');
    expect(ids(claim({timing:null}))).toEqual(['not_enough']);
  });
  it('treats one as no change, inclusive at either range endpoint',()=>{
    for(const range of [[.9,1],[1,1.1],[1,1],[.9,1.1]] as [number,number][]){const c=claim();c.harmonized.range=range;expect(ids(c)).toContain('within_range');}
    for(const range of [[.8,.99],[1.01,1.2],null] as ([number,number]|null)[]){const c=claim();c.harmonized.range=range;expect(ids(c)).not.toContain('within_range');}
  });
  it('requires strictly more than 30% converted months and a documented transfer failure',()=>{
    expect(ids(claim({convertedShare:.3}),true)).not.toContain('converted_transfer');
    expect(ids(claim({convertedShare:.3001}),true)).toContain('converted_transfer');
    expect(ids(claim({convertedShare:1}),false)).not.toContain('converted_transfer');
  });
  it('retains the difference between partial outages and missing monthly estimates',()=>{
    const c=claim({outages:[{platform:'N',month:'2024-11',missing_days:['2024-11-03'],masked:false}]});
    const rule=claimInsights(c,false).find(r=>r.id==='outage');expect(rule).toBeDefined();
    expect(rule?.action).toContain('partial outages do not necessarily remove the entire monthly estimate');
    expect(ids(claim())).not.toContain('outage');
  });
  it('returns at most three in the stated order without promoting later warnings',()=>{
    const c=claim({timing:clock({badge:'clock_sensitive',drivers:['T','A'],tests:[deltaTest(.3)]}),convertedShare:.9,outages:[{platform:'N',month:'2024-11',missing_days:['2024-11-03'],masked:false}]});
    c.harmonized.range=[.9,1.1];
    expect(ids(c,true)).toEqual(['aqua_later','terra_drift','within_range']);
    const fallback=claim({timing:null,convertedShare:.9,outages:c.outages});fallback.harmonized.range=null;
    expect(ids(fallback,true)).toEqual(['not_enough','converted_transfer','outage']);
  });
});
