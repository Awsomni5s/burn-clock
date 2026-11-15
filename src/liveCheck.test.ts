import {describe,expect,it} from 'vitest';
import {readFileSync} from 'node:fs';
import {gunzipSync} from 'node:zlib';
import {areaTiles,createAccumulator} from './data';
import {PRESETS,type BBox,type Manifest} from './types';
import {liveSums,liveTiming,type LiveCells} from './liveCheck';
const gz=(p:string)=>JSON.parse(gunzipSync(readFileSync(p)).toString());
const manifest=gz('public/data/manifest.json.gz') as Manifest,live=gz('public/data/live/week_cells.json.gz') as LiveCells;
const monthsFor=(box:BBox)=>{const acc=createAccumulator(manifest);for(const n of areaTiles(manifest.tiles,box))acc.add(gz(`public/data/tiles/${n}.json.gz`),box);return acc.finish().months;};
describe('live timing check',()=>{
  it('sums only bins whose centres fall in the box',()=>{
    const s=liveSums({...live,rows:[[30,75,1,2,3,4],[10,10,9,9,9,9]]},[29,74,31,76]);expect(s).toEqual({T:1,A:2,J1:3,J2:4});
  });
  it('gives an answer or a reason for every preset',()=>{
    const out:string[]=[];
    for(const p of PRESETS){const r=liveTiming(live,p.box as BBox,monthsFor(p.box as BBox));out.push(`${p.id} ${r.status} A=${r.aqua} J1=${r.noaa20} ratio=${r.ratio?.toFixed(3)} base=${r.baseline?.toFixed(3)} [${r.low?.toFixed(3)},${r.high?.toFixed(3)}] bridge=${r.bridge.toFixed(3)} ${r.reason}`);
      expect(['signal','within','below','unknown']).toContain(r.status);if(r.status==='unknown')expect(r.reason).not.toBe('');else expect(r.ratio).toBeGreaterThan(0);}
    console.log(out.join('\n'));
  },60000);
});
