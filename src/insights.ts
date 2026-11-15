import type {AreaResult,ClockYear,Manifest,Month} from './types';
import {PLATFORM_NAMES} from './types';
export const ROLES={air:'Air quality / emissions',policy:'Policy / enforcement',journalist:'Journalism / fact-checking',research:'Fire research'} as const;
export type Role=keyof typeof ROLES;
export const ROLE_ACTIONS:Record<Role,string>={
 air:'Check the daily timing of your emissions inputs. A change in satellite counts is not an emissions correction or a prediction of smoke exposure.',
 policy:'Report the sensor, observation window and baseline alongside the trend. Review monitoring coverage before using this result to change enforcement or declare success.',
 journalist:'Publish the observation and its limits together. Use the claim card and compare the satellite-specific record before writing a headline.',
 research:'Export the monthly CSV with source codes and approximate bounds. Check overlap years, missingness and regional validation before fitting a trend.'
};
export interface Insight {rule:string;title:string;meaning:string;action:string;notes:string[]}
export function areaInsight({area,month,clock,manifest,role,error}:{area:AreaResult|null;month?:Month;clock?:ClockYear;manifest:Manifest;role:Role;error?:string}):Insight {
 const action=ROLE_ACTIONS[role];
 if(error)return {rule:'LOAD_ERROR',title:'This area could not be evaluated',meaning:'Some source data did not load. No activity or trend can be inferred from this screen.',action:'Retry the area or choose a preset before exporting a claim.',notes:[]};
 if(!area)return {rule:'LOADING',title:'Waiting for the selected area',meaning:'The source tiles are still loading.',action:'Wait for the calendar and its evidence before drawing a conclusion.',notes:[]};
 if(!area.cellCount)return {rule:'EMPTY',title:'No archived active cell centers in this box',meaning:'This is an absence of archive coverage, not evidence of no burning.',action:'Try a larger box or a preset; do not report an empty area as zero activity.',notes:[]};
 if(!month||month.harm==null)return {rule:'MISSING',title:'No complete estimate for this month',meaning:'At least one included cell has missing data. The app does not substitute zero or show a partial total.',action:'Inspect the raw platforms and adjacent months. Keep this month missing in any exported trend.',notes:[]};
 const notes:string[]=[];
 const outages=manifest.outage_months.filter(o=>o.month===month.month&&o.missing_days.length);
 if(outages.length)notes.push('Archive-wide coverage flags this month: '+outages.map(o=>`${PLATFORM_NAMES[o.platform]} (${o.missing_days.length} missing days)`).join('; ')+'. Raw values can be masked while a coverage-adjusted estimate remains available.');
 if(month.src.includes('M'))notes.push('This estimate uses a MODIS conversion onto the VIIRS scale. Treat the sensor transition as a modelling step, not an observed jump in burning.');
 if(month.month<'2003-01')notes.push('Early archive: limited satellite coverage and no contemporaneous VIIRS validation.');
 notes.push('The clock badge describes the annual fire season; it does not measure a separate effect for this month.');
 if(clock?.badge==='clock_sensitive'){
  const names=clock.drivers.map(p=>PLATFORM_NAMES[p as 'T'|'A']).join(' and ');
  return {rule:'CLOCK_SENSITIVE',title:'Compare the satellites separately',meaning:`${names || 'MODIS'} changed relative to S-NPP beyond the clock diagnostic threshold. This can affect the trend, but the badge alone cannot tell how much burning changed or correct a VIIRS decline.`,action,notes};
 }
 if(Number(month.month.slice(0,4))<2021||clock?.badge==='not_evaluated')return {rule:'PRE_DIAGNOSTIC',title:'Read this as an earlier part of the record',meaning:'The drift badge starts in 2021. Its absence in earlier years does not establish stable observation conditions.',action,notes};
 if(!clock||clock.badge==='not_identifiable')return {rule:'LOW_SUPPORT',title:'The clock comparison is inconclusive',meaning:'Too few paired observations or an incomplete baseline prevent a timing verdict. The calendar remains an estimate, not a verified measure of all burning.',action,notes};
 const label=month.anomaly==='below'?'below':month.anomaly==='above'?'above':'within';
 return {rule:'WITHIN_THRESHOLD',title:month.anomaly==='missing'?'No historical comparison is available':`This month is ${label} its historical range`,meaning:month.anomaly==='missing'?'The annual clock test is within threshold, but a missing baseline prevents a monthly anomaly claim.':`The harmonized estimate is ${label} the middle half of same-month observations in 2003–2022. Testable clock ratios are within threshold; clouds, sensitivity and model error can still affect it.`,action,notes};
}
export type ReceiptData=Record<string,any>;
export function receiptFacts(data:ReceiptData){
 const h=data.gk2a_by_hour;
 const sum=(a:number[])=>a.reduce((s,v)=>s+v,0);
 const late=(a:number[])=>sum(a.filter((_,i)=>h.hours[i]>=16))/sum(a)*100;
 const seventeen=h.hours.indexOf(17),days=data.gk2a_unique_pixel_days;
 return {officialDecline:100*(1-data.claim_source.value_2025/data.claim_source.value_2021),late2021:late(h.pixel_hours_2021),late2025:late(h.pixel_hours_2025),at17:h.pixel_hours_2025[seventeen]/h.pixel_hours_2021[seventeen],afternoonDecline:100*(1-days['2025']/days['2021']),versus2019:days['2025']/days['2019'],peakYear:Object.entries(days).sort((a,b)=>Number(b[1])-Number(a[1]))[0][0]};
}
