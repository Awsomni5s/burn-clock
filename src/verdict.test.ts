import {describe,expect,it} from 'vitest';
import {verdictFor,verdictSentence} from './verdict';
import type {TimingChecks} from './timing';
import type {ClaimResult} from './stats';
const checks=(late:TimingChecks['late'],relationship:TimingChecks['relationship']):TimingChecks=>({year:2025,months:[10,11],late,relationship,tests:[],drivers:[]});
const claim=(changePct:number,lo:number,hi:number)=>({a:2021,b:2025,months:[10,11],harmonized:{status:'ok',changePct,rangePct:[lo,hi]}} as unknown as ClaimResult);
describe('verdict',()=>{
  it('puts a later-burning signal first',()=>{expect(verdictFor(checks('signal','signal'))).toBe('timing');expect(verdictFor(checks('signal','unknown'))).toBe('timing');});
  it('flags a MODIS relationship change without a later-burning signal',()=>{expect(verdictFor(checks('within','signal'))).toBe('modis');expect(verdictFor(checks('unknown','signal'))).toBe('modis');});
  it('only says timing is not the issue when both checks could be made',()=>{expect(verdictFor(checks('within','within'))).toBe('clear');expect(verdictFor(checks('within','unknown'))).toBe('unknown');expect(verdictFor(checks('unknown','unknown'))).toBe('unknown');});
  it('writes a fall with timing as a partial timing effect',()=>{expect(verdictSentence('timing',claim(-80.4,-88,-69.3),'Oct–Nov')).toBe('Fire activity here fell about 80% (2021–2025, Oct–Nov), but part of that drop is burning that moved to hours the satellites don’t see.');});
  it('never calls a change clear when the range includes no change',()=>{const s=verdictSentence('clear',claim(12,-75,507),'Jul–Sep');expect(s).toContain('No clear change');expect(s).toContain('−75%');});
  it('says when there is not enough data',()=>{expect(verdictSentence('unknown',{a:2019,b:2025,months:[7],harmonized:{status:'missing',changePct:null,rangePct:null}} as unknown as ClaimResult,'Jul')).toContain('isn’t enough complete data');});
});
