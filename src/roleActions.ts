import type {Verdict} from './verdict';
import type {Role} from './insights';
/** What to do depends on BOTH the verdict and the user's job. */
export const GEO='an every-10–15-minute geostationary feed (INSAT-3D/3DR or GK2A over India, GOES over the Americas, Meteosat over Africa and Europe, Himawari over East Asia and Australia)';
export const ACTIONS:Record<Verdict,Record<Role,string[]>>={
 timing:{
  policy:['Watch the late afternoon: keep field checks going until at least 4 pm, not only around the satellite passes (about 10 am and 1:30 pm).',`Add ${GEO} to your fire alerts.`,'Don’t judge progress by the early-afternoon count alone. Report it next to the timing shift and burned area.'],
  air:['Move your fire timing later. Counts from the ~1:30 pm satellites now miss much of the burning.','Don’t scale emissions year on year with VIIRS counts here: the count fell more than the burning.','Re-check any fire climatology built before 2021; it predates the shift.'],
  journalist:['Don’t report the drop in the count as the drop in burning.','Say when the satellites look, and that burning has moved later.','Share the claim card: it carries the verdict and its caveats.'],
  research:['Treat post-2021 changes here as partly a timing effect.','Use the combined record or VIIRS, and report the timing check with any trend.','Add an hourly (geostationary) source where you can.']},
 modis:{
  policy:['Track change since 2020 with the combined record or VIIRS, not Terra or Aqua (MODIS) counts.','Burning hours look stable, so the satellite passes still sample the same part of the day.','Name the satellite and years next to any number you report.'],
  air:['Use VIIRS-based activity data for 2021 onward; MODIS-only inputs drift with the satellites’ pass times.','Your diurnal fire profile doesn’t need to change on this evidence.','Keep the uncertainty range with the inputs.'],
  journalist:['If a source quotes a MODIS-based trend since 2020, ask whether it allows for the satellites’ drift.','Quote the combined record with its range.','Share the claim card so the caveat travels with the number.'],
  research:['Don’t use Terra-only or Terra + Aqua trends after 2020 here without a drift correction.','Use the combined record (VIIRS scale) for 2003–2025.','Report which satellites and years sit under any trend.']},
 clear:{
  policy:['Satellite timing isn’t distorting this record, so you can use it to track change, with its range.','If the range includes no change, don’t claim progress or worsening from these two years.','Compare more years to see the trend.'],
  air:['Satellite timing isn’t biasing activity data here for these months.','Use the combined series with its range as an input.','Keep the regional validation limits in view.'],
  journalist:['The trend isn’t a satellite-timing artifact. Report it with the range.','If the range includes no change, write “no clear change”.','Name the satellite, place and years.'],
  research:['Use the combined record with its range.','Look at the whole series, not just two years.','Cite the validation results for this region.']},
 unknown:{
  policy:['There are too few fires to test satellite timing, so treat year-on-year changes as unverified.','Widen the area or add months to get a verdict.','Use local reports alongside satellite counts.'],
  air:['Timing can’t be tested here; treat satellite activity data as uncertain.','Widen the area or add months, then check again.','Prefer the combined record’s range over a single number.'],
  journalist:['Don’t headline a change here: Burn Clock can’t test it.','Widen the area or months to get a verdict.','If you publish, say the trend is unverified.'],
  research:['Too few fires for a timing verdict: widen the area or months.','Report the range, not the central value alone.','Treat this region as untested in any comparison.']}
};
