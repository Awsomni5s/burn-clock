import {timingChecks,type TimingChecks} from './timing';
import {PLATFORMS, type AreaResult, type ClockYear, type Manifest, type Month, type Platform} from './types';

/** All inputs are the supplied daytime active-cell-day series, not individual fires. */
export type ClaimStatus = 'ok'|'missing_months'|'too_few'|'zero_baseline'|'invalid_bounds'|'invalid_selection';
export interface StatWarning {code:string;message:string}
export interface PlatformClaim {
  platform:Platform;status:ClaimStatus;sumA:number|null;sumB:number|null;
  ratio:number|null;changePct:number|null;lookA:number|null;lookB:number|null;
}
export interface HarmonizedClaim {
  status:ClaimStatus;sumA:number|null;sumB:number|null;
  loA:number|null;hiA:number|null;loB:number|null;hiB:number|null;
  ratio:number|null;range:[number,number]|null;changePct:number|null;rangePct:[number,number]|null;
}
export interface ClaimResult {
  months:number[];a:number;b:number;platforms:PlatformClaim[];harmonized:HarmonizedClaim;
  checks:TimingChecks;
  /** Archived fixed-season diagnostic, retained only for reproducibility. UI uses checks. */
  timing:ClockYear|null;timingStatus:'available'|'before_2021'|'missing';
  convertedShare:number;convertedMonths:number;selectedMonthCount:number;
  outages:Manifest['outage_months'];warnings:StatWarning[];
}
export interface TrendYear {year:number;harm:number;lo:number;hi:number}
export interface TrendResult {
  status:'ok'|'invalid_selection'|'too_few_years'|'zero_median';months:number[];start:number;end:number;
  years:TrendYear[];excludedYears:number[];median:number|null;slope:number|null;
  pctPerYear:number|null;rangePct:[number,number]|null;
  verdict:'rising'|'falling'|'no_clear_trend'|'unavailable';
  modisSlope:number|null;modisOpposite:boolean;warnings:StatWarning[];
}

const finite=(n:unknown):n is number=>typeof n==='number'&&Number.isFinite(n);
const nonnegative=(n:unknown):n is number=>finite(n)&&n>=0;
function selectedMonths(months:number[]):number[]|null {
  return months.length&&months.every(m=>Number.isInteger(m)&&m>=1&&m<=12)?[...new Set(months)].sort((a,b)=>a-b):null;
}
const key=(year:number,month:number)=>`${year}-${String(month).padStart(2,'0')}`;
function selectedRows(area:AreaResult,months:number[],year:number):(Month|undefined)[] {
  const rows=new Map(area.months.map(m=>[m.month,m]));
  return months.map(month=>rows.get(key(year,month)));
}
function sum(values:(number|null|undefined)[]):number|null {
  if(!values.length||!values.every(nonnegative))return null;
  // Source values have two-decimal precision; summing hundredths preserves ties.
  return values.reduce((total,n)=>total+Math.round(n*100),0)/100;
}
function median(values:number[]):number|null {
  if(!values.length)return null;
  const sorted=[...values].sort((a,b)=>a-b),middle=Math.floor(sorted.length/2);
  return sorted.length%2?sorted[middle]:(sorted[middle-1]+sorted[middle])/2;
}
function annual(rows:(Month|undefined)[]) {
  const harm=sum(rows.map(r=>r?.harm)),lo=sum(rows.map(r=>r?.lo)),hi=sum(rows.map(r=>r?.hi));
  const invalidBounds=rows.some(r=>r?.lo!=null&&r?.hi!=null&&r.lo>r.hi);
  return {harm,lo,hi,invalidBounds};
}

/** Addendum §6a: strict month completeness; bounds are approximate fully correlated sums. */
export function computeClaim(area:AreaResult,months:number[],a:number,b:number,manifest:Manifest):ClaimResult {
  const selection=selectedMonths(months),valid=!!selection&&Number.isInteger(a)&&Number.isInteger(b);
  const chosen=selection??[],rowsA=valid?selectedRows(area,chosen,a):[],rowsB=valid?selectedRows(area,chosen,b):[];
  const first=annual(rowsA),last=annual(rowsB);
  const clockA=area.clock.find(c=>c.year===a),clockB=area.clock.find(c=>c.year===b);
  const platforms=PLATFORMS.map(platform=>{
    const sumA=sum(rowsA.map(r=>r?.raw[platform])),sumB=sum(rowsB.map(r=>r?.raw[platform]));
    const status:ClaimStatus=!valid?'invalid_selection':sumA==null||sumB==null?'missing_months':sumA<50||sumB<50?'too_few':'ok';
    const ratio=status==='ok'?sumB!/sumA!:null;
    return {platform,status,sumA,sumB,ratio,changePct:ratio==null?null:(ratio-1)*100,lookA:clockA?.look[platform]??null,lookB:clockB?.look[platform]??null};
  });
  const all=[first.harm,first.lo,first.hi,last.harm,last.lo,last.hi];
  const status:ClaimStatus=!valid?'invalid_selection':all.some(n=>n==null)?'missing_months':first.invalidBounds||last.invalidBounds?'invalid_bounds':first.harm!<=0||first.lo!<=0||first.hi!<=0?'zero_baseline':'ok';
  const ratio=status==='ok'?last.harm!/first.harm!:null;
  const range:[number,number]|null=status==='ok'?[last.lo!/first.hi!,last.hi!/first.lo!]:null;
  const harmonized:HarmonizedClaim={status,sumA:first.harm,sumB:last.harm,loA:first.lo,hiA:first.hi,loB:last.lo,hiB:last.hi,ratio,range,changePct:ratio==null?null:(ratio-1)*100,rangePct:range?[(range[0]-1)*100,(range[1]-1)*100]:null};
  const keys=new Set(valid?[a,b].flatMap(year=>chosen.map(month=>key(year,month))):[]);
  const selected=area.months.filter(row=>keys.has(row.month));
  const convertedMonths=selected.filter(row=>row.src.includes('M')).length;
  const convertedShare=keys.size?convertedMonths/keys.size:0;
  const outages=manifest.outage_months.filter(outage=>keys.has(outage.month));
  const warnings:StatWarning[]=[];
  if(valid&&Math.min(a,b)<2012&&Math.max(a,b)>=2012)warnings.push({code:'seam_2012',message:'This comparison crosses the 2012 switch from converted MODIS to VIIRS observations.'});
  if(convertedShare>.3)warnings.push({code:'converted_modis',message:'More than 30% of the selected area-months include converted MODIS values. Prefer 2012 onward when possible.'});
  if(outages.length)warnings.push({code:'outage',message:`Satellite outage in ${[...new Set(outages.map(o=>`${({T:'Terra',A:'Aqua',N:'S-NPP',J1:'NOAA-20',J2:'NOAA-21'} as Record<string,string>)[o.platform]??o.platform} (${new Date(o.month+'-15T00:00:00Z').toLocaleString('en',{month:'long',year:'numeric',timeZone:'UTC'})})`))].join(', ')}. Missing days are treated as missing, not zero.`});
  if(status==='missing_months')warnings.push({code:'missing_months',message:'The comparison is unavailable because at least one selected month has missing values.'});
  if(status==='zero_baseline')warnings.push({code:'zero_baseline',message:'A zero baseline value or lower bound prevents a finite change range.'});
  if(status==='invalid_bounds')warnings.push({code:'invalid_bounds',message:'A supplied lower bound exceeds its upper bound; no change range can be reported.'});
  return {months:chosen,a,b,platforms,harmonized,checks:timingChecks(area.months,chosen,b),timing:b>=2021?clockB??null:null,timingStatus:b<2021?'before_2021':clockB?'available':'missing',convertedShare,convertedMonths,selectedMonthCount:keys.size,outages,warnings};
}

/** Median of all pairwise slopes. Two complete years suffice for a descriptive slope. */
export function theilSen(points:{year:number;value:number}[]):number|null {
  if(points.length<2||points.some(p=>!finite(p.year)||!finite(p.value)))return null;
  const slopes:number[]=[];
  for(let i=0;i<points.length;i++)for(let j=i+1;j<points.length;j++)if(points[j].year!==points[i].year)slopes.push((points[j].value-points[i].value)/(points[j].year-points[i].year));
  return median(slopes);
}

/** Addendum §6d. Bound-series slopes are a sensitivity range, not a slope confidence interval. */
export function computeTrend(area:AreaResult,months:number[],start=2012,end=2025):TrendResult {
  const selection=selectedMonths(months),valid=!!selection&&Number.isInteger(start)&&Number.isInteger(end)&&start<=end&&end-start<=1000;
  const result:TrendResult={status:'invalid_selection',months:selection??[],start,end,years:[],excludedYears:[],median:null,slope:null,pctPerYear:null,rangePct:null,verdict:'unavailable',modisSlope:null,modisOpposite:false,warnings:[]};
  if(!valid)return result;
  const rawYears:{year:number;value:number}[]=[];
  for(let year=start;year<=end;year++){
    const rows=selectedRows(area,selection,year),values=annual(rows);
    if(values.harm==null||values.lo==null||values.hi==null||values.invalidBounds){result.excludedYears.push(year);continue;}
    result.years.push({year,harm:values.harm,lo:values.lo,hi:values.hi});
    const raw=sum(rows.flatMap(row=>[row?.raw.T,row?.raw.A]));
    if(raw!=null)rawYears.push({year,value:raw});
  }
  if(result.excludedYears.length)result.warnings.push({code:'incomplete_years',message:`Years with missing selected months or invalid bounds were excluded: ${result.excludedYears.join(', ')}.`});
  result.median=median(result.years.map(y=>y.harm));
  if(result.years.length<2){result.status='too_few_years';result.warnings.push({code:'too_few_years',message:'At least two complete years are needed for a descriptive trend.'});return result;}
  result.slope=theilSen(result.years.map(y=>({year:y.year,value:y.harm})));
  if(result.median==null||result.median<=0){result.status='zero_median';result.warnings.push({code:'zero_median',message:'The median annual value is zero, so a percentage-per-year trend is unavailable.'});return result;}
  result.status='ok';result.pctPerYear=result.slope!/result.median*100;
  const bounds=['lo','hi'].map(field=>theilSen(result.years.map(y=>({year:y.year,value:y[field as 'lo'|'hi']})))!/result.median!*100).sort((a,b)=>a-b);
  result.rangePct=[bounds[0],bounds[1]];
  result.verdict=bounds[0]<=0&&bounds[1]>=0?'no_clear_trend':result.pctPerYear>0?'rising':result.pctPerYear<0?'falling':'no_clear_trend';
  if(rawYears.length===result.years.length){result.modisSlope=theilSen(rawYears);result.modisOpposite=result.modisSlope!=null&&result.modisSlope*result.slope!<0;}
  else result.warnings.push({code:'modis_incomplete',message:'The MODIS-only comparison is unavailable because Terra or Aqua is missing in at least one of the same included years.'});
  result.warnings.push({code:'approximate_slope_range',message:'The range is formed from slopes of the lower and upper activity series, using the median central series as the denominator. It is not a calibrated confidence interval for the trend.'});
  return result;
}

/** Piecewise-linear curve; no extrapolation beyond measured hours. */
export function interpolateCurve(hours:number[],values:number[],hour:number):number|null {
  if(hours.length<2||hours.length!==values.length||!finite(hour)||hours.some((h,i)=>!finite(h)||(i>0&&h<=hours[i-1]))||values.some(v=>!nonnegative(v)))return null;
  if(hour<hours[0]||hour>hours[hours.length-1])return 0;
  const i=hours.findIndex(h=>h>=hour);
  if(hours[i]===hour)return values[i];
  const fraction=(hour-hours[i-1])/(hours[i]-hours[i-1]);
  return values[i-1]+(values[i]-values[i-1])*fraction;
}
export function shiftedCurve(hours:number[],values:number[],shiftHours:number):(number|null)[] {
  return hours.map(hour=>finite(shiftHours)&&shiftHours>=0?interpolateCurve(hours,values,hour-shiftHours):null);
}
/** Remaining share at a fixed pass hour; null if the baseline curve is zero. */
export function shiftedRatio(hours:number[],values:number[],shiftHours:number,satelliteHour:number):number|null {
  if(!finite(shiftHours)||shiftHours<0)return null;
  const baseline=interpolateCurve(hours,values,satelliteHour),shifted=interpolateCurve(hours,values,satelliteHour-shiftHours);
  return baseline!=null&&baseline>0&&shifted!=null?shifted/baseline:null;
}
/** Solar time → fixed UTC-offset clock time. Caller must label the chosen offset (not infer DST). */
export function localClock(lookSolar:number|null,longitude:number,zoneOffsetHours:number):number|null {
  if(!finite(lookSolar)||!finite(longitude)||!finite(zoneOffsetHours))return null;
  return ((lookSolar-longitude/15+zoneOffsetHours)%24+24)%24;
}
export function formatClock(hour:number|null):string {
  if(!finite(hour))return '—';
  const minutes=((Math.round(hour*60)%1440)+1440)%1440;
  return `${String(Math.floor(minutes/60)).padStart(2,'0')}:${String(minutes%60).padStart(2,'0')}`;
}
