export const PLATFORMS = ['T','A','N','J1','J2'] as const;
export type Platform = typeof PLATFORMS[number];
export type Nullable = number | null;
export type BBox = [number,number,number,number]; // south, west, north, east; west > east crosses date line
export const PLATFORM_NAMES:Record<Platform,string> = {T:'Terra',A:'Aqua',N:'S-NPP',J1:'NOAA-20',J2:'NOAA-21'};
export const PLATFORM_COLORS:Record<Platform,string> = {T:'#d76b35',A:'#8266ad',N:'#329081',J1:'#4b83ba',J2:'#8b939d'};
export interface Manifest {
  generated_utc:string; months:string[]; platforms:Partial<Record<Platform,{first:string;last:string}>>;
  totals:{detections_processed:number;by_platform:Record<Platform,number>;type0_detections:number;active_cell_days:number;archives:number;[key:string]:unknown};
  tiles:string[];sources:{name:string;url:string;sha256:string;bytes:number;rows:number}[];
  outage_months:{platform:Platform;month:string;missing_days:string[];masked:boolean}[];
}
export interface CalendarTile {tile:string;cells:[number,number][];raw:Record<Platform,Nullable[][]>;harm:Nullable[][];harm_lo:Nullable[][];harm_hi:Nullable[][];src:string[]}
export interface ClockTile {tile:string;cells:[number,number][];years:number[];season_months:number[][];look:Record<Platform,Nullable[][]>;day:Record<Platform,Nullable[][]>;night:Record<Platform,Nullable[][]>}
export interface Month {month:string;raw:Record<Platform,Nullable>;harm:Nullable;lo:Nullable;hi:Nullable;src:string;satellites:Platform[];anomaly:'above'|'normal'|'below'|'missing';median:Nullable;p25:Nullable;p75:Nullable}
export interface ClockTest {platform:'T'|'A';testable:boolean;delta:Nullable;sigma:Nullable;threshold:Nullable;count:Nullable;reference:Nullable;cells:number;reason:string}
export interface ClockYear {year:number;badge:'robust'|'clock_sensitive'|'not_identifiable'|'not_evaluated';drivers:string[];bend:Nullable;tests:ClockTest[];look:Record<Platform,Nullable>;baselineLook:Record<Platform,Nullable>;clockCells:number}
export interface AreaResult {box:BBox;cellCount:number;tileCount:number;months:Month[];clock:ClockYear[]}
export interface Catalog {clock_tiles:string[];calendar_tiles:number;uncompressed_json_bytes:number;compressed_json_bytes:number;map_note:string}
export const PRESETS:{id:string;name:string;country:string;box:BBox}[] = [
  {id:'punjab',name:'Punjab + Haryana',country:'India',box:[27.6,73.8,32.6,77.6]},
  {id:'parana',name:'Paraná Delta',country:'Argentina',box:[-34.5,-60.8,-32,-58.3]},
  {id:'cerrado',name:'Cerrado / MATOPIBA',country:'Brazil',box:[-13,-50,-5,-42]},
  {id:'africa',name:'Central African savanna',country:'Central Africa',box:[5,18,10,30]},
  {id:'kalimantan',name:'Kalimantan',country:'Indonesia',box:[-3.5,110,1,117]},
  {id:'california',name:'California',country:'United States',box:[34,-124,42,-117]}
];
