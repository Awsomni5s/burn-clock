import {describe,expect,it} from 'vitest';
import {claimInsights} from './insights';
import type {ClaimResult} from './stats';
import type {TimingChecks} from './timing';
const checks=(v:Partial<TimingChecks>={}):TimingChecks=>({year:2025,months:[10,11],late:'within',relationship:'within',drivers:[],tests:[],...v});
const claim=(override:Partial<ClaimResult>={}):ClaimResult=>({months:[10,11],a:2021,b:2025,platforms:[],harmonized:{status:'ok',sumA:100,sumB:50,loA:90,hiA:110,loB:40,hiB:60,ratio:.5,range:[.4,.6],changePct:-50,rangePct:[-60,-40]},checks:checks(),timing:null,timingStatus:'available',convertedShare:0,convertedMonths:0,selectedMonthCount:4,outages:[],warnings:[],...override});
const ids=(c:ClaimResult,failed=false)=>claimInsights(c,failed).map(r=>r.id);
describe('selected-month decision rules',()=>{
 it('requires the positive Aqua signal to infer possible later burning',()=>{
  expect(ids(claim({checks:checks({late:'signal',relationship:'signal',drivers:['A']})}))).toEqual(['aqua_later']);
  for(const late of ['unknown','within'] as const)expect(ids(claim({checks:checks({late,relationship:'signal',drivers:['A']})}))).not.toContain('aqua_later');
 });
 it('names Terra only when its selected-month test flags a change',()=>{
  expect(ids(claim({checks:checks({relationship:'signal',drivers:['T']})}))).toEqual(['terra_drift']);
  expect(ids(claim())).toEqual(['timing_ok']);
 });
 it('qualifies a within-threshold result',()=>expect(claimInsights(claim(),false)[0].meaning).toContain('does not certify the trend'));
 it('keeps incomplete support and earlier years inconclusive',()=>{
  expect(ids(claim({checks:checks({relationship:'unknown'})}))).toEqual(['not_enough']);
  expect(claimInsights(claim({b:2020,checks:checks({relationship:'unknown'})}),false)[0].meaning).toBe('The timing checks start in 2021.');
 });
 it('includes no change at either interval endpoint',()=>{for(const range of [[.9,1],[1,1.1],[1,1],[.9,1.1]] as [number,number][]){const c=claim();c.harmonized.range=range;expect(ids(c)).toContain('within_range');}});
 it('requires >30% converted months and a documented transfer failure',()=>{expect(ids(claim({convertedShare:.3}),true)).not.toContain('converted_transfer');expect(ids(claim({convertedShare:.3001}),true)).toContain('converted_transfer');expect(ids(claim({convertedShare:1}),false)).not.toContain('converted_transfer');});
 it('distinguishes partial interruptions from missing monthly values',()=>{const c=claim({outages:[{platform:'N',month:'2024-11',missing_days:['2024-11-03'],masked:false}]});expect(claimInsights(c,false).find(r=>r.id==='outage')?.action).toContain('partial outages do not necessarily remove the entire monthly estimate');});
 it('retains rule priority and a three-rule limit',()=>{const c=claim({checks:checks({late:'signal',relationship:'signal',drivers:['T','A']}),convertedShare:.9,outages:[{platform:'N',month:'2024-11',missing_days:['2024-11-03'],masked:false}]});c.harmonized.range=[.9,1.1];expect(ids(c,true)).toEqual(['aqua_later','terra_drift','within_range']);});
});
