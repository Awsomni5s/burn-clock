import {describe,it,expect} from 'vitest';
import {timingChecks} from './timing';
import reference from '../scripts/numeric_expected.json';
import expected from '../scripts/timing_expected.json';
import type {Month} from './types';
describe('selected-month timing against independently aggregated Python references',()=>{
 for(const [name,cases] of Object.entries(expected.presets))it(name+': every exported month, default season and claim case',()=>{
  const rows=(reference.presets as any)[name].months as Month[];
  for(const wanted of Object.values(cases)){
   const got=timingChecks(rows,wanted.months,wanted.year);
   expect(got.late).toBe(wanted.late);expect(got.relationship).toBe(wanted.relationship);expect(got.drivers).toEqual(wanted.drivers);
   for(let i=0;i<2;i++){for(const key of ['count','reference','delta','sigma','threshold'] as const){const a=got.tests[i][key],b=wanted.tests[i][key];if(b==null)expect(a).toBeNull();else expect(a).toBeCloseTo(b,10);}expect(got.tests[i].testable).toBe(wanted.tests[i].testable);expect(got.tests[i].baselineYears).toEqual(wanted.tests[i].baselineYears);}
  }
 });
 it('catches Punjab October–November 2025 despite the old fixed-season OK badge',()=>{
  const result=timingChecks(reference.presets.punjab.months as Month[],[10,11],2025);
  expect(result.late).toBe('signal');expect(result.relationship).toBe('signal');expect(result.drivers).toEqual(['A']);expect(result.tests[1].delta).toBeCloseTo(.399582,5);expect(result.tests[0].count).toBe(26);expect(result.tests[0].testable).toBe(false);
 });
 it('keeps Africa’s missing 2016 Terra baseline inconclusive',()=>{const result=timingChecks(reference.presets.africa.months as Month[],[1,2],2025);expect(result.tests[0].baselineYears).not.toContain(2016);expect(result.relationship).toBe('unknown');expect(result.late).toBe('within');});
 it('rejects invalid selections and never substitutes zero for missing data',()=>{for(const months of [[],[0],[13],[NaN]])expect(timingChecks(reference.presets.punjab.months as Month[],months,2025).late).toBe('unknown');const rows=structuredClone(reference.presets.punjab.months) as Month[];rows.find(r=>r.month==='2025-11')!.raw.A=null;expect(timingChecks(rows,[10,11],2025).tests[1].count).toBeNull();});
 it('does not call negative Aqua divergence a later-burning signal',()=>{const rows=structuredClone(reference.presets.punjab.months) as Month[];for(const r of rows.filter(r=>r.month.startsWith('2025')))if(r.raw.A!=null)r.raw.A=Math.round(r.raw.A/5);const result=timingChecks(rows,[10,11],2025);expect(result.tests[1].testable).toBe(true);expect(result.tests[1].delta).toBeLessThan(-.15);expect(result.late).toBe('within');expect(result.relationship).toBe('signal');});
});
