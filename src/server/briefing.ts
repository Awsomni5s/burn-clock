/** The advisor's context layer: Burn Clock's findings, rules, validation and role-specific actions, built from the
 * site's own published files so every number in it is traceable (and allowed by the answer number check). */
import type {Loader} from './place';
import {receiptFacts} from '../insights';
import {ACTIONS} from '../roleActions';
import {ROLES} from '../insights';
import {VERDICT_LABEL} from '../verdict';

const r1=(x:number)=>Math.round(x*10)/10;
export async function buildBriefing(load:Loader,appUrl:string){
  const site=appUrl.replace(/\/$/,'');
  const [receipt,validation,byYear,cases,aqua]=await Promise.all([load('punjab_receipt.json.gz'),load('validation.json.gz'),load('gk2a_hourly_by_year.json'),load('case_studies.json'),load('punjab_aqua_daily.json').catch(()=>null)]);
  const f=receiptFacts(receipt),hours:number[]=byYear.hours_ist,share=(v:number[],hs:number[])=>r1(100*v.reduce((s,x,i)=>s+(hs.includes(hours[i])?x:0),0)/v.reduce((s,x)=>s+x,0));
  const years=Object.keys(byYear.pixel_hours).sort();
  const loyo=validation.loyo??{};
  return {
    what_burn_clock_is:'Burn Clock joins NASA’s MODIS (Terra, Aqua) and VIIRS (S-NPP, NOAA-20, NOAA-21) fire records into one 2001–2025 series on the S-NPP VIIRS scale, and tells you for any place and season whether a fire trend can be trusted or is partly an artifact of when the satellites look.',
    why_timing_matters:{polar_satellites:'Each polar satellite sees a place only at fixed times of day. VIIRS satellites cross in the early afternoon (about 1:30–1:50 pm local).',drift:'Terra has drifted to pass about an hour earlier and Aqua about an hour later than in 2013–19.',consequence:'If burning moves to hours the satellites do not see, the satellite count falls even if burning does not.',snpp:'S-NPP has delivered no data since 2 November 2026; NOAA-20 and NOAA-21 continue.'},
    verdict_rules:{order:'First rule that applies wins.',timing:`${VERDICT_LABEL.timing}: Aqua (now passing later) catches relatively more fire than in 2013–19, beyond twice the normal swing (at least 0.15 on a log scale): burning has probably moved later.`,modis:`${VERDICT_LABEL.modis}: no later-burning signal, but Terra or Aqua moved away from VIIRS: a MODIS-only trend would mislead.`,clear:`${VERDICT_LABEL.clear}: both comparisons stay inside their normal 2013–19 swing.`,unknown:`${VERDICT_LABEL.unknown}: too few fires (under 200 VIIRS or 50 Terra/Aqua cell-days), a missing month, an incomplete baseline, or a year before 2021.`,caveat:'A diagnostic, not proof of cause and not a corrected fire count.'},
    punjab:{official_claim:{text:receipt.claim,count_2021:receipt.claim_source.value_2021,count_2025:receipt.claim_source.value_2025,decline_pct:r1(f.officialDecline),window:receipt.claim_source.window},
      gk2a_whole_afternoon_change_2021_to_2025_pct:-r1(f.afternoonDecline),gk2a_2025_vs_2019_ratio:Math.round(f.versus2019*100)/100,gk2a_5pm_2025_vs_2021_ratio:Math.round(f.at17*100)/100,
      share_of_noon_to_6pm_signal_at_4pm_or_later_pct:Object.fromEntries(years.map(y=>[y,share(byYear.pixel_hours[y],[16,17,18])])),
      share_at_1_to_2pm_when_satellites_pass_pct:Object.fromEntries(years.map(y=>[y,share(byYear.pixel_hours[y],[13,14])])),
      aqua_median_crossing_hour_ist_november:aqua?.aqua_median_pass_ist_november??null,
      gk2a_source:'Korean geostationary GK2A hourly fire data for Punjab state (Jethva 2026, Zenodo 20084790): ~4 km pixels, can flag hot smoke, misses small fires, noon–6 pm images only.',
      first_reported_by:'The later-burning shift was first reported by NASA (Jethva 2026), ISRO’s Space Applications Centre and iFOREST; Burn Clock makes the check available everywhere and turns it into actions.'},
    validation:{global_held_out_median_annual_error_pct:loyo.global?.median_annual_err_pct,punjab_held_out_median_annual_error_pct:loyo.punjab?.median_annual_err_pct,parana_held_out_median_annual_error_pct:loyo.parana?.median_annual_err_pct,note:'Errors from leave-one-year-out tests on 2013–19. Paraná (Argentina) is the weakest region; conversion factors do not carry well between continents.'},
    case_studies:cases.cases.map((c:any)=>({place:c.title,season:c.season,years:`${c.a} vs ${c.b}`,verdict:c.verdict_label,finding:c.sentence,lesson:c.lesson,link:site+'/'+c.link})),
    roles:ROLES,
    actions_by_verdict_and_role:ACTIONS,
    pages:{check_a_place:site+'/#home',punjab_action_planner:site+'/#act',case_studies:site+'/#cases',punjab_evidence:site+'/#receipt',monitoring_brief:site+'/#brief',methods:site+'/#methods',data_and_api:site+'/#api'},
    tools_on_the_site:['A verdict and role-specific actions for any place (draw a box or search)','A one-page brief for your role (download or copy)','Punjab planner: field-check window per district, busiest two weeks, calendar file, field card image, WhatsApp plan, use-my-location','Count gap for forecasters with a 90% range; hourly profile CSV','Say / Don’t say wording for reporters','A live check of this week’s NASA data for any place','A JSON API (/api/check, /api/punjab)'],
    limits:['Counts are satellite observations (daytime active 0.05° cell-days or detections), not individual fires, burned area or emissions.','The verdict is a diagnostic, not proof of why burning changed (it cannot attribute changes to enforcement, weather or crop choices).','Hourly evidence exists only for Punjab; elsewhere only polar-satellite timing checks are available.','Near-real-time data are provisional.'],
  };
}
