import {describe, expect, it} from 'vitest';
import {readFileSync} from 'node:fs';
import {gunzipSync} from 'node:zlib';
import {hourlyShares, timelineTime} from './timeline';
const receipt = JSON.parse(gunzipSync(readFileSync('public/data/punjab_receipt.json.gz')).toString());
describe('observed afternoon shares', () => {
  it('reproduces the supplied Punjab counts without mixing years or unique pixel-days', () => {
    const current = hourlyShares(receipt, 2025)!;
    expect(current.total).toBe(19392);
    expect(current.peakHour).toBe(17);
    expect(current.points[5].share).toBeCloseTo(11858 / 19392 * 100, 10);
    expect(current.lateShare).toBeCloseTo(18654 / 19392 * 100, 10);
    const baseline = hourlyShares(receipt, 2021)!;
    expect(baseline.total).toBe(39361);
    expect(baseline.peakHour).toBe(16);
    expect(baseline.lateShare).toBeCloseTo(20435 / 39361 * 100, 10);
    expect(current.points.reduce((sum, p) => sum + p.share, 0)).toBeCloseTo(100, 10);
  });
  it('does not invent a 2019 distribution from maps or another year', () => {
    expect(hourlyShares(receipt, 2019)).toBeNull();
    expect(hourlyShares(undefined, 2025)).toBeNull();
  });
  it('rejects missing hours, invalid counts, and a zero denominator', () => {
    for (const values of [[1, 2], [0, 0, 0, 0, 0, 0, 0], [1, 2, null, 4, 5, 6, 7], [1, 2, -1, 4, 5, 6, 7]]) {
      expect(hourlyShares({gk2a_by_hour: {hours: [12, 13, 14, 15, 16, 17, 18], pixel_hours_2025: values}}, 2025)).toBeNull();
    }
    expect(hourlyShares({gk2a_by_hour: {hours: [11, 13, 14, 15, 16, 17, 18], pixel_hours_2025: [1, 2, 3, 4, 5, 6, 7]}}, 2025)).toBeNull();
  });
});
describe('local timeline labels', () => {
  it('handles noon, midnight, minute rounding, and unavailable medians', () => {
    expect(timelineTime(12)).toBe('12 pm');
    expect(timelineTime(0)).toBe('12 am');
    expect(timelineTime(23.9999)).toBe('12 am');
    expect(timelineTime(10.1)).toBe('10:06 am');
    expect(timelineTime(null)).toBe('Unavailable');
    expect(timelineTime(NaN)).toBe('Unavailable');
  });
});
