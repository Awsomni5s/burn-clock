#!/usr/bin/env python3
"""Rebuild browser QA reference values directly from the supplied gzip data.

This is an independent Python implementation of the documented calculations.
It neither imports nor evaluates the application functions. Preset definitions
are read from types.ts to avoid maintaining a second list of user-facing boxes.
Use tolerances for floating-point comparisons: Python math.fsum is intentionally
more stable than the browser's tile-arrival-order accumulation.

Run from anywhere: python3 scripts/numeric_reference.py
"""
from __future__ import annotations

import calendar
import gzip
import hashlib
import json
import math
import re
import statistics
from pathlib import Path

APP = Path(__file__).resolve().parents[1]
DATA = APP / 'public' / 'data'
OUTPUT = APP / 'scripts' / 'numeric_expected.json'
PLATFORMS = ('T', 'A', 'N', 'J1', 'J2')
BASELINE = tuple(range(2013, 2020))
YEARS = tuple(range(2013, 2026))
SOURCE_HASHES: dict[str, str] = {}


def read_json(relative: str):
    path = DATA / relative
    content = path.read_bytes()
    SOURCE_HASHES[relative] = hashlib.sha256(content).hexdigest()
    if relative.endswith('.gz'):
        content = gzip.decompress(content)
    return json.loads(content)


def presets():
    source = (APP / 'src' / 'types.ts').read_text()
    pattern = r"\{id:'([^']+)',name:'([^']+)',country:'([^']+)',box:(\[[^\]]+\])\}"
    found = [{'id': p, 'name': name, 'country': country, 'box': json.loads(box)}
             for p, name, country, box in re.findall(pattern, source)]
    if len(found) != 6:
        raise ValueError('Expected six presets in types.ts; inspect schema changes.')
    return found


def in_box(lat, lon, box):
    south, west, north, east = box
    longitude_match = west <= lon < east if west <= east else lon >= west or lon < east
    return south <= lat < north and longitude_match


def tile_intersects(name, box):
    encoded_lat, encoded_lon = name.split('_')
    lat = int(encoded_lat[1:]) * (-1 if encoded_lat[0] == 'm' else 1)
    lon = int(encoded_lon[1:]) * (-1 if encoded_lon[0] == 'm' else 1)
    south, west, north, east = box
    longitude_match = lon < east and lon + 5 > west if west <= east else lon + 5 > west or lon < east
    return lat < north and lat + 5 > south and longitude_match


def present(value):
    return isinstance(value, (int, float)) and math.isfinite(value)


def complete_sum(values):
    values = list(values)
    return math.fsum(values) if values and all(present(v) for v in values) else None


def percentile(values, fraction):
    ordered = sorted(v for v in values if present(v))
    if not ordered:
        return None
    position = (len(ordered) - 1) * fraction
    lower = math.floor(position)
    upper = math.ceil(position)
    return ordered[lower] + (ordered[upper] - ordered[lower]) * (position - lower)


def calendar_reference(box, manifest):
    selected = []
    tile_names = [name for name in manifest['tiles'] if tile_intersects(name, box)]
    for name in tile_names:
        tile = read_json(f'tiles/{name}.json.gz')
        for cell_index, (lat, lon) in enumerate(tile['cells']):
            if in_box(lat + .125, lon + .125, box):
                selected.append({
                    'raw': {p: tile['raw'].get(p, [])[cell_index]
                            if cell_index < len(tile['raw'].get(p, [])) else None
                            for p in PLATFORMS},
                    'harm': tile['harm'][cell_index],
                    'lo': tile['harm_lo'][cell_index],
                    'hi': tile['harm_hi'][cell_index],
                    'src': tile['src'][cell_index],
                })
    rows = []
    outages = {(entry['platform'], entry['month']): entry['missing_days']
               for entry in manifest['outage_months']}
    for index, month in enumerate(manifest['months']):
        raw = {p: complete_sum(cell['raw'][p][index] if cell['raw'][p] is not None else None
                               for cell in selected) for p in PLATFORMS}
        all_bounds_present = bool(selected) and all(present(cell[field][index])
                                                    for field in ('harm', 'lo', 'hi')
                                                    for cell in selected)
        derived = {field: complete_sum(cell[field][index] for cell in selected)
                   if all_bounds_present else None for field in ('harm', 'lo', 'hi')}
        source = ''.join(sorted({cell['src'][index] for cell in selected})) if selected else 'X'
        available = []
        for platform in PLATFORMS:
            period = manifest['platforms'].get(platform)
            if period is None or not period['first'] <= month <= period['last']:
                continue
            year, month_number = map(int, month.split('-'))
            days = calendar.monthrange(year, month_number)[1]
            if (days - len(outages.get((platform, month), []))) / days >= .5:
                available.append(platform)
        family = ('N', 'J1', 'J2') if source == 'V' else ('T', 'A') if source == 'M' else ()
        rows.append({'month': month, 'raw': raw, **derived, 'src': source,
                     'satellites': [p for p in available if p in family]})
    baseline_by_month = {m: [row['harm'] for row in rows
                            if '2003-01' <= row['month'] <= '2022-12'
                            and row['month'][5:] == m and present(row['harm'])]
                         for m in {row['month'][5:] for row in rows}}
    for row in rows:
        base = baseline_by_month[row['month'][5:]]
        row.update(median=percentile(base, .5), p25=percentile(base, .25), p75=percentile(base, .75))
        row['anomaly'] = ('missing' if row['harm'] is None or row['p25'] is None or row['p75'] is None
                          else 'above' if row['harm'] > row['p75']
                          else 'below' if row['harm'] < row['p25'] else 'normal')
    return {'cellCount': len(selected), 'tileCount': len(tile_names), 'months': rows}


def clock_reference(box, catalog):
    selected = []
    for name in catalog['clock_tiles']:
        if not tile_intersects(name, box):
            continue
        tile = read_json(f'clock/{name}.json.gz')
        for cell_index, (lat, lon) in enumerate(tile['cells']):
            if not in_box(lat + .5, lon + .5, box):
                continue
            cell = {}
            for field in ('day', 'look'):
                cell[field] = {platform: dict(zip(tile['years'], series[cell_index]))
                               for platform, series in tile[field].items()}
            selected.append(cell)

    def value(cell, field, platform, year):
        return cell[field].get(platform, {}).get(year)

    def supports(platforms, target):
        years = set(BASELINE + (target,))
        return [cell for cell in selected if all(present(value(cell, 'day', platform, year))
                                                 for year in years for platform in platforms)]

    def count(cells, platform, year):
        return math.fsum(value(cell, 'day', platform, year) for cell in cells)

    results = []
    for year in YEARS:
        tests = []
        for platform in ('T', 'A'):
            cells = supports((platform, 'N'), year)
            platform_count = count(cells, platform, year)
            reference_count = count(cells, 'N', year)
            historical_logs = []
            for base_year in BASELINE:
                numerator = count(cells, platform, base_year)
                denominator = count(cells, 'N', base_year)
                if numerator > 0 and denominator > 0:
                    historical_logs.append(math.log(numerator / denominator))
            mean = statistics.mean(historical_logs) if historical_logs else None
            sigma = statistics.pstdev(historical_logs) if len(historical_logs) == 7 else None
            delta = math.log(platform_count / reference_count) - mean if platform_count > 0 and reference_count > 0 and mean is not None else None
            threshold = max(2 * sigma, .15) if sigma is not None else None
            testable = reference_count >= 200 and platform_count >= 50 and threshold is not None and delta is not None
            if not cells:
                reason = 'No complete paired clock series'
            elif reference_count < 200:
                reason = 'Fewer than 200 S-NPP cell-days'
            elif platform_count < 50:
                reason = f"Fewer than 50 {'Terra' if platform == 'T' else 'Aqua'} cell-days"
            elif len(historical_logs) < 7:
                reason = 'Incomplete pre-drift baseline'
            else:
                reason = 'Enough observations'
            tests.append({'platform': platform, 'testable': testable, 'delta': delta,
                          'sigma': sigma, 'threshold': threshold,
                          'count': platform_count if cells else None,
                          'reference': reference_count if cells else None,
                          'cells': len(cells), 'reason': reason})
        drivers = [test['platform'] for test in tests
                   if test['testable'] and abs(test['delta']) > test['threshold']]
        common = supports(('T', 'A', 'N'), year)
        ratios = {}
        for y in set(BASELINE + (year,)):
            denominator = count(common, 'N', y)
            ratios[y] = ((count(common, 'T', y) + count(common, 'A', y)) / denominator
                         if denominator > 0 else None)
        base = statistics.mean(ratios[y] for y in BASELINE) if all(ratios[y] is not None for y in BASELINE) else None
        bend = (ratios[year] / base - 1) * 100 if ratios[year] is not None and base is not None and base > 0 else None
        badge = ('not_evaluated' if year < 2021
                 else 'not_identifiable' if not any(test['testable'] for test in tests)
                 else 'clock_sensitive' if drivers else 'robust')
        look = {p: percentile([value(cell, 'look', p, year) for cell in selected], .5)
                for p in PLATFORMS}
        baseline_look = {p: percentile([value(cell, 'look', p, y) for cell in selected for y in BASELINE], .5)
                         for p in PLATFORMS}
        results.append({'year': year, 'badge': badge, 'drivers': drivers, 'bend': bend,
                        'tests': tests, 'look': look, 'baselineLook': baseline_look,
                        'clockCells': len(selected)})
    return results


def receipt_reference():
    receipt = read_json('punjab_receipt.json.gz')
    claim = receipt['claim_source']
    hourly = receipt['gk2a_by_hour']
    hours = hourly['hours']
    counts_2021 = hourly['pixel_hours_2021']
    counts_2025 = hourly['pixel_hours_2025']
    ratios = [new / old for old, new in zip(counts_2021, counts_2025)]
    # Supplied hourly ratios are rounded to three decimal places.
    assert all(round(ratio, 3) == published for ratio, published in zip(ratios, hourly['ratio_2025_2021']))
    unique = receipt['gk2a_unique_pixel_days']
    late = {str(year): 100 * sum(count for hour, count in zip(hours, counts) if hour >= 16) / sum(counts)
            for year, counts in [(2021, counts_2021), (2025, counts_2025)]}
    official_decline = 100 * (1 - claim['value_2025'] / claim['value_2021'])
    at_17 = ratios[hours.index(17)]
    unique_ratio = unique['2025'] / unique['2021']
    versus_2019 = unique['2025'] / unique['2019']
    assert round(official_decline) == 93
    assert round(at_17, 1) == 1.4
    assert round(late['2021']) == 52 and round(late['2025']) == 96
    assert max(unique, key=unique.get) == '2021'
    return {
        'official': {'value2021': claim['value_2021'], 'value2025': claim['value_2025'],
                     'declinePct': official_decline, 'window': claim['window']},
        'hourly': [{'hourIST': h, 'pixelHours2021': old, 'pixelHours2025': new, 'ratio': ratio}
                   for h, old, new, ratio in zip(hours, counts_2021, counts_2025, ratios)],
        'at17Ratio': at_17,
        'lateSharePct': late,
        'uniquePixelDays': unique,
        'unique2025Over2021': unique_ratio,
        'uniqueDecline2021To2025Pct': 100 * (1 - unique_ratio),
        'unique2025Over2019': versus_2019,
        'peakYear': int(max(unique, key=unique.get)),
        'window': 'Punjab, Oct-Nov, 12-18 IST; GK2A conf>=2; unmasked',
        'roundingChecksPassed': True,
    }


def main():
    manifest = read_json('manifest.json.gz')
    catalog = read_json('catalog.json')
    output = {'presets': {}}
    for preset in presets():
        box = preset['box']
        result = {'box': box, **calendar_reference(box, manifest), 'clock': clock_reference(box, catalog)}
        assert len(result['months']) == 302 and len(result['clock']) == 13
        output['presets'][preset['id']] = result
        print(f"{preset['id']}: {result['cellCount']} cells, {len(result['months'])} months, {len(result['clock'])} clock years")
    output['punjabReceipt'] = receipt_reference()
    output['provenance'] = {
        'generator': 'scripts/numeric_reference.py',
        'runtime': 'Python standard library; no application computation imported',
        'floatingPointComparison': {'relativeTolerance': 1e-10, 'absoluteTolerance': 1e-8},
        'selection': 'SW cell coordinates + 0.125 degrees for calendar / +0.5 for clock; lower edges inclusive, upper edges exclusive',
        'calendarNulls': 'Any missing cell makes that platform aggregate missing; harm and its two bounds share completeness',
        'clockSupport': 'Common complete paired cells for 2013-2019 and target; population SD; bend uses common T+A+N support',
        'sourceSha256': dict(sorted(SOURCE_HASHES.items())),
    }
    OUTPUT.write_text(json.dumps(output, indent=2, allow_nan=False) + '\n')
    print(f'Wrote {OUTPUT} ({OUTPUT.stat().st_size:,} bytes)')
    print(json.dumps(output['punjabReceipt'], indent=2))


if __name__ == '__main__':
    main()
