import {Evidence} from './Provenance';
import {civilHour,areaZone,zoneLabel} from '../civilTime';
import {PRESETS,type BBox} from '../types';
import {PLATFORMS,PLATFORM_NAMES,PLATFORM_COLORS,type ClockYear} from '../types';
import {hour,signed,lookChangeMinutes} from '../data';
export default function ClockWheel({clock,compact=false,box=PRESETS[0].box}:{clock:ClockYear|undefined;compact?:boolean;box?:BBox}){
  const c=150,r=105,zone=areaZone(box),date=`${clock?.year??2025}-11-15`,civil=(v:number|null)=>civilHour(v,box,date,zone);
  const point=(h:number,radius:number)=>{const a=h/24*Math.PI*2-Math.PI/2;return [c+radius*Math.cos(a),c+radius*Math.sin(a)];};
  return <div className={compact?'clock-wheel compact':'clock-wheel'}>
    <svg viewBox="0 0 300 300" role="img" aria-label={`Satellite daytime look times in ${clock?.year??'selected year'}, ${zoneLabel(zone)}, approximate civil time`}>
      <circle cx={c} cy={c} r={r} fill="#faf8f4"/>
      <path d="M150 45 A105 105 0 0 0 150 255 Z" fill="#f0f2f5"/>
      <circle cx={c} cy={c} r={r} stroke="#e1e4e6" fill="none"/>
      <circle cx={c} cy={c} r="72" stroke="#e5e4e0" fill="none" strokeDasharray="2 5"/>
      {Array.from({length:48},(_,i)=>{const a=point(i/2,r-4),b=point(i/2,r-(i%2?8:13));return <line key={i} x1={a[0]} y1={a[1]} x2={b[0]} y2={b[1]} stroke="#b9bfc4" strokeWidth={i%6?1:1.7}/>;})}
      {[0,3,6,9,12,15,18,21].map(h=>{const p=point(h,r+19);return <text key={h} x={p[0]} y={p[1]+4} textAnchor="middle" fontSize="11" fill="#535e64" fontFamily="inherit">{String(h).padStart(2,'0')}</text>;})}
      {PLATFORMS.filter(p=>clock?.look[p]!=null).map((p,i)=>{const now=point(civil(clock!.look[p]!)!,r-20-i*6),base=clock?.baselineLook[p]!=null?point(civil(clock.baselineLook[p]!)!,r-20-i*6):null;return <g key={p}>
        {base&&<><line x1={c} y1={c} x2={base[0]} y2={base[1]} stroke={PLATFORM_COLORS[p]} opacity=".35" strokeWidth="1.4" strokeDasharray="4 3"/><circle cx={base[0]} cy={base[1]} r="3" fill="white" stroke={PLATFORM_COLORS[p]}/></>}
        <line x1={c} y1={c} x2={now[0]} y2={now[1]} stroke={PLATFORM_COLORS[p]} strokeWidth="2.1" strokeLinecap="round"/>
        <circle cx={now[0]} cy={now[1]} r="5.5" fill={PLATFORM_COLORS[p]} stroke="white" strokeWidth="2"/>
      </g>;})}
      <circle cx={c} cy={c} r="27" fill="white" stroke="#e6e7e9"/>
      <text x={c} y={c-1} textAnchor="middle" fontSize="13" fontWeight="650" fill="#343d45">{clock?.year??'—'}</text>
      <text x={c} y={c+12} textAnchor="middle" fontSize="7.5" letterSpacing="1" fill="#535e64">LOCAL TIME</text>
    </svg>
    <div className="clock-times">{PLATFORMS.filter(p=>clock?.look[p]!=null).map(p=><div className="clock-time" key={p}><span className="platform-dot" style={{background:PLATFORM_COLORS[p]}}/><span>{PLATFORM_NAMES[p]}</span><strong><Evidence value={hour(civil(clock!.look[p]))} expression={`look.${p}; area median, civilHour; ${date}; ${zone}`} source="clock/*.json" producer="src/civilTime.ts"/></strong>{!compact&&<small>{clock?.baselineLook[p]!=null?signed(lookChangeMinutes(clock.look[p]!,clock.baselineLook[p]!),0)+' min':'—'}</small>}</div>)}</div>
    {!compact&&<p className="fine-print">Approximate {zoneLabel(zone)}, using 15 November time-zone rules. Median of 1° cell medians. Dashed hands: 2013–19 baseline. Daytime observations only; not orbital predictions.</p>}
  </div>;
}
