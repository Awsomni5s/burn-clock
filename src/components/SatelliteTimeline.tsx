import {useId, useEffect, useRef, useState} from 'react';
import {Evidence, useEvidence} from './Provenance';
import Reproduce from './Reproduce';
import {areaZone, civilHour, zoneLabel} from '../civilTime';
import {lookChangeMinutes, number, signed} from '../data';
import {hourlyShares, timelineTime} from '../timeline';
import {useURLState, choice} from '../urlState';
import {PLATFORMS, PLATFORM_NAMES, PLATFORM_COLORS, GK2A_COLOR, type ClockYear, type BBox} from '../types';

type Props = {clock?: ClockYear; year: number; box: BBox; name: string; receipt?: Record<string, any>};
export default function SatelliteTimeline({clock, year, box, name, receipt}: Props) {
  const id = useId().replaceAll(':', ''), openSource = useEvidence();
  const container = useRef<HTMLDivElement>(null), [chartWidth, setChartWidth] = useState(1060);
  useEffect(() => {
    if (!container.current) return;
    const observer = new ResizeObserver(([entry]) => setChartWidth(entry.contentRect.width < 850 ? Math.max(260, entry.contentRect.width - 10) : 1060));
    observer.observe(container.current);
    return () => observer.disconnect();
  }, []);
  const compact = chartWidth < 850;
  const [comparison, setComparison] = useURLState('timelineCompare', 'previous', choice(['previous', 'none'] as const));
  const referenceDate = `${year}-11-15`, zone = areaZone(box), local = zoneLabel(zone);
  const current = hourlyShares(receipt, year), otherYear = year === 2021 ? 2025 : 2021;
  const previous = current && comparison !== 'none' ? hourlyShares(receipt, otherYear) : null;
  const passes = PLATFORMS.flatMap(platform => {
    const raw = clock?.look[platform];
    if (raw == null || !Number.isFinite(raw)) return [];
    const baseline = clock?.baselineLook[platform] ?? null;
    return [{platform, current: civilHour(raw, box, referenceDate, zone)!,
      baseline: civilHour(baseline, box, referenceDate, zone),
      shift: baseline == null ? null : lookChangeMinutes(raw, baseline)}];
  });
  const extrema = passes.flatMap(p => [p.current, ...(p.baseline == null ? [] : [p.baseline])]);
  const start = Math.min(6, Math.floor(Math.min(6, ...extrema) / 2) * 2);
  const end = Math.max(20, Math.ceil(Math.max(20, ...extrema) / 2) * 2);
  const left = compact ? 40 : 215, right = chartWidth - (compact ? 25 : 50);
  const x = (hour: number) => left + (hour - start) / (end - start) * (right - left);
  const laneStep = compact ? 52 : 39, laneEnd = Math.max(1, passes.length) * laneStep + 28, chartTop = laneEnd + 48;
  const bottom = current ? chartTop + 205 : laneEnd + 35, height = bottom + 58;
  const maxShare = Math.max(25, ...(current?.points.map(p => p.share) ?? []), ...(previous?.points.map(p => p.share) ?? []));
  const ceiling = Math.ceil(maxShare / 25) * 25;
  const y = (share: number) => bottom - share / ceiling * 190;
  const barWidth = (x(13) - x(12)) * .64;
  const passExpression = `look; baselineLook = available 2013–19 observations; area median; civilHour; reference=${referenceDate}; zone=${zone}`;
  const hourlyExpression = `gk2a_by_hour.pixel_hours_${year}; share = hourly pixel-hours / sum(noon–6 pm pixel-hours) × 100`;
  const chartSource = () => openSource({value: `${name} · ${year} · ${local}`, expression: passExpression + (current ? '; ' + hourlyExpression : ''),
    source: 'clock/*.json → look' + (current ? `; punjab_receipt.json → gk2a_by_hour.pixel_hours_${year}${previous ? `, pixel_hours_${otherYear}` : ''}` : ''),
    producer: 'pipeline/build_public.py; src/data.ts; src/civilTime.ts' + (current ? '; pipeline/analysis/punjab_receipt.py; src/timeline.ts' : ''),
    link: '/reproduce/pipeline/build_public.py.html#L159'});
  return <section className="satellite-timeline" aria-labelledby={id + '-title'} data-testid="satellite-timeline">
    <h2 id={id + '-title'}>{current ? <>Burning peaks around <Evidence value={timelineTime(current.peakHour)} expression={`gk2a_by_hour.pixel_hours_${year}; hour of maximum`} source="punjab_receipt.json → gk2a_by_hour" producer="src/timeline.ts"/> in the Punjab hourly record.</> : 'When the satellites look here'}</h2>
    {current ? <p>In October–November {year}, <strong><Evidence value={number(current.lateShare, 1) + '%'} expression={`gk2a_by_hour.pixel_hours_${year}; sum(hours ≥16) / sum(hours 12–18) × 100`} source="punjab_receipt.json → gk2a_by_hour" producer="src/timeline.ts"/></strong> of afternoon fire pixel-hours came at 4 pm or later. The bars describe Punjab state; pass markers describe the selected {name} box.</p> : <p>{receipt ? `No usable hourly shares are supplied for ${year}. The Punjab receipt provides 2021 and 2025; choose either observation year to see those bars.` : 'Burn Clock has no hourly fire data matched to this area, so it cannot show when burning happens here.'} Use the timing checks to assess whether satellite timing changes the answer.</p>}
    <p className="timeline-scope">Pass times: {year} fire-season medians, approximate {local}. They do not change with the selected months. Open circles mark the available 2013–19 baseline.</p>
    <div className="timeline-toolbar">
      <div className="timeline-key">{current && <><span><i style={{background: GK2A_COLOR}}/>{year} share of afternoon fire pixel-hours</span>{previous && <span><i className="timeline-key-outline"/>{otherYear} share</span>}</>}<span>│ Current satellite pass · ○ → baseline to current</span></div>
      {current && <fieldset className="timeline-toggle"><legend>Compare hourly shares with</legend><button aria-pressed={comparison === 'previous'} onClick={() => setComparison('previous')}>{otherYear}</button><button disabled aria-describedby={id + '-missing'}>2019</button><button aria-pressed={comparison === 'none'} onClick={() => setComparison('none')}>None</button></fieldset>}
    </div>
    {current && <p className="timeline-note" id={id + '-missing'}>2019 hourly totals were not supplied. Contour maps alone do not provide these shares.</p>}
    {!passes.length && <p role="status">{clock ? `No daytime pass-time medians are available for this area in ${year}.` : `No pass-time record is available yet for this area in ${year}.`}</p>}
    <div ref={container} className="timeline-scroll" role="region" aria-label="Satellite and burning timeline">
      <svg viewBox={`0 0 ${chartWidth} ${height}`} className="timeline-chart" role="button" tabIndex={0} aria-label={`${name}, ${year}. Satellite passes in ${local}${current ? '; Punjab state hourly shares from noon to 6 pm India time' : '; hourly fire activity unavailable'}. Open chart sources.`} onClick={chartSource} onKeyDown={e => {if (e.key === 'Enter' || e.key === ' ') {e.preventDefault(); chartSource();}}}>
        <defs>{passes.map(p => <marker key={p.platform} id={id + '-arrow-' + p.platform} viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto"><path d="M0 0 L10 5 L0 10 Z" fill={PLATFORM_COLORS[p.platform]}/></marker>)}</defs>
        {current && <>
          <rect x={x(11.5)} y={chartTop - 28} width={x(18.5) - x(11.5)} height={bottom - chartTop + 28} fill="#f6f6f4"/>
          <text x={compact ? chartWidth - 10 : x(18.5) - 8} y={chartTop - 10} textAnchor="end" fontSize="13">{compact ? 'GK2A: noon–6 pm only' : 'GK2A observations: noon–6 pm only'}</text>
          {Array.from({length: ceiling / 25 + 1}, (_, i) => i * 25).map(v => <g key={v}><line x1={x(11.5)} x2={x(18.5)} y1={y(v)} y2={y(v)} stroke="#d5d5d2"/><text x={x(11.5) - 9} y={y(v) + 4} textAnchor="end" fontSize="12">{v}%</text></g>)}
          {current.points.map(p => <g key={p.hour} data-hour={p.hour} data-share={p.share} data-value={p.value}>
            <rect x={x(p.hour) - barWidth / 2} y={y(p.share)} width={barWidth} height={bottom - y(p.share)} fill={GK2A_COLOR}><title>{timelineTime(p.hour)}: {number(p.share, 1)}% of {year} afternoon fire pixel-hours</title></rect>
            {(!compact || p.share >= 10) && <text x={x(p.hour)} y={y(Math.max(p.share, previous?.points.find(q => q.hour === p.hour)?.share ?? 0)) - 8} textAnchor="middle" fontSize={compact ? '12' : '13'} fontWeight="700">{compact ? number(p.share, 0) : number(p.share, 1)}%</text>}
          </g>)}
          {previous?.points.map(p => <rect key={p.hour} data-compare-hour={p.hour} data-share={p.share} x={x(p.hour) - barWidth / 2} y={y(p.share)} width={barWidth} height={bottom - y(p.share)} fill="none" stroke="#0b0c0c" strokeWidth="1.5" strokeDasharray="4 3"><title>{otherYear}, {timelineTime(p.hour)}: {number(p.share, 1)}%</title></rect>)}
        </>}
        {passes.map((p, i) => {const lane = (compact ? 48 : 28) + i * laneStep;return <g key={p.platform} data-platform={p.platform} data-current={p.current} data-baseline={p.baseline ?? ''}>
          <text x="12" y={compact ? lane - 15 : lane + 5} fontSize={compact ? '13' : '14'} fontWeight="700">{PLATFORM_NAMES[p.platform]} · {timelineTime(p.current)}</text>
          <line x1={x(p.current)} x2={x(p.current)} y1={compact ? laneEnd : lane} y2={bottom} stroke={PLATFORM_COLORS[p.platform]} strokeWidth="1.6" strokeDasharray="3 4" opacity=".65"/>
          <line x1={x(p.current)} x2={x(p.current)} y1={lane - 9} y2={lane + 9} stroke={PLATFORM_COLORS[p.platform]} strokeWidth="3"/>
          {p.baseline != null && <><line x1={x(p.baseline)} x2={x(p.current)} y1={lane} y2={lane} stroke={PLATFORM_COLORS[p.platform]} strokeWidth="2" markerEnd={Math.abs(x(p.baseline) - x(p.current)) > 8 ? `url(#${id}-arrow-${p.platform})` : undefined}/><circle cx={x(p.baseline)} cy={lane} r="4" fill="white" stroke={PLATFORM_COLORS[p.platform]} strokeWidth="2"/><text x={compact ? chartWidth - 12 : Math.min(900, Math.max(x(p.current), x(p.baseline)) + 12)} y={compact ? lane - 15 : lane + 5} textAnchor={compact ? 'end' : 'start'} fontSize={compact ? '12' : '13'}>was {timelineTime(p.baseline)}</text></>}
        </g>;})}
        <line x1={x(start)} x2={x(end)} y1={bottom} y2={bottom} stroke="#0b0c0c"/>
        {Array.from({length: Math.floor((end - start) / (compact ? 4 : 2)) + 1}, (_, i) => start + i * (compact ? 4 : 2)).map(h => <g key={h}><line x1={x(h)} x2={x(h)} y1={bottom} y2={bottom + 6} stroke="#0b0c0c"/><text x={x(h)} y={bottom + 25} textAnchor="middle" fontSize={compact ? '12' : '14'}>{timelineTime(h)}</text></g>)}
        <text x={x(start)} y={bottom + 48} fontSize="13">{local}</text>
      </svg>
    </div>
    <p className="timeline-note timeline-mobile-hint">Read every hourly value and its source below.</p>
    <details className="timeline-values"><summary>Read values and their sources</summary>
      <div className="table-scroll" role="region" aria-label="Satellite pass-time values" tabIndex={0}><table><thead><tr><th>Satellite</th><th>{year} pass</th><th>2013–19 baseline</th><th>Change</th></tr></thead><tbody>{PLATFORMS.map(platform => {const p = passes.find(p => p.platform === platform);return <tr key={platform} className="timeline-pass-row" data-available={!!p}><th><i className="timeline-satellite-dot" style={{background: PLATFORM_COLORS[platform]}}/>{PLATFORM_NAMES[platform]}</th><td><Evidence value={timelineTime(p?.current ?? null)} expression={`look.${platform}; ${passExpression}`} source="clock/*.json → look" producer="src/civilTime.ts"/></td><td><Evidence value={timelineTime(p?.baseline ?? null)} expression={`baselineLook.${platform}; ${passExpression}`} source="clock/*.json → look" producer="src/civilTime.ts"/></td><td><Evidence value={p?.shift == null ? 'Unavailable' : signed(p.shift, 0) + ' min'} expression={`lookChangeMinutes(look.${platform}, baselineLook.${platform})`} source="clock/*.json → look" producer="src/data.ts"/></td></tr>;})}</tbody></table></div>
      {current && <div className="table-scroll" role="region" aria-label="Punjab hourly shares" tabIndex={0}><table><thead><tr><th>India time</th><th>{year} pixel-hours</th><th>{year} share</th>{previous && <th>{otherYear} share</th>}</tr></thead><tbody>{current.points.map(p => <tr key={p.hour}><th>{timelineTime(p.hour)}</th><td><Evidence value={number(p.value)} expression={`gk2a_by_hour.pixel_hours_${year}[hours=${p.hour}]`} source="punjab_receipt.json → gk2a_by_hour" producer="pipeline/analysis/punjab_receipt.py"/></td><td><Evidence value={number(p.share, 1) + '%'} expression={`${hourlyExpression}; hour=${p.hour}`} source="punjab_receipt.json → gk2a_by_hour" producer="src/timeline.ts"/></td>{previous && <td><Evidence value={number(previous.points.find(q => q.hour === p.hour)?.share ?? null, 1) + '%'} expression={`gk2a_by_hour.pixel_hours_${otherYear}; hourly / total × 100; hour=${p.hour}`} source="punjab_receipt.json → gk2a_by_hour" producer="src/timeline.ts"/></td>}</tr>)}</tbody></table></div>}
    </details>
    <p className="timeline-note">Pass times are medians of available 1° cell medians, conditioned on daytime fire detections; they are not orbit predictions. Civil-time conversion uses the box midpoint and {referenceDate} time-zone rules, including for the baseline. A box can span time zones; satellites can have missing baseline observations.</p>
    {current && <p className="timeline-note">Fire timing: GK2A, Punjab state, October–November, noon–6 pm India time only, confidence ≥2. Shares describe fire pixel-hours, not unique fires or total smoke. The preliminary product can include hot smoke; outages cannot be separated from cloud. Nothing outside the observed afternoon window is inferred. <Reproduce id="punjabHourly"/></p>}
    <Reproduce id="passTimes"/>
  </section>;
}
