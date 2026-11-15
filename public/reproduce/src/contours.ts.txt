import type {StyleSpecification} from 'maplibre-gl';
import type {CalendarTile,Manifest} from './types';

export interface ContourSeries {years:number[];levels:number[];unit:string;label:string;method:string;coverage?:string;hours_ist?:number[];source?:string;note?:string}
export interface ContourMeta {palette:string[];world:ContourSeries;punjab_gk2a:ContourSeries;punjab_viirs:ContourSeries;generated_by:string}
export const EMPTY_CONTOURS={type:'FeatureCollection' as const,features:[]};
export function contourBands(series:ContourSeries,palette:string[]){return series.levels.map((lo,i)=>({lo,hi:series.levels[i+1]??null,color:palette[i],label:series.levels[i+1]==null?`${lo}+`:`${lo}–<${series.levels[i+1]}`}));}
export function calendarPoint(lat:number,lon:number){
  const normalized=((lon+180)%360+360)%360-180;
  const swLat=Math.floor(Math.max(-90,Math.min(89.999999,lat))*4)/4,swLon=Math.floor(normalized*4)/4;
  const tileLat=Math.floor(swLat/5)*5,tileLon=Math.floor(swLon/5)*5;
  const part=(n:number,size:number)=>(n<0?'m':'p')+String(Math.abs(n)).padStart(size,'0');
  return {lat:swLat,lon:swLon,tile:`${part(tileLat,2)}_${part(tileLon,3)}`};
}
export interface AnnualPoint {value:number|null;status:'complete'|'missing'|'absent';months:number;source:string}
// This is the metadata's annual sum of original harmonized monthly cell values.
// A missing cell or any missing month stays unknown, never zero.
export function annualPoint(tile:CalendarTile,manifest:Pick<Manifest,'months'>,lat:number,lon:number,year:number):AnnualPoint {
  const ci=tile.cells.findIndex(c=>c[0]===lat&&c[1]===lon);
  if(ci<0)return {value:null,status:'absent',months:0,source:'No stored cell: no activity or no data'};
  const indexes=manifest.months.map((m,i)=>m.startsWith(`${year}-`)?i:-1).filter(i=>i>=0);
  const values=indexes.map(i=>tile.harm[ci]?.[i]);
  const months=values.filter(v=>typeof v==='number'&&Number.isFinite(v)).length;
  const source=[...new Set(indexes.map(i=>tile.src[ci]?.[i]??'X'))].map(s=>s==='V'?'VIIRS observed':s==='M'?'MODIS converted':'missing').join(' + ');
  if(indexes.length!==12||months!==12)return {value:null,status:'missing',months,source};
  return {value:values.reduce<number>((sum,v)=>sum+Math.round(v!*100),0)/100,status:'complete',months,source};
}
export function receiptHourRatio(data:{gk2a_by_hour?:{hours:number[];ratio_2025_2021:(number|null)[]}},base:number,hour:number):number|null {
  if(base!==2021||!data.gk2a_by_hour)return null;
  const i=data.gk2a_by_hour.hours.indexOf(hour),value=data.gk2a_by_hour.ratio_2025_2021[i];
  return i>=0&&typeof value==='number'&&Number.isFinite(value)?value:null;
}
export function lightContourStyle():StyleSpecification {return {version:8,glyphs:'/maps/fonts/{fontstack}/{range}.pbf',sources:{
  land:{type:'geojson',data:'/maps/countries.geojson',attribution:'Natural Earth · public domain'},
  provinces:{type:'geojson',data:'/maps/provinces.geojson'},countrylabels:{type:'geojson',data:'/maps/labels.geojson'},places:{type:'geojson',data:'/maps/places.geojson'}
},layers:[
  {id:'background',type:'background',paint:{'background-color':'#eef2f3'}},
  {id:'land',type:'fill',source:'land',paint:{'fill-color':'#fafaf7'}},
  {id:'provinces',type:'line',source:'provinces',minzoom:3,paint:{'line-color':'#9ca4a1','line-width':.65,'line-opacity':.7}},
  {id:'borders',type:'line',source:'land',paint:{'line-color':'#7c8984','line-width':.85}},
  {id:'country-labels',type:'symbol',source:'countrylabels',maxzoom:5,layout:{'text-field':['get','name'],'text-font':['Open Sans Semibold'],'text-size':11,'text-max-width':10},paint:{'text-color':'#37453f','text-halo-color':'#ffffff','text-halo-width':1.5}},
  {id:'city-points',type:'circle',source:'places',minzoom:4,filter:['>=',['get','pop'],300000],paint:{'circle-radius':1.7,'circle-color':'#51605a'}},
  {id:'city-labels',type:'symbol',source:'places',minzoom:4,filter:['>=',['get','pop'],300000],layout:{'text-field':['get','name'],'text-font':['Open Sans Semibold'],'text-size':11,'text-offset':[0,1.1],'text-anchor':'top'},paint:{'text-color':'#37453f','text-halo-color':'#ffffff','text-halo-width':1.5}}
]};}
