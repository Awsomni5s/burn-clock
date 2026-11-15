import {useEffect,useState} from 'react';
import {Evidence} from './Provenance';
import {number} from '../data';
import {receiptFacts} from '../insights';
import {historyRatios,weekRatio,type AquaDailyDoc,type WeekDoc} from '../act';

/** The finding in four numbers, for the first screen. Every value is computed from shipped files. */
export default function HeroEvidence({data}:{data:Record<string,any>}){
  const f=receiptFacts(data),[late,setLate]=useState<{y0:string;v0:number;y1:string;v1:number}|null>(null),[live,setLive]=useState<{now:number;typical:number;first:string;last:string}|null>(null);
  useEffect(()=>{
    fetch('/data/gk2a_hourly_by_year.json').then(r=>r.ok?r.json():null).then(d=>{if(!d)return;const ys=Object.keys(d.pixel_hours).sort(),s=(v:number[])=>100*(v[4]+v[5]+v[6])/v.reduce((a,b)=>a+b,0);setLate({y0:ys[0],v0:s(d.pixel_hours[ys[0]]),y1:ys.at(-1)!,v1:s(d.pixel_hours[ys.at(-1)!])});}).catch(()=>{});
    Promise.all(['/data/punjab_week.json','/data/punjab_aqua_daily.json'].map(u=>fetch(u).then(r=>r.ok?r.json():null))).then((res:any[])=>{const [w,h]=res as [WeekDoc|null,AquaDailyDoc|null];if(!w||!h)return;const r=weekRatio(w);if(r.ratio==null||!r.days.length)return;const early=historyRatios(h,r.days.map(d=>d.slice(5))).filter(p=>p.year<=2021&&p.ratio!=null);setLive({now:r.ratio,typical:early.reduce((a,p)=>a+p.ratio!,0)/early.length,first:r.days[0],last:r.days.at(-1)!});}).catch(()=>{});
  },[]);
  const day=(iso:string)=>new Date(iso+'T12:00:00Z').toLocaleDateString('en-GB',{day:'numeric',month:'short',timeZone:'UTC'});
  return <section className="hero-evidence" aria-labelledby="hero-ev-title" data-testid="hero-evidence">
    <h2 id="hero-ev-title">Punjab shows why: the count fell far more than the burning</h2>
    <div className="hero-tiles">
      <div className="hero-tile"><b><Evidence value={number(f.officialDecline)+'%'} expression="1 − claim_source.value_2025 / value_2021" source="punjab_receipt.json" producer="pipeline/analysis/punjab_receipt.py"/></b><span>fall in Punjab’s official farm-fire count, 2021→2025</span></div>
      <div className="hero-tile"><b><Evidence value={number(f.afternoonDecline)+'%'} expression="1 − gk2a_unique_pixel_days.2025 / .2021" source="punjab_receipt.json" producer="pipeline/analysis/punjab_receipt.py"/></b><span>fall across the whole afternoon, watched hourly by a geostationary satellite (2021 was its busiest year)</span></div>
      {late&&<div className="hero-tile late"><b><Evidence value={number(late.v1)+'%'} expression={`share of noon–6 pm GK2A pixel-hours at 16–18 h, ${late.y1}`} source="gk2a_hourly_by_year.json" producer="pipeline/analysis/gk2a_hourly_by_year.py"/></b><span>of afternoon burning now after 4 pm, when the counting satellites have passed ({number(late.v0)}% in {late.y0})</span></div>}
      {live&&<div className="hero-tile live"><b><Evidence value={`${number(live.now,1)} vs ${number(live.typical,1)}`} expression="Aqua ÷ NOAA-20 detections this week vs same days 2013–2021" source="punjab_week.json; punjab_aqua_daily.json" producer="scripts/fetch_punjab_week.py · src/act.ts"/></b><span>live, {day(live.first)}–{day(live.last)}: fires seen by the ~4 pm satellite per fire seen at ~2 pm (normal before 2022)</span></div>}
    </div>
    <p className="hero-links"><a href="#receipt">See the hourly evidence</a> · <a href="#act">Plan by district</a> · <a href="#cases">Six places, four different answers</a> · <a href="#clock">Where burning is later this week, worldwide</a></p>
  </section>;
}
