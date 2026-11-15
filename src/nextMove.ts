/** "Your next move": the calendar, the trend check and this week's live check turned into what to do, by job. Pure helpers. */
import type {Role} from './insights';
import type {Verdict} from './verdict';
import type {LiveStatus} from './liveCheck';

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
