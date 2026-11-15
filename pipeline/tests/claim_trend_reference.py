#!/usr/bin/env python3
"""Independent reference for addendum §6a, §6b and §6d.

Run: python3 pipeline/tests/claim_trend_reference.py
Reads the supplied gzip tiles, not a JS-produced fixture. Calendar/clock loading is
the existing independent Python implementation; claim/trend/slider arithmetic is
implemented here using Python's statistics and math libraries.
"""
from __future__ import annotations

import json
import math
import statistics
import sys
from pathlib import Path

APP = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(APP / 'scripts'))
import numeric_reference as source


def total(values):
    values = list(values)
    if not values or any(not source.present(v) or v < 0 for v in values):
        return None
    return round(math.fsum(values), 2)


def rows_for(area, months, year):
    lookup = {r['month']: r for r in area['months']}
    return [lookup.get(f'{year}-{m:02}') for m in sorted(set(months))]


def aggregate(rows):
    return {field: total(row[field] if row else None for row in rows)
            for field in ('harm', 'lo', 'hi')}


def claim(area, months, first_year, last_year, manifest):
    months = sorted(set(months))
    first_rows, last_rows = (rows_for(area, months, year) for year in (first_year, last_year))
    first, last = aggregate(first_rows), aggregate(last_rows)
    platforms = []
    for platform in source.PLATFORMS:
        a = total(row['raw'][platform] if row else None for row in first_rows)
        b = total(row['raw'][platform] if row else None for row in last_rows)
        status = 'missing_months' if a is None or b is None else 'too_few' if min(a, b) < 50 else 'ok'
        ratio = b / a if status == 'ok' else None
        platforms.append({'platform': platform, 'status': status, 'sumA': a, 'sumB': b,
                          'ratio': ratio, 'changePct': (ratio - 1) * 100 if ratio is not None else None})
    missing = any(v is None for row in (first, last) for v in row.values())
    invalid_bounds = any(row and row['lo'] is not None and row['hi'] is not None and row['lo'] > row['hi'] for row in first_rows + last_rows)
    status = ('missing_months' if missing else 'invalid_bounds' if invalid_bounds
              else 'zero_baseline' if min(first.values()) <= 0 else 'ok')
    ratio = last['harm'] / first['harm'] if status == 'ok' else None
    bounds = [last['lo'] / first['hi'], last['hi'] / first['lo']] if status == 'ok' else None
    keys = {f'{y}-{m:02}' for y in (first_year, last_year) for m in months}
    converted = sum('M' in row['src'] for row in area['months'] if row['month'] in keys)
    timing = next((c for c in area['clock'] if c['year'] == last_year), None)
    return {'months': months, 'a': first_year, 'b': last_year, 'platforms': platforms,
            'harmonized': {'status': status, 'sumA': first['harm'], 'sumB': last['harm'],
                           'loA': first['lo'], 'hiA': first['hi'], 'loB': last['lo'], 'hiB': last['hi'],
                           'ratio': ratio, 'range': bounds,
                           'changePct': (ratio - 1) * 100 if ratio is not None else None,
                           'rangePct': [(v - 1) * 100 for v in bounds] if bounds else None},
            'convertedMonths': converted, 'convertedShare': converted / len(keys),
            'selectedMonthCount': len(keys),
            'timingStatus': 'before_2021' if last_year < 2021 else 'available' if timing else 'missing',
            'timing': timing if last_year >= 2021 else None,
            'outages': [o for o in manifest['outage_months'] if o['month'] in keys]}


def slope(points):
    return statistics.median((b[1] - a[1]) / (b[0] - a[0])
                             for i, a in enumerate(points) for b in points[i + 1:])


def trend(area, months, start=2012, end=2025):
    years, excluded, modis = [], [], []
    for year in range(start, end + 1):
        rows = rows_for(area, months, year)
        annual = aggregate(rows)
        if any(v is None for v in annual.values()) or any(r and r['lo'] > r['hi'] for r in rows):
            excluded.append(year)
            continue
        years.append({'year': year, **annual})
        raw = total(r['raw'][p] for r in rows for p in ('T', 'A'))
        if raw is not None:
            modis.append((year, raw))
    middle = statistics.median(y['harm'] for y in years) if years else None
    central_slope = slope([(y['year'], y['harm']) for y in years]) if len(years) >= 2 else None
    status = 'too_few_years' if len(years) < 2 else 'zero_median' if middle <= 0 else 'ok'
    pct = central_slope / middle * 100 if status == 'ok' else None
    bounds = sorted(slope([(y['year'], y[field]) for y in years]) / middle * 100 for field in ('lo', 'hi')) if status == 'ok' else None
    verdict = ('unavailable' if status != 'ok' else 'no_clear_trend' if bounds[0] <= 0 <= bounds[1]
               else 'rising' if pct > 0 else 'falling' if pct < 0 else 'no_clear_trend')
    modis_slope = slope(modis) if status == 'ok' and len(modis) == len(years) else None
    return {'status': status, 'months': sorted(set(months)), 'start': start, 'end': end,
            'years': years, 'excludedYears': excluded, 'median': middle, 'slope': central_slope,
            'pctPerYear': pct, 'rangePct': bounds, 'verdict': verdict, 'modisSlope': modis_slope,
            'modisOpposite': modis_slope is not None and modis_slope * central_slope < 0}


def interpolate(hours, counts, hour):
    if hour < hours[0] or hour > hours[-1]:
        return 0
    for i, observed_hour in enumerate(hours):
        if observed_hour == hour:
            return counts[i]
        if observed_hour > hour:
            return counts[i - 1] + (counts[i] - counts[i - 1]) * (hour - hours[i - 1]) / (hours[i] - hours[i - 1])


def main():
    manifest, catalog = source.read_json('manifest.json.gz'), source.read_json('catalog.json')
    result = {'presets': {}, 'curve': [], 'edges': {}}
    for preset in source.presets():
        area = {**source.calendar_reference(preset['box'], manifest),
                'clock': source.clock_reference(preset['box'], catalog)}
        cases = [([10, 11], 2021, 2025), ([10, 11], 2011, 2012), ([11], 2021, 2024)]
        if preset['id'] == 'california':
            cases.append(([8, 9], 2019, 2024))
        trends = [([10, 11], 2012, 2025), ([10, 11], 2003, 2025)]
        if preset['id'] == 'california':
            trends.append(([8, 9], 2012, 2025))
        result['presets'][preset['id']] = {
            'claims': [claim(area, months, a, b, manifest) for months, a, b in cases],
            'trends': [trend(area, months, start, end) for months, start, end in trends]}
        print(f"{preset['id']}: {len(cases)} claim cases, {len(trends)} trend cases")
    for name, box in {
        'empty': [0, -140, .25, -139.75],
        'single_cell': [30.25, 75.5, 30.5, 75.75],
        'equator': [-.25, 20, .25, 20.5],
        'antimeridian': [-20, 178, -16, -178],
    }.items():
        area = {**source.calendar_reference(box, manifest), 'clock': source.clock_reference(box, catalog) if any(source.tile_intersects(n, box) for n in catalog['clock_tiles']) else []}
        result['edges'][name] = {'box': box, 'cellCount': area['cellCount'],
                                'claim': claim(area, [10, 11], 2021, 2025, manifest),
                                'earlyMonth': area['months'][0]}
        print(f"{name}: {area['cellCount']} archived cells")
    receipt = source.read_json('punjab_receipt.json.gz')
    hours, counts = (receipt['gk2a_by_hour'][key] for key in ('hours', 'pixel_hours_2021'))
    hour = next(row['ist_hour_2021'] for row in receipt['by_clock'] if row['platform'] == 'N')
    baseline = interpolate(hours, counts, hour)
    for shift in (0, .2, .5, 1, 1.5, 2, 2.5, 3):
        result['curve'].append({'shift': shift, 'hour': hour,
                                'curve': [interpolate(hours, counts, h - shift) for h in hours],
                                'ratio': interpolate(hours, counts, hour - shift) / baseline})
    result['provenance'] = {
        'generator': 'pipeline/tests/claim_trend_reference.py',
        'sourceSha256': dict(sorted(source.SOURCE_HASHES.items())),
        'claims': 'Complete selected months only; raw >=50 in both years; independent bound ratios.',
        'trends': 'All pairwise slopes; complete selected years only; both bound slopes / median central H.',
        'tolerance': {'relative': 1e-10, 'absolute': 1e-8}}
    output = APP / 'scripts' / 'stats_expected.json'
    output.write_text(json.dumps(result, indent=2, allow_nan=False) + '\n')
    print(f'Wrote {output}: {output.stat().st_size:,} bytes')


if __name__ == '__main__':
    main()
