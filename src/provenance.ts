/** Exact supplied producers. A source link does not imply that all upstream inputs shipped. */
export interface ProvenanceEntry {label:string;file:string;line:number;source:string;note?:string}
export const PROVENANCE = {
  archiveTotals:{label:'Archive totals',file:'pipeline/build_public.py',line:278,source:'manifest.json → totals'},
  calendarRaw:{label:'Monthly satellite record',file:'pipeline/build_public.py',line:110,source:'tiles/<tile>.json → raw',note:'Historical raw values are active cell-days, not distinct fire events.'},
  calendarHarmonized:{label:'Merged monthly record',file:'pipeline/harmonize/produce.py',line:135,source:'tiles/<tile>.json → harm, harm_lo, harm_hi, src'},
  areaAggregation:{label:'Selected-area totals',file:'src/data.ts',line:28,source:'tiles/<tile>.json; selection by cell center; missingness preserved'},
  timingCheck:{label:'Annual timing check',file:'src/data.ts',line:71,source:'clock/<tile>.json → day; 2013–19 baseline; 2021 onward'},
  passTimes:{label:'Satellite pass times',file:'pipeline/build_public.py',line:159,source:'clock/<tile>.json → look',note:'The browser takes the median of available cell-level medians. These are detection-conditioned times.'},
  officialDecline:{label:'Official reported count',file:'pipeline/analysis/punjab_receipt.py',line:158,source:'punjab_receipt.json → claim_source',note:'Reported external counts from CAQM/CREAMS; mixed satellites, 15 September–30 November. Percentage = 100 × (1 − 2025/2021).'},
  punjabBySatellite:{label:'Punjab by satellite',file:'pipeline/analysis/punjab_receipt.py',line:49,source:'punjab_receipt.json → by_clock',note:'Daytime active cell-days; shared calendar-day outage mask within each platform comparison.'},
  punjabHourly:{label:'Punjab hourly observations',file:'pipeline/analysis/punjab_receipt.py',line:69,source:'punjab_receipt.json → gk2a_by_hour',note:'2025/2021 hourly ratio; late share sums 16–18 and divides by 12–18 IST. Confidence ≥2, unmasked; observations are not unique fires.'},
  punjabAfternoon:{label:'Punjab afternoon observations',file:'pipeline/analysis/punjab_receipt.py',line:80,source:'punjab_receipt.json → gk2a_unique_pixel_days',note:'Unique detected pixel-days, 12–18 IST; percentage change derived from integer counts.'},
  punjabBaseline:{label:'Punjab base-year comparison',file:'pipeline/analysis/punjab_receipt.py',line:92,source:'punjab_receipt.json → base_year_fan',note:'Masked and unmasked variants differ. Do not combine a masked ratio with an unmasked label.'},
  validationHeldOut:{label:'Held-out validation',file:'pipeline/harmonize/assemble.py',line:37,source:'validation.json → loyo, test, config_hash'},
  validationModels:{label:'Model comparison',file:'pipeline/harmonize/assemble.py',line:78,source:'validation.json → models'},
  validationSeam:{label:'Sensor transition',file:'pipeline/harmonize/validate.py',line:368,source:'validation.json → changepoint.seam_2012'},
  validationDenial:{label:'Satellite denial',file:'pipeline/harmonize/validate.py',line:264,source:'validation.json → denial'},
  validationTransfer:{label:'Regional transfer failures',file:'pipeline/harmonize/validate.py',line:289,source:'validation.json → loro'},
  validationBenchmarks:{label:'Reported comparison',file:'pipeline/harmonize/assemble.py',line:108,source:'validation.json → benchmarks',note:'Different units and evaluation designs. FireClock values are reported, not independently reproduced.'},
  validationClock:{label:'Day/night checks',file:'pipeline/harmonize/assemble.py',line:121,source:'validation.json → clock_checks',note:'Assembly copies external global-atlas outputs; those upstream generator/input dependencies are not all in this bundle.'},
  sameDayPairs:{label:'Same-day satellite pairs',file:'pipeline/analysis/viirs_pairs.py',line:54,source:'validation.json → same_day_pairs',note:'This script fits and writes analysis/out/viirs_pairs.json. The supplied validation file embeds that analysis; its final merge step is not present in assemble.py.'},
  worldComparison:{label:'World and continent comparisons',file:'pipeline/analysis/world.py',line:80,source:'world/continents.json',note:'Depends on external global-atlas inputs named in this script; the supplied bundle is not a complete raw-input rebuild.'},
  liveSnapshot:{label:'Provisional seven-day snapshot',file:'scripts/fetch_live.mjs',line:39,source:'live/latest.json',note:'Current detections are separate from the historical merged archive.'},
  claimStats:{label:'Claim Checker comparison',file:'src/stats.ts',line:57,source:'tiles/<tile>.json → raw, harm, harm_lo, harm_hi; selected months and years'},
  trendStats:{label:'Longer-term trend',file:'src/stats.ts',line:97,source:'tiles/<tile>.json → harm, harm_lo, harm_hi',note:'Theil–Sen slope as a percentage of median annual activity. Endpoint-series slopes are a sensitivity range, not a confidence interval.'},
  clockIllustration:{label:'Shifted-hour illustration',file:'src/stats.ts',line:137,source:'punjab_receipt.json → gk2a_by_hour.pixel_hours_2021',note:'Linear interpolation with activity outside the observed window set to zero. Illustration, not a forecast or detector model.'},
} satisfies Record<string,ProvenanceEntry>;
export type ProvenanceKey = keyof typeof PROVENANCE;
export const reproduceURL=(p:ProvenanceEntry)=>`/reproduce/${p.file}.html#L${p.line}`;
