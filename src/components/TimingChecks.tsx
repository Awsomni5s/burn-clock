import type {TimingChecks as Checks} from '../timing';
import type {ClaimResult} from '../stats';
import {PLATFORM_NAMES} from '../types';
import {number,signed} from '../data';
import {Evidence} from './Provenance';
import {verdictFor,verdictSentence,VERDICT_LABEL,TRUST_ANSWER,TRUST_REASON} from '../verdict';
import type {ReactNode} from 'react';

import {lateLabel,modisLabel} from '../labels';
export {lateLabel,modisLabel};
/** Kept for the claim card text. */
export const timingLabel=lateLabel;

const plainReason=(r:string)=>/Fewer than|S-NPP cell-days/.test(r)?'Too few fires in these months to test.':/missing/.test(r)?'A selected month is missing.':/2021/.test(r)?'The timing check starts in 2021.':/baseline/.test(r)?'The 2013–19 comparison years are incomplete here.':r;

export default function TimingChecks({checks,result,monthLabel,aquaPass,children}:{checks:Checks;result?:ClaimResult;monthLabel?:string;aquaPass?:string;children?:ReactNode}){
  const aqua=checks.tests[1],verdict=verdictFor(checks);
  const drivers=checks.drivers.map(p=>PLATFORM_NAMES[p]).join(' and ');
  const lateText=checks.late==='signal'?`Aqua now passes later${aquaPass?` (about ${aquaPass})`:''} and catches relatively more fire than it did in 2013–19. Burning has probably shifted later in the day.`:checks.late==='within'?`Aqua’s later pass${aquaPass?` (about ${aquaPass})`:''} sees about the same share of fire as in 2013–19. No sign that burning moved later.`:plainReason(aqua.reason);
  const modisText=checks.relationship==='signal'?`${drivers} ${checks.drivers.length>1?'have':'has'} moved away from VIIRS beyond normal year-to-year swings. Trends from Terra or Aqua alone would mislead here; use the combined record.`:checks.relationship==='within'?'Terra and Aqua still track VIIRS as closely as they did in 2013–19.':'Not enough fires to compare both Terra and Aqua with VIIRS.';
  return <section className={'trend-verdict verdict-'+verdict} aria-labelledby="verdict-title" data-source="tiles/*.json:raw.T,raw.A,raw.N;src/timing.ts;src/verdict.ts">
    <p className="verdict-eyebrow">Can you trust this trend?</p>
    <p className="verdict-answer" data-testid="verdict-answer">{TRUST_ANSWER[verdict]}<span className="verdict-reason"> {TRUST_REASON[verdict]}</span></p>
    <h2 id="verdict-title" className="verdict-chip" data-testid="verdict">{VERDICT_LABEL[verdict]}</h2>
    {result&&<p className="verdict-sentence" data-testid="verdict-sentence">{verdictSentence(verdict,result,monthLabel??'')}</p>}
    {children}
    <div className="timing-checks" aria-label="Why: two timing checks for the selected months">
      <div className={'timing-check '+checks.late}><h3>Has burning moved to hours the satellites miss?</h3><strong className="timing-verdict" data-testid="timing-late">{lateLabel(checks.late)}</strong><p>{lateText}</p></div>
      <div className={'timing-check '+checks.relationship}><h3>Is the older MODIS record off here?</h3><strong className="timing-verdict" data-testid="timing-relationship">{modisLabel(checks.relationship)}</strong><p>{modisText}</p></div>
    </div>
    <details className="timing-detail"><summary>How these two checks work · selected months in {checks.year}</summary><p>Terra now passes about an hour earlier and Aqua about an hour later than in 2013–19; the two VIIRS satellites haven’t moved. For your months, each check compares Terra ÷ VIIRS and Aqua ÷ VIIRS with the same months in 2013–19 (log ratio). A change beyond twice the normal 2013–19 swing (at least 0.15) counts. Aqua rising means the later pass now catches more fire, so burning has probably moved later. It is a diagnostic, not proof of cause or a corrected fire count. <a href="#methods">Exact rules and limits</a>.</p><div className="table-scroll"><table><thead><tr><th>Satellite</th><th>Change vs 2013–19 (log ratio)</th><th>Normal swing</th><th>Enough data?</th></tr></thead><tbody>{checks.tests.map(t=><tr key={t.platform}><th>{PLATFORM_NAMES[t.platform]}</th><td><Evidence value={signed(t.delta,3)} expression={`timingChecks.tests.${t.platform}.delta`} source="tiles/*.json → raw; selected months, 2013–19 and selected year" producer="src/timing.ts"/></td><td>±<Evidence value={number(t.threshold,3)} expression={`max(2 × population SD(log(${t.platform}/N)), 0.15)`} source="tiles/*.json → raw" producer="src/timing.ts"/></td><td>{t.reason}</td></tr>)}</tbody></table></div></details>
  </section>;
}
