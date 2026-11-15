import {readFileSync} from 'node:fs';
import {gunzipSync} from 'node:zlib';
import {describe,it,expect} from 'vitest';
import {areaTiles,createAccumulator,computeClock} from './data';
import type {BBox,CalendarTile,ClockTile,Manifest,Catalog} from './types';

const root=new URL('../',import.meta.url);
const read=<T,>(path:string):T=>JSON.parse(gunzipSync(readFileSync(new URL('public/data/'+path+'.json.gz',root))).toString());
const fixture=JSON.parse(readFileSync(new URL('scripts/numeric_expected.json',root),'utf8'));
const manifest=read<Manifest>('manifest');
const catalog=JSON.parse(readFileSync(new URL('public/data/catalog.json',root),'utf8')) as Catalog;
let leaves=0;
function equalReference(actual:any,expected:any,path:string){
  if(typeof expected==='number'){
    expect(typeof actual,`${path}: number required`).toBe('number');
    const tolerance=Math.max(1e-8,Math.abs(expected)*1e-10);
    expect(Math.abs(actual-expected),`${path}: received ${actual}; independent reference ${expected}; tolerance ${tolerance}`).toBeLessThanOrEqual(tolerance);
    leaves++;
  }else if(expected===null||typeof expected!=='object'){
    expect(actual,path).toEqual(expected);leaves++;
  }else if(Array.isArray(expected)){
    expect(actual?.length,`${path}.length`).toEqual(expected.length);leaves++;
    expected.forEach((value,i)=>equalReference(actual[i],value,`${path}[${i}]`));
  }else{
    for(const [key,value] of Object.entries(expected))equalReference(actual?.[key],value,`${path}.${key}`);
  }
}

describe('independent Python reference: all preset months and clock years',()=>{
  for(const [id,reference] of Object.entries(fixture.presets) as [string,any][]){
    it(`${id}: 302 monthly aggregates and 13 annual clock diagnostics`,()=>{
      const box=reference.box as BBox;
      const calendarNames=areaTiles(manifest.tiles,box);
      const acc=createAccumulator(manifest);
      for(const name of calendarNames)acc.add(read<CalendarTile>('tiles/'+name),box);
      const clock=computeClock(areaTiles(catalog.clock_tiles,box).map(name=>read<ClockTile>('clock/'+name)),box);
      equalReference({box,...acc.finish(),clock,tileCount:calendarNames.length},reference,id);
    });
  }
  it('records finite coverage of the independent reference',()=>{
    expect(leaves).toBeGreaterThan(30000);
    console.info(`Independent reference leaf comparisons: ${leaves} (all six presets; 1,812 months; 78 clock states).`);
  });
});
