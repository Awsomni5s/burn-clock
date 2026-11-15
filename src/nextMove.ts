/** "Your next move": the calendar, the trend check and this week's live check turned into what to do, by job. Pure helpers. */
import type {Role} from './insights';
import type {Verdict} from './verdict';
import type {Verdict as V} from './verdict';
import type {LiveStatus,AmountStatus} from './liveCheck';

export const MONTH_NAMES=['January','February','March','April','May','June','July','August','September','October','November','December'];
const SHORT=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

/** Critical months (1–12) → contiguous runs, joining December to January. */
export function seasonRuns(months:number[]):number[][]{
  const s=[...new Set(months)].filter(m=>m>=1&&m<=12).sort((a,b)=>a-b);if(!s.length)return [];
  const runs:number[][]=[];for(const m of s){const r=runs.at(-1);if(r&&r.at(-1)===m-1)r.push(m);else runs.push([m]);}
  if(runs.length>1&&runs[0][0]===1&&runs.at(-1)!.at(-1)===12){const last=runs.pop()!;runs[0]=[...last,...runs[0]];}
  return runs;
}
export const runLabel=(r:number[])=>r.length>1?`${SHORT[r[0]-1]}–${SHORT[r.at(-1)!-1]}`:SHORT[r[0]-1];

/** Next start (or the current run) for each season run, from `today`. */
export function nextSeasons(months:number[],today:Date){
  const y=today.getUTCFullYear(),m=today.getUTCMonth()+1;
  return seasonRuns(months).map(r=>{
    const first=r[0],last=r.at(-1)!,wraps=last<first;
    const inRun=r.includes(m);
    let startYear=y;if(inRun){if(wraps&&m<=last)startYear=y-1;}else if(first<m)startYear=y+1;
    const endYear=wraps?startYear+1:startYear;
    const start=new Date(Date.UTC(startYear,first-1,1)),end=new Date(Date.UTC(endYear,last,1));
    return {label:runLabel(r),start,end,now:inRun,daysToStart:Math.round((start.getTime()-today.getTime())/864e5)};
  }).sort((a,b)=>a.start.getTime()-b.start.getTime());
}

const ymd=(d:Date)=>d.toISOString().slice(0,10).replace(/-/g,'');
const esc=(s:string)=>s.replace(/\\/g,'\\\\').replace(/;/g,'\\;').replace(/,/g,'\\,').replace(/\n/g,'\\n');
const fold=(line:string)=>{const out:string[]=[];let s=line;while(s.length>74){out.push(s.slice(0,74));s=' '+s.slice(74);}out.push(s);return out.join('\r\n');};
/** An iCalendar file with the burning season(s) for the next two years and a reminder two weeks before each. */
export function seasonICS({name,months,share,link,today}:{name:string;months:number[];share:number|null;link:string;today:Date}){
  const runs=nextSeasons(months,today),uid=(s:string)=>`${s}-${name.replace(/[^A-Za-z0-9]+/g,'-').toLowerCase()}@burn-clock`;
  const lines=['BEGIN:VCALENDAR','VERSION:2.0','PRODID:-//Burn Clock//Burning season//EN','CALSCALE:GREGORIAN','METHOD:PUBLISH'];
  for(const r of runs)for(const shift of [0,1]){
    const s=new Date(Date.UTC(r.start.getUTCFullYear()+shift,r.start.getUTCMonth(),1)),e=new Date(Date.UTC(r.end.getUTCFullYear()+shift,r.end.getUTCMonth(),1));
    lines.push('BEGIN:VEVENT',`UID:${uid(ymd(s))}`,`DTSTAMP:${ymd(today)}T000000Z`,`DTSTART;VALUE=DATE:${ymd(s)}`,`DTEND;VALUE=DATE:${ymd(e)}`,
      fold(`SUMMARY:${esc(`Burning season: ${name} (${r.label})`)}`),
      fold(`DESCRIPTION:${esc(`${share!=null?`${Math.round(share)}% of a typical year's satellite-detected burning (2003–2022) falls in ${r.label}. `:''}Check this week's live NASA data and whether the trend can be trusted: ${link}`)}`),
      fold(`URL:${link}`),'TRANSP:TRANSPARENT','BEGIN:VALARM','ACTION:DISPLAY',fold(`DESCRIPTION:${esc(`Burning season in ${name} starts in two weeks`)}`),'TRIGGER:-P14D','END:VALARM','END:VEVENT');
  }
  lines.push('END:VCALENDAR');return lines.join('\r\n')+'\r\n';
}

export const ROLE_CHIPS:Record<Role,string>={policy:'Enforcement & policy',air:'Smoke & air quality',journalist:'News & fact-checks',research:'Research'};

/** One concrete line per job for "when". */
export function whenAction(role:Role,label:string,share:number|null){
  const s=share!=null?`${Math.round(share)}% of a typical year’s burning`:'most of the burning';
  return {policy:`Schedule field checks, patrols and awareness drives for ${label}: that is when ${s} is recorded.`,
    air:`Weight fire emissions and smoke alerts to ${label}; ${s} falls in these months.`,
    journalist:`Compare ${label} with ${label} of other years. A calendar year or a different window hides the season.`,
    research:`Use ${label} as the season window (${s}) and say so with any trend.`}[role];
}
/** One concrete line per job for this week's live check. */
export function weekAction(role:Role,status:LiveStatus){
  if(status==='signal')return {policy:'Burning looks later than the satellites look this week: send checks after 3–4 pm, not only around the passes.',
    air:'Shift this week’s fire timing later in your smoke forecast; the ~1:30 pm counts under-sample it.',
    journalist:'If this week’s fire count is quoted as low, add that burning is happening later than the satellites look.',
    research:'Flag this week’s counts as timing-affected before comparing them with past years.'}[role];
  if(status==='within')return 'No timing shift this week, so this week’s counts compare with past years as usual.';
  if(status==='below')return 'Aqua sees less than usual this week: treat the week’s Aqua counts with care and use NOAA-20.';
  return 'Use the monthly calendar for now; the live check refreshes every six hours.';
}
export const VERDICT_TRUST:Record<Verdict,string>={timing:'Partly a timing effect',modis:'Real, but not in MODIS counts',clear:'Yes, within its range',unknown:'Can’t tell yet'};

export const AMOUNT_LABEL:Record<AmountStatus,string>={record:'Busiest for the time of year',above:'More than usual',below:'Less than usual',lowest:'Quietest for the time of year',quiet:'Little or no burning',unknown:'Can’t compare yet'};
export const AMOUNT_CLASS:Record<AmountStatus,string>={record:'timing',above:'timing',below:'clear',lowest:'clear',quiet:'unknown',unknown:'unknown'};
/** What to do this week: the amount compared with usual, read together with this week's timing check. */
export function thisWeekAction(role:Role,amount:AmountStatus,timing:LiveStatus){
  const later=timing==='signal';
  if(amount==='record'||amount==='above')return {policy:'More burning than a usual week right now: get field teams out this week, and keep them out into the late afternoon.',
    air:'Raise this week’s fire emissions above a typical week in your smoke forecast'+(later?', and move them later in the day.':'.'),
    journalist:'This week is busier than usual for the time of year. Say the NASA data is provisional (near real time).',
    research:'Log this week as an anomaly and re-check it when standard-quality data replaces the near-real-time files.'}[role];
  if(amount==='below'||amount==='lowest')return later?{policy:'The count is low, but burning has moved later than the satellites look. Don’t call it progress: check fields after 3–4 pm.',
    air:'Don’t cut emissions just because the count is low: burning moved later, past the ~1:30 pm passes.',
    journalist:'Don’t report “fewer fires” from this week’s count: burning moved later than the satellites look.',
    research:'This week’s low count is confounded by a timing shift; don’t read it as less burning.'}[role]
    :{policy:'Less burning than a usual week, and no timing shift: a fair sign of fewer fires. Confirm on the ground before you report it.',
    air:'Lower fire emissions than a typical week are justified this week.',
    journalist:'Fewer detections than usual, with no timing shift: you can say less burning was detected (provisional).',
    research:'A low week without a timing shift; keep it, flagged as provisional.'}[role];
  return weekAction(role,timing);
}

/* ===== Plain-language layer: one headline and one command per card, by job ===== */
export const JOBS:Record<Role,{label:string;who:string;icon:string}>={
  policy:{label:'District officer',who:'a district officer or enforcement team',icon:'🚜'},
  air:{label:'Air-quality forecaster',who:'an air-quality forecaster',icon:'🌫️'},
  journalist:{label:'Journalist',who:'a journalist or fact-checker',icon:'📰'},
  research:{label:'Researcher',who:'a researcher',icon:'📊'}};
export function whenPlain(role:Role,label:string,peak:string|null){
  return {policy:`Have field teams ready for ${label}${peak?`; busiest around ${peak}`:''}.`,
    air:`Expect most fire smoke in ${label}: raise fire emissions in your forecasts then.`,
    journalist:`Compare ${label} with ${label} in past years, never whole years.`,
    research:`Use ${label} as the fire-season window and say so.`}[role];
}
export const TREND_HEADLINE:Record<V,string>={timing:'Don’t trust the drop',modis:'Real, but skip old MODIS counts',clear:'Yes, the trend is real',unknown:'Not enough data to tell'};
export function trendPlain(role:Role,v:V){
  const t:Record<V,Record<Role,string>>={
    timing:{policy:'Don’t count the drop as progress: fires now burn after the satellites pass. Check fields after 3–4 pm.',air:'Don’t cut fire emissions by the drop: burning moved later in the day.',journalist:'Don’t write “fires fell X%”. Write “detected fires fell, but burning moved later”.',research:'Treat changes since 2021 here as partly a timing effect.'},
    modis:{policy:'Judge change with this combined record, not old MODIS counts.',air:'Use VIIRS-based fire inputs from 2021 on.',journalist:'If someone quotes a MODIS trend since 2020, ask about satellite drift.',research:'Don’t use Terra/Aqua trends after 2020 without a drift correction.'},
    clear:{policy:'You can track progress with this record.',air:'Use the record as it is, with its range.',journalist:'You can report this change, with its range.',research:'Use the combined record with its range.'},
    unknown:{policy:'Don’t draw a conclusion yet.',air:'Don’t change inputs on this evidence.',journalist:'Don’t report a trend from this yet.',research:'Too little data here for a trend.'}};
  return t[v][role];
}
export function weekHeadline(a:AmountStatus,t:LiveStatus){
  if((a==='below'||a==='lowest')&&t==='signal')return 'Fewer fires seen, but they’re burning later';
  return {record:'Busiest week for the time of year',above:'Busier than a normal week',below:'Quieter than a normal week',lowest:'Quietest week for the time of year',quiet:'Little or no burning',unknown:'Can’t compare this week yet'}[a];
}
