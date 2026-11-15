import {describe,it,expect} from 'vitest';
import {civilHour,areaZone,zoneOffset,midpoint} from './civilTime';
import {nasaURLs} from './components/Sharing';
import {numeric,monthValue,choice} from './urlState';
import {PRESETS} from './types';
describe('civil clocks and durable state',()=>{
 it('uses Indian civil time with the longitude correction',()=>{expect(areaZone(PRESETS[0].box)).toMatch(/^Asia\/(Kolkata|Calcutta)$/);expect(civilHour(13.5,PRESETS[0].box,'2025-11-15')).toBeCloseTo(13.5-75.7/15+5.5,8);});
 it('resolves Pacific summer and winter separately',()=>{expect(zoneOffset('America/Los_Angeles','2025-08-15')).toBe(-7);expect(zoneOffset('America/Los_Angeles','2025-11-15')).toBe(-8);});
 it('preserves missing observations and wraps midnight',()=>{expect(civilHour(null,PRESETS[0].box,'2025-11-15')).toBeNull();expect(civilHour(.1,[34,-124,42,-117],'2025-08-15')).toBeGreaterThanOrEqual(0);});
 it('takes the short midpoint across the date line',()=>{expect(midpoint([-10,170,10,-170])[1]).toBe(-180);});
 it('rejects invalid state values instead of crashing',()=>{expect(numeric(12,18)('19')).toBeNull();expect(numeric(0,3,.1)('1.7')).toBe(1.7);expect(monthValue('2025-13')).toBeNull();expect(choice(['harm','raw'])('bogus')).toBeNull();});
});
describe('NASA URLs',()=>{
 it('converts the application bbox and enables all four thermal layers',()=>{const urls=nasaURLs(PRESETS[0].box,'2025-11-15'),u=new URL(urls.worldview);expect(u.searchParams.get('v')).toBe('73.8,27.6,77.6,32.6');expect(u.searchParams.get('t')).toBe('2025-11-15-T00:00:00Z');for(const s of ['MODIS_Terra','MODIS_Aqua','VIIRS_SNPP','VIIRS_NOAA20'])expect(u.searchParams.get('l')).toContain(s);expect(urls.firms).toContain('#m:advanced;d:2025-11-15;i:73.8,27.6,77.6,32.6;');expect(urls.firms).toContain('fires_viirs_noaa20');});
});
