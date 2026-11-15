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
