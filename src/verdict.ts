import type {TimingChecks} from './timing';
import type {ClaimResult} from './stats';

/** One plain verdict per area, months and comparison year, built only from the two timing checks.
 * timing  — Aqua (now passing later) sees relatively more fire than in 2013–19: burning probably moved later.
 * modis   — Terra or Aqua departs from VIIRS beyond normal swings, but no later-burning signal.
 * clear   — both MODIS satellites stay within their normal 2013–19 range relative to VIIRS.
 * unknown — at least one comparison cannot be made (too few fires, missing months, year before 2021).
 */
export type Verdict='timing'|'modis'|'clear'|'unknown';
export function verdictFor(c:TimingChecks):Verdict{
  if(c.late==='signal')return 'timing';
  if(c.relationship==='signal')return 'modis';
  if(c.late==='within'&&c.relationship==='within')return 'clear';
  return 'unknown';
}
export const VERDICT_LABEL:Record<Verdict,string>={
  timing:'Timing matters here',
  modis:'The older MODIS record is off here',
  clear:'Satellite timing doesn’t explain this',
  unknown:'Can’t tell yet',
};
/** The plain answer to “Can you trust this trend?”, shown before the reason. */
export const TRUST_ANSWER:Record<Verdict,string>={timing:'No',modis:'Yes, but not old MODIS counts',clear:'Yes',unknown:'Can’t tell yet'};
export const TRUST_REASON:Record<Verdict,string>={timing:'Burning moved to hours the satellites miss, so the count changed more than the burning.',modis:'The trend holds in the combined record; Terra or Aqua counts alone would mislead here.',clear:'Satellite timing doesn’t explain this change.',unknown:'Too little data here to test satellite timing.'};
export const VERDICT_SHORT:Record<Verdict,string>={timing:'Timing matters',modis:'MODIS record off',clear:'Timing isn’t the issue',unknown:'Can’t tell'};

const pct=(v:number)=>Math.round(Math.abs(v));
/** The one-sentence answer. Uses only the harmonized change, its approximate range and the verdict. */
export function verdictSentence(v:Verdict,r:ClaimResult,monthLabel:string):string{
  const h=r.harmonized,ok=h.status==='ok'&&h.changePct!=null&&h.rangePct!=null;
  const span=`${r.a}–${r.b}`;
  if(!ok)return v==='unknown'?`There isn’t enough complete data here to compare ${span} or to test satellite timing.`:`A complete ${span} comparison isn’t available for these months.`;
  const x=h.changePct!,lo=h.rangePct![0],hi=h.rangePct![1],noisy=lo<0&&hi>0,dir=x<0?'fell':'rose';
  const change=noisy?`Fire activity changed ${x<0?'−':'+'}${pct(x)}% (${span}, ${monthLabel}), but the range includes no change`:`Fire activity ${dir} about ${pct(x)}% (${span}, ${monthLabel})`;
  if(v==='timing')return x<0?`Fire activity here fell about ${pct(x)}% (${span}, ${monthLabel}), but part of that drop is burning that moved to hours the satellites don’t see.${noisy?' The range also includes no change.':''}`:`${change}, and burning appears to have shifted later, so the satellites may be missing some of it.`;
  if(v==='modis')return `${change}. Burning hours look unchanged, but a record built from the older MODIS satellites would be off here because their pass times drifted.`;
  if(v==='clear')return noisy?`No clear change between ${r.a} and ${r.b}: the range runs from −${pct(lo)}% to +${pct(hi)}%. Satellite timing isn’t the issue here.`:`${change}, and satellite timing doesn’t explain it.`;
  return `${change}. There are too few fires here to test whether satellite timing matters.`;
}
