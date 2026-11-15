import {describe,it,expect} from 'vitest';
import {readFileSync} from 'node:fs';
import {gunzipSync} from 'node:zlib';
import {annualPoint,calendarPoint,contourBands,receiptHourRatio,type ContourMeta} from './contours';
import type {CalendarTile} from './types';
const meta=JSON.parse(readFileSync(new URL('../public/data/contours/contours_meta.json',import.meta.url),'utf8')) as ContourMeta;
const months=Array.from({length:12},(_,i)=>`2025-${String(i+1).padStart(2,'0')}`);
const tile={cells:[[30,75]],harm:[Array(12).fill(.29)],src:['VVVVVVVVVVVV']} as unknown as CalendarTile;
describe('contour data contract',()=>{
  it('uses original fixed metadata palette and open-ended bands without recolouring',()=>{for(const series of [meta.world,meta.punjab_gk2a,meta.punjab_viirs]){const bands=contourBands(series,meta.palette);expect(bands).toHaveLength(8);expect(bands.map(b=>b.color)).toEqual(meta.palette);expect(bands.at(-1)?.hi).toBeNull();expect(bands.map(b=>b.lo)).toEqual(series.levels);}});
  it('matches cell and tile indexing at negative coordinates and the date line',()=>{expect(calendarPoint(30.24,75.24)).toEqual({lat:30,lon:75,tile:'p30_p075'});expect(calendarPoint(-.01,-.01)).toEqual({lat:-.25,lon:-.25,tile:'m05_m005'});expect(calendarPoint(0,180)).toEqual({lat:0,lon:-180,tile:'p00_m180'});expect(calendarPoint(90,0).lat).toBe(89.75);});
  it('sums original monthly values exactly and keeps true zero distinct from missing',()=>{expect(annualPoint(tile,{months},30,75,2025)).toEqual({value:3.48,status:'complete',months:12,source:'VIIRS observed'});expect(annualPoint({...tile,harm:[Array(12).fill(0)]},{months},30,75,2025).value).toBe(0);expect(annualPoint({...tile,harm:[[null,...Array(11).fill(0)]]},{months},30,75,2025)).toMatchObject({value:null,status:'missing',months:11});expect(annualPoint(tile,{months},31,75,2025)).toMatchObject({value:null,status:'absent'});expect(annualPoint(tile,{months:months.slice(1)},30,75,2025).value).toBeNull();});
  it('reads the hourly receipt ratio and refuses to invent other base-year ratios',()=>{const receipt=JSON.parse(gunzipSync(readFileSync(new URL('../public/data/punjab_receipt.json.gz',import.meta.url))).toString());expect(receiptHourRatio(receipt,2021,17)).toBe(receipt.gk2a_by_hour.ratio_2025_2021[receipt.gk2a_by_hour.hours.indexOf(17)]);expect(receiptHourRatio(receipt,2019,17)).toBeNull();expect(receiptHourRatio(receipt,2023,17)).toBeNull();expect(receiptHourRatio(receipt,2021,11)).toBeNull();});
  it('serves every declared year and hour with feature colours and levels unchanged',()=>{
    const files=[...meta.world.years.map(y=>[`world_${y}`,meta.world] as const),...meta.punjab_viirs.years.map(y=>[`punjab_viirs_${y}`,meta.punjab_viirs] as const),...meta.punjab_gk2a.years.flatMap(y=>meta.punjab_gk2a.hours_ist!.map(h=>[`punjab_gk2a_${y}_${h}`,meta.punjab_gk2a] as const))];
    expect(files).toHaveLength(88);
    for(const [file,series] of files){const data=JSON.parse(gunzipSync(readFileSync(new URL(`../public/data/contours/${file}.geojson.gz`,import.meta.url))).toString());expect(data.type).toBe('FeatureCollection');for(const feature of data.features){const p=feature.properties;expect(p.color).toBe(meta.palette[p.band]);expect(p.lo).toBe(series.levels[p.band]);expect(p.hi).toBe(series.levels[p.band+1]??null);}}
  });
});
