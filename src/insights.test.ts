import {describe,it,expect} from 'vitest';
import {readFileSync} from 'node:fs';
import {gunzipSync} from 'node:zlib';
import {areaInsight,receiptFacts,ROLES} from './insights';
import {claimSVG,punjabCard} from './claimCard';
import type {AreaResult,Manifest,ClockYear,Month} from './types';
const fixture=JSON.parse(readFileSync(new URL('../scripts/numeric_expected.json',import.meta.url),'utf8'));
const receipt=JSON.parse(gunzipSync(readFileSync(new URL('../public/data/punjab_receipt.json.gz',import.meta.url))).toString());
const manifest=JSON.parse(gunzipSync(readFileSync(new URL('../public/data/manifest.json.gz',import.meta.url))).toString()) as Manifest;
const area=fixture.presets.punjab as AreaResult,month=area.months.at(-2)!,clock=area.clock.at(-1)!;
const run=(overrides:Record<string,unknown>={})=>areaInsight({area,month,clock,manifest,role:'air',...overrides});
describe('deterministic decision guidance',()=>{
 it('never turns failed loads, loading, empty cells or missing months into a trend',()=>{expect(run({error:'503'}).rule).toBe('LOAD_ERROR');expect(run({area:null}).rule).toBe('LOADING');expect(run({area:{...area,cellCount:0}}).rule).toBe('EMPTY');expect(run({month:{...month,harm:null}}).rule).toBe('MISSING');});
 it('distinguishes non-evaluation, weak support and within-threshold evidence',()=>{expect(run({clock:{...clock,badge:'not_evaluated'}}).rule).toBe('PRE_DIAGNOSTIC');expect(run({clock:{...clock,badge:'not_identifiable'}}).rule).toBe('LOW_SUPPORT');expect(run().rule).toBe('WITHIN_THRESHOLD');});
 it('does not convert an Aqua diagnostic into a true decline estimate',()=>{const r=run({clock:{...clock,badge:'clock_sensitive',drivers:['A']}});expect(r.rule).toBe('CLOCK_SENSITIVE');expect(r.meaning).toContain('Aqua');expect(r.meaning).toContain('cannot tell how much burning changed');expect(r.action).not.toContain('overstate');});
 it('offers all four roles a concrete distinct action with unchanged evidence',()=>{const results=Object.keys(ROLES).map(role=>run({role}));expect(new Set(results.map(r=>r.action)).size).toBe(4);expect(new Set(results.map(r=>r.meaning)).size).toBe(1);});
 it('keeps a raw outage compatible with a valid harmonized estimate',()=>{const m={...month,month:'2024-11',raw:{...month.raw,N:null}} as Month;const mf={...manifest,outage_months:[{platform:'N',month:'2024-11',missing_days:['2024-11-03'],masked:true}]} as Manifest;const r=run({month:m,manifest:mf});expect(r.rule).not.toBe('MISSING');expect(r.notes.join()).toContain('S-NPP (1 missing days)');});
 it('flags modelling in converted months and early archive limits',()=>{const r=run({month:area.months[0],clock:{...clock,badge:'not_evaluated'} as ClockYear});expect(r.notes.join()).toContain('MODIS conversion');expect(r.notes.join()).toContain('Early archive');});
});
describe('Punjab evidence and self-contained claim card',()=>{
 it('calculates the official count change, not a replacement all-day decline',()=>{expect(receiptFacts(receipt).officialDecline).toBeCloseTo(92.827891843,8);});
 it('includes the16:00 observation in late-hour shares and uses pixel-hours',()=>{const f=receiptFacts(receipt);expect(f.late2025).toBeCloseTo(18654/19392*100,10);expect(f.late2021).toBeCloseTo(20435/39361*100,10);expect(f.at17).toBeCloseTo(11858/8461,10);});
 it('keeps the unmasked whole-afternoon measure separate from the matched fan',()=>{const f=receiptFacts(receipt);expect(f.afternoonDecline).toBeCloseTo((1-16096/24447)*100,10);expect(f.versus2019).toBeCloseTo(16096/7527,10);expect(f.peakYear).toBe('2021');expect(1-f.afternoonDecline/100).not.toBe(receipt.base_year_fan[1].gk2a);});
 it('binds unit, period and mask to each numerical claim',()=>{const c=punjabCard(receipt,'https://example.test/#receipt');expect(c.lines[0]).toContain('Mixed MODIS + VIIRS');expect(c.lines[1]).toContain('unique pixel-days');expect(c.lines[1]).toContain('unmasked');expect(c.lines[2]).toContain('2019');expect(c.lines[3]).toContain('17:00 IST');expect(c.lines[3]).toContain('pixel-hours');expect(c.lines[4]).toContain('Denominator: 12–18 IST');expect(c.lines[5]).toContain('cannot yield a corrected true fire count');});
 it('escapes XML and preserves context in the exported image text',()=>{const svg=claimSVG({...punjabCard(receipt,'https://example.test/?a=1&b=2'),title:'<a> & "b"'});expect(svg).toContain('&lt;a&gt; &amp; &quot;b&quot;');expect(svg).toContain('2021 is the peak');expect(svg).toContain('confidence ≥2');expect(svg).not.toContain('<a>');});
});
