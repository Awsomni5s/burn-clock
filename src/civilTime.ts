import tzlookup from '@photostructure/tz-lookup';
import type {BBox} from './types';
export function midpoint(box:BBox):[number,number]{return [(box[0]+box[2])/2,box[1]<=box[3]?(box[1]+box[3])/2:((box[1]+box[3]+360)/2+180)%360-180];}
export function areaZone(box:BBox){const [lat,lon]=midpoint(box);return tzlookup(lat,lon);}
export function zoneOffset(zone:string,date:string){const instant=new Date(date+'T12:00:00Z');const parts=new Intl.DateTimeFormat('en-GB',{timeZone:zone,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23'}).formatToParts(instant);const v=Object.fromEntries(parts.map(p=>[p.type,p.value]));return (Date.UTC(+v.year,+v.month-1,+v.day,+v.hour,+v.minute,+v.second)-instant.getTime())/3600000;}
export function civilHour(solar:number|null,box:BBox,date:string,zone=areaZone(box)){if(solar===null)return null;return ((solar-midpoint(box)[1]/15+zoneOffset(zone,date))%24+24)%24;}
export const zoneLabel=(zone:string)=>zone==='Asia/Calcutta'||zone==='Asia/Kolkata'?'India time':zone.replaceAll('_',' ');
export const civilNote='Approximate civil time from annual detection-conditioned medians, using the area midpoint and time-zone rules on the reference date. A large box can span time zones; a median is not an exact daily pass.';
