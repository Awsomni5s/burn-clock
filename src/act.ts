/** Punjab action planner: pure calculations on public/data/punjab_districts.json. */
export interface District{name:string;gk2a_pixel_hours:Record<string,number[]>;gk2a_pixel_days:Record<string,number[]>;snpp_celldays:Record<string,number[]>;noaa20_celldays:Record<string,number[]>;geometry?:{type:'Polygon'|'MultiPolygon';coordinates:any}}
export interface DistrictDoc{region:string;years:number[];hours_ist:number[];days_mmdd:string[];outage_mmdd:Record<string,string[]>;outage_rule:string;gk2a_unassigned_pixel_hours:Record<string,number>;assignment:string;sources:Record<string,string>;limits:string;generated_utc:string;script:string;units:Record<string,string>;districts:District[]}

export const ALL='All 22 districts';
export const PASS_HOURS=[13,14];
export const LATE_HOURS=[16,17,18];
/** Below these totals a district's year-to-year comparison is too noisy to show. */
export const MIN_SNPP=100,MIN_GK2A=100,MIN_HOURLY=100;

export const sum=(v:number[])=>v.reduce((s,x)=>s+x,0);
const addv=(a:Record<string,number[]>,b:Record<string,number[]>)=>Object.fromEntries(Object.keys(b).map(k=>[k,b[k].map((x,i)=>(a[k]?.[i]??0)+x)]));

/** All districts summed. Pixels outside every district polygon are left out, so this is slightly below the state file. */
export function allDistricts(doc:DistrictDoc):District{
  return doc.districts.reduce<District>((acc,d)=>({name:ALL,gk2a_pixel_hours:addv(acc.gk2a_pixel_hours,d.gk2a_pixel_hours),gk2a_pixel_days:addv(acc.gk2a_pixel_days,d.gk2a_pixel_days),snpp_celldays:addv(acc.snpp_celldays,d.snpp_celldays),noaa20_celldays:addv(acc.noaa20_celldays,d.noaa20_celldays)}),{name:ALL,gk2a_pixel_hours:{},gk2a_pixel_days:{},snpp_celldays:{},noaa20_celldays:{}});
}
export function findDistrict(doc:DistrictDoc,name:string):District{return name===ALL?allDistricts(doc):doc.districts.find(d=>d.name===name)??allDistricts(doc);}

/** Share (%) of the noon–6 pm signal in the given hourly images. Null when there is no signal. */
export function shareAt(v:number[],hours:number[],all=[12,13,14,15,16,17,18]):number|null{
  const t=sum(v);if(!t)return null;
  return 100*v.reduce((s,x,i)=>s+(hours.includes(all[i])?x:0),0)/t;
}
export const lateShare=(v:number[])=>shareAt(v,LATE_HOURS);
export const passShare=(v:number[])=>shareAt(v,PASS_HOURS);

/** The run of `len` consecutive hourly images that holds the most of the signal. Ties go to the earlier window. */
export function bestWindow(v:number[],len:number,all=[12,13,14,15,16,17,18]){
  const t=sum(v);let best=0,at=0;
  for(let i=0;i+len<=v.length;i++){const s=sum(v.slice(i,i+len));if(s>best){best=s;at=i;}}
  return {start:all[at],end:all[at+len-1],hours:all.slice(at,at+len),share:t?100*best/t:null,total:t};
}
const h12=(h:number)=>h===12?'noon':h<12?`${h} am`:`${h-12} pm`;
export function windowLabel(start:number,end:number){return start===end?`around ${h12(start)}`:`${h12(start)} to ${h12(end)}`;}
export const hourLabel=h12;

export type Gap={ok:true;base:number;year:number;snppA:number;snppB:number;gkA:number;gkB:number;snppChange:number;gkChange:number;factor:number;masked:string[]}|{ok:false;base:number;year:number;reason:string};
/** Outage days of either compared year, dropped from both years (same rule as the statewide base-year comparison). */
export const pairMask=(doc:Pick<DistrictDoc,'outage_mmdd'>,a:number,b:number)=>[...new Set([...(doc.outage_mmdd[a]??[]),...(doc.outage_mmdd[b]??[])])].sort();
export function maskedSum(v:number[]|undefined,days:string[],mask:string[]){return v?v.reduce((s,x,i)=>s+(mask.includes(days[i])?0:x),0):null;}
/** How much more the ~1:40 pm satellite count fell than the whole-afternoon geostationary signal. */
export function countGap(d:District,doc:Pick<DistrictDoc,'outage_mmdd'|'days_mmdd'>,base:number,year=2025):Gap{
  const mask=pairMask(doc,base,year),f=(v:number[]|undefined)=>maskedSum(v,doc.days_mmdd,mask);
  const snppA=f(d.snpp_celldays[base]),snppB=f(d.snpp_celldays[year]),gkA=f(d.gk2a_pixel_days[base]),gkB=f(d.gk2a_pixel_days[year]);
  if(snppA==null||gkA==null||snppB==null||gkB==null)return {ok:false,base,year,reason:'A year is missing.'};
  if(snppA<MIN_SNPP||gkA<MIN_GK2A)return {ok:false,base,year,reason:`Too few fires in ${base} to compare (needs at least ${MIN_SNPP} satellite cell-days and ${MIN_GK2A} geostationary pixel-days).`};
  if(!snppB||!gkB)return {ok:false,base,year,reason:`No fires recorded in ${year} by one of the two sources.`};
  const rs=snppB/snppA,rg=gkB/gkA;
  return {ok:true,base,year,snppA,snppB,gkA,gkB,snppChange:100*(rs-1),gkChange:100*(rg-1),factor:rg/rs,masked:mask};
}

export const pctText=(x:number)=>`${x<0?'fell':'rose'} ${Math.round(Math.abs(x))}%`;
/** Reporting wording for one district and pair of years. Only states what the two sources show. */
export function wording(d:District,doc:Pick<DistrictDoc,'outage_mmdd'|'days_mmdd'>,base:number,year=2025){
  const g=countGap(d,doc,base,year),place=d.name===ALL?'Punjab':d.name,v=d.gk2a_pixel_hours[year],late=v?lateShare(v):null;
  if(!g.ok)return null;
  const say=`Satellite fire counts for ${place}, taken at about 1:40 pm, ${pctText(g.snppChange)} between ${base} and ${year} (October–November).`;
  const dont=`Burning in ${place} ${pctText(g.snppChange)} between ${base} and ${year}.`;
  const why=`An hourly geostationary record of the whole afternoon ${pctText(g.gkChange)} over the same period${late!=null&&sum(v)>=MIN_HOURLY?`, and in ${year} ${Math.round(late)}% of ${place}’s noon–6 pm fire signal came at 4 pm or later, after the satellites pass`:''}.`;
  return {say,dont,why,gap:g};
}

export function profileCsv(doc:DistrictDoc){
  const rows=['district,year,hour_ist,gk2a_pixel_hours,share_of_noon_to_6pm_pct'];
  for(const d of [allDistricts(doc),...doc.districts])for(const y of doc.years){const v=d.gk2a_pixel_hours[y],t=sum(v);v.forEach((x,i)=>rows.push([JSON.stringify(d.name),y,doc.hours_ist[i],x,t?(100*x/t).toFixed(2):''].join(',')));}
  return rows.join('\n')+'\n';
}
export function districtCsv(doc:DistrictDoc){
  const rows=['district,year,snpp_celldays_oct_nov,noaa20_celldays_oct_nov,gk2a_pixel_days_oct_nov,gk2a_pixel_hours_noon_to_6pm,late_share_4pm_plus_pct,pass_share_1_2pm_pct'];
  for(const d of [allDistricts(doc),...doc.districts])for(const y of doc.years){const v=d.gk2a_pixel_hours[y];rows.push([JSON.stringify(d.name),y,sum(d.snpp_celldays[y]),sum(d.noaa20_celldays[y]),sum(d.gk2a_pixel_days[y]),sum(v),lateShare(v)?.toFixed(2)??'',passShare(v)?.toFixed(2)??''].join(','));}
  return rows.join('\n')+'\n';
}

/** Districts ranked by late-afternoon signal (4 pm or later) in a year. */
export function priority(doc:DistrictDoc,year:number){
  const total=sum(doc.districts.map(d=>sum(d.gk2a_pixel_hours[year].slice(4))));
  return doc.districts.map(d=>{const v=d.gk2a_pixel_hours[year],late=sum(v.slice(4));return {name:d.name,late,shareOfState:total?100*late/total:0,lateShare:sum(v)>=MIN_HOURLY?lateShare(v):null,snpp:sum(d.snpp_celldays[year]),window:sum(v)>=MIN_HOURLY?bestWindow(v,3):null};}).sort((a,b)=>b.late-a.late||a.name.localeCompare(b.name));
}

/** The run of `len` consecutive days (Oct 1–Nov 30) holding the most geostationary pixel-days in a season. */
export function busiestDays(d:District,doc:Pick<DistrictDoc,'days_mmdd'>,year:number,len=14){
  const v=d.gk2a_pixel_days[year]??[],t=sum(v);let best=-1,at=0;
  for(let i=0;i+len<=v.length;i++){const s=sum(v.slice(i,i+len));if(s>best){best=s;at=i;}}
  const fmt=(mmdd:string)=>`${Number(mmdd.slice(3))} ${mmdd.startsWith('10')?'Oct':'Nov'}`;
  return {from:fmt(doc.days_mmdd[at]),to:fmt(doc.days_mmdd[at+len-1]),share:t?100*best/t:null,total:t};
}

/** Deterministic PRNG so the bootstrap range is the same on every load and in tests. */
function mulberry32(seed:number){return()=>{seed|=0;seed=seed+0x6D2B79F5|0;let t=Math.imul(seed^seed>>>15,1|seed);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296;};}
/** 90% range of the count-gap factor from resampling days (with replacement) within each year. */
export function gapRange(d:District,doc:Pick<DistrictDoc,'outage_mmdd'|'days_mmdd'>,base:number,year=2025,reps=1000,seed=20261115):[number,number]|null{
  const g=countGap(d,doc,base,year);if(!g.ok)return null;
  const mask=pairMask(doc,base,year),keep=doc.days_mmdd.map((m,i)=>mask.includes(m)?-1:i).filter(i=>i>=0);
  const sa=d.snpp_celldays[base],sb=d.snpp_celldays[year],ga=d.gk2a_pixel_days[base],gb=d.gk2a_pixel_days[year],rnd=mulberry32(seed),out:number[]=[];
  for(let r=0;r<reps;r++){let SA=0,GA=0,SB=0,GB=0;for(let k=0;k<keep.length;k++){const i=keep[Math.floor(rnd()*keep.length)],j=keep[Math.floor(rnd()*keep.length)];SA+=sa[i];GA+=ga[i];SB+=sb[j];GB+=gb[j];}if(SA&&GA&&SB&&GB)out.push((GB/GA)/(SB/SA));}
  if(out.length<reps*0.9)return null;out.sort((a,b)=>a-b);
  return [out[Math.floor(0.05*(out.length-1))],out[Math.ceil(0.95*(out.length-1))]];
}

/** Season timing from daily geostationary pixel-days: dates by which 10%, 50% and 90% of the season's signal had appeared. */
export function seasonDates(d:District,doc:Pick<DistrictDoc,'days_mmdd'>,year:number){
  const v=d.gk2a_pixel_days[year]??[],t=sum(v);if(t<MIN_GK2A)return null;
  const at=(q:number)=>{let c=0;for(let i=0;i<v.length;i++){c+=v[i];if(c>=q*t)return doc.days_mmdd[i];}return doc.days_mmdd[v.length-1];};
  const fmt=(m:string)=>`${Number(m.slice(3))} ${m.startsWith('10')?'Oct':'Nov'}`;
  return {start:fmt(at(.1)),mid:fmt(at(.5)),end:fmt(at(.9)),total:t};
}

/** Point-in-polygon (ray casting) so “Use my location” runs in the browser and sends nothing anywhere. */
function inRing(x:number,y:number,r:number[][]){let ins=false;for(let i=0,j=r.length-1;i<r.length;j=i++){const [xi,yi]=r[i],[xj,yj]=r[j];if((yi>y)!==(yj>y)&&x<(xj-xi)*(y-yi)/(yj-yi)+xi)ins=!ins;}return ins;}
export function districtAt(doc:DistrictDoc,lat:number,lon:number):string|null{
  for(const d of doc.districts){const g=d.geometry;if(!g)continue;const polys=g.type==='Polygon'?[g.coordinates]:g.coordinates;
    for(const p of polys as number[][][][])if(inRing(lon,lat,p[0])&&!p.slice(1).some(h=>inRing(lon,lat,h)))return d.name;}
  return null;
}

/** This week (FIRMS 7-day) against the same calendar days in the archive: Aqua ÷ VIIRS on days both recorded fire. */
export interface WeekDoc{generated_utc:string;window:{first_date:string|null;last_date:string|null};median_pass_ist:Record<string,number>;by_date:Record<string,Record<string,number>>;districts:{name:string;daytime:Record<string,number>}[];feeds:Record<string,{url:string;rows:number;first_date:string|null;last_date:string|null}>;definition:string;script:string}
export interface AquaDailyDoc{days_mmdd:string[];aqua:Record<string,number[]>;snpp:Record<string,number[]>;noaa20:Record<string,number[]>;aqua_median_pass_ist_november:Record<string,number>;definition:string;script:string}
export function weekRatio(week:WeekDoc){
  const A=week.by_date.A??{},J=week.by_date.J1??{},days=Object.keys(J).filter(d=>(A[d]??0)>0&&J[d]>0).sort();
  const a=sum(days.map(d=>A[d])),j=sum(days.map(d=>J[d]));
  return {days,aqua:a,viirs:j,ratio:j?a/j:null};
}
export function historyRatios(hist:AquaDailyDoc,mmdd:string[]){
  return Object.keys(hist.aqua).map(Number).sort().map(y=>{
    const ref=y>=2018&&hist.noaa20[y]?hist.noaa20[y]:hist.snpp[y],A=hist.aqua[y];
    const idx=mmdd.map(m=>hist.days_mmdd.indexOf(m)).filter(i=>i>=0&&A[i]>0&&ref[i]>0);
    const a=sum(idx.map(i=>A[i])),v=sum(idx.map(i=>ref[i]));
    return {year:y,ratio:v?a/v:null,aqua:a,viirs:v,days:idx.length,ref:y>=2018?'NOAA-20':'S-NPP',pass:hist.aqua_median_pass_ist_november[y]};
  });
}

/** A calendar file (RFC 5545) with one field-check event per day, in India time. Nothing is sent anywhere. */
export function fieldCheckIcs(place:string,startISO:string,days:number,startHour:number,endHour:number,note:string,url:string,stamp=new Date()){
  const pad=(n:number)=>String(n).padStart(2,'0'),esc=(t:string)=>t.replace(/\\/g,'\\\\').replace(/[,;]/g,m=>'\\'+m).replace(/\n/g,'\\n');
  const fold=(line:string)=>line.length<=74?line:line.match(/.{1,73}/g)!.join('\r\n ');
  const st=`${stamp.getUTCFullYear()}${pad(stamp.getUTCMonth()+1)}${pad(stamp.getUTCDate())}T${pad(stamp.getUTCHours())}${pad(stamp.getUTCMinutes())}00Z`;
  const [y,m,d]=startISO.split('-').map(Number),ev:string[]=[];
  for(let i=0;i<days;i++){const t=new Date(Date.UTC(y,m-1,d+i)),day=`${t.getUTCFullYear()}${pad(t.getUTCMonth()+1)}${pad(t.getUTCDate())}`;
    ev.push('BEGIN:VEVENT',`UID:burn-clock-${place.toLowerCase().replace(/[^a-z0-9]+/g,'-')}-${day}@burn-clock`,`DTSTAMP:${st}`,`DTSTART;TZID=Asia/Kolkata:${day}T${pad(startHour)}0000`,`DTEND;TZID=Asia/Kolkata:${day}T${pad(endHour)}0000`,fold(`SUMMARY:${esc(`Field check: ${place} (late-afternoon burning)`)}`),fold(`DESCRIPTION:${esc(note+' '+url)}`),'END:VEVENT');}
  return ['BEGIN:VCALENDAR','VERSION:2.0','PRODID:-//Burn Clock//Field check plan//EN','CALSCALE:GREGORIAN','BEGIN:VTIMEZONE','TZID:Asia/Kolkata','BEGIN:STANDARD','DTSTART:19700101T000000','TZOFFSETFROM:+0530','TZOFFSETTO:+0530','TZNAME:IST','END:STANDARD','END:VTIMEZONE',...ev,'END:VCALENDAR'].join('\r\n')+'\r\n';
}
