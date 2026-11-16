import {useEffect,useState} from 'react';
import {fetchData,number} from '../data';
import {Evidence} from './Provenance';
import type {AreaResult} from '../types';
import type {Polys} from '../shape'
import {liveTiming,MONTHS,type LiveCells,type LiveStatus} from '../liveCheck';


const LABEL:Record<LiveStatus,string>={signal:'Yes, likely, this week',within:'No sign this week',below:'No, Aqua sees less',unknown:'Can’t tell this week'};
const day=(iso:string)=>new Date(iso+'T12:00:00Z').toLocaleDateString('en-GB',{day:'numeric',month:'short',timeZone:'UTC'});
const solar=(h:number|null|undefined)=>h==null?'the afternoon':`${Math.floor(h)>12?Math.floor(h)-12:Math.floor(h)}:${String(Math.round((h%1)*60/5)*5%60).padStart(2,'0')} pm local solar time`;

/** The same "has burning moved later?" question, asked of this week's NASA near-real-time data for this exact area. */
export default function LiveTimingCheck({area,polys}:{area:AreaResult,polys?:Polys|null}){
  const [doc,setDoc]=useState<LiveCells|null>(null),[error,setError]=useState(false);
  useEffect(()=>{fetchData<LiveCells>('live/week_cells.json').then(setDoc).catch(()=>setError(true));},[]);
  if(error)return null;
  if(!doc)return <p className="loading-state" role="status">Loading this week’s NASA detections…</p>;
  const r=liveTiming(doc,area.box,area.months,polys),month=MONTHS[r.month-1],w=doc.window;
  const text=r.status==='unknown'?r.reason:r.status==='signal'?`Aqua, now passing at about ${solar(doc.median_daytime_local_solar_hour.A)}, recorded ${number(r.ratio,2)} active cells for every NOAA-20 cell here this week. In ${month} 2013–19 the normal range was ${number(r.low,2)}–${number(r.high,2)}. Burning is probably happening later in the day right now.`:r.status==='within'?`Aqua recorded ${number(r.ratio,2)} active cells per NOAA-20 cell this week, inside the ${month} 2013–19 range of ${number(r.low,2)}–${number(r.high,2)}. No sign that burning has moved later this week.`:`Aqua recorded ${number(r.ratio,2)} active cells per NOAA-20 cell this week, below the ${month} 2013–19 range of ${number(r.low,2)}–${number(r.high,2)}. That is what Aqua’s later pass would see if burning still peaks earlier in the day: no sign of a shift later.`;
  return <section className={'live-check live-'+r.status} aria-labelledby="live-check-title" data-testid="live-check" data-source="live/week_cells.json.gz; tiles/*.json → raw.A, raw.N, raw.J1">
    <p className="verdict-eyebrow">Live · NASA data, {w.first_date?day(w.first_date):''}–{w.last_date?day(w.last_date):''} {w.last_date?.slice(0,4)}</p>
    <h3 id="live-check-title">Is burning happening later than usual this week?</h3>
    <strong className="live-answer" data-testid="live-answer">{LABEL[r.status]}</strong>
    <p data-testid="live-text">{text}</p>
    <details><summary>How this live check works</summary><p>The same check as the verdict, run on NASA FIRMS’ public seven-day files instead of the archive. It compares Aqua (drifting later every year) with NOAA-20 (fixed, early afternoon) in this area: {number(r.aqua)} Aqua and {number(r.noaa20)} NOAA-20 daytime active cell-days{r.ratio!=null?<>, ratio <Evidence value={number(r.ratio,3)} expression={`Aqua ÷ (NOAA-20 × ${number(r.bridge,3)})`} source="live/week_cells.json.gz" producer="scripts/fetch_live_cells.py · src/liveCheck.ts"/></>:null}. NOAA-20 is put on the S-NPP scale with this area’s own 2019–24 {month} overlap (×{number(r.bridge,3)}). The baseline is Aqua ÷ S-NPP for {month} 2013–19 in the archive; a change beyond twice its normal swing (at least 0.15 on a log scale) counts. Needs at least 100 NOAA-20 and 30 Aqua cell-days. One week is short and near-real-time data are provisional, so treat this as an early signal, not a verdict. Fetched {doc.generated_utc.slice(0,16).replace('T',' ')} UTC by <code>{doc.script}</code>.</p></details>
  </section>;
}
