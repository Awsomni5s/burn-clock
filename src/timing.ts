import type {Month} from './types';

export interface TimingTest {
  platform:'T'|'A'; count:number|null; reference:number|null;
  delta:number|null; sigma:number|null; threshold:number|null;
  testable:boolean; reason:string; baselineYears:number[];
}
export type TimingStatus='signal'|'within'|'unknown';
export interface TimingChecks {
  year:number; months:number[]; late:TimingStatus; relationship:TimingStatus;
  tests:TimingTest[]; drivers:('T'|'A')[];
}
/** Selected-month interpretation of the 14 November contract supersession.
 * The referenced addendum §1b was not supplied. Retain the documented log-ratio
 * thresholds, split a positive Aqua signal from either MODIS relationship change.
 * This is a diagnostic, not a causal test or a correction to fire counts.
 */
export function timingChecks(rows:Month[],months:number[],year:number):TimingChecks {
  const selected=[...new Set(months)].sort((a,b)=>a-b);
  const valid=selected.length>0&&selected.every(m=>Number.isInteger(m)&&m>=1&&m<=12)&&Number.isInteger(year);
  const index=new Map(rows.map(r=>[r.month,r]));
  const total=(y:number,p:'T'|'A'|'N')=>{
    const values=selected.map(m=>index.get(`${y}-${String(m).padStart(2,'0')}`)?.raw[p]);
    return valid&&values.every(v=>typeof v==='number'&&Number.isFinite(v)&&v>=0)?values.reduce<number>((s,v)=>s+v!,0):null;
  };
  const tests:TimingTest[]=(['T','A'] as const).map(platform=>{
    const count=total(year,platform),reference=total(year,'N');
    const baselineYears:number[]=[],ratios:number[]=[];
    for(let y=2013;y<=2019;y++){
      const p=total(y,platform),n=total(y,'N');
      if(p!=null&&n!=null&&p>0&&n>0){baselineYears.push(y);ratios.push(Math.log(p/n));}
    }
    const mean=ratios.length===7?ratios.reduce((s,x)=>s+x,0)/7:null;
    const sigma=mean==null?null:Math.sqrt(ratios.reduce((s,x)=>s+(x-mean)**2,0)/7);
    const threshold=sigma==null?null:Math.max(2*sigma,.15);
    const delta=mean!=null&&count!=null&&count>0&&reference!=null&&reference>0?Math.log(count/reference)-mean:null;
    const reason=!valid?'Choose at least one valid month.':year<2021?'Timing checks begin in 2021.':count==null||reference==null?'At least one selected month is missing.':baselineYears.length!==7?'The same-month 2013–19 baseline is incomplete or contains a zero total.':reference<200?'Fewer than 200 S-NPP cell-days in the selected months.':count<50?`Fewer than 50 ${platform==='A'?'Aqua':'Terra'} cell-days in the selected months.`:'Enough observations for this diagnostic.';
    const testable=valid&&year>=2021&&count!=null&&count>=50&&reference!=null&&reference>=200&&delta!=null&&threshold!=null;
    return {platform,count,reference,delta,sigma,threshold,testable,reason,baselineYears};
  });
  const aqua=tests[1],drivers=tests.filter(t=>t.testable&&Math.abs(t.delta!)>t.threshold!).map(t=>t.platform);
  return {year,months:selected,tests,drivers,late:!aqua.testable?'unknown':aqua.delta!>aqua.threshold!?'signal':'within',relationship:drivers.length?'signal':tests.every(t=>t.testable)?'within':'unknown'};
}
