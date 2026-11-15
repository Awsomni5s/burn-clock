/** Hour shares use one supplied year and the full observed noon–6 pm window. */
export function hourlyShares(receipt: Record<string, any> | undefined, year: number) {
  const hours = receipt?.gk2a_by_hour?.hours;
  const values = receipt?.gk2a_by_hour?.[`pixel_hours_${year}`];
  if (!Array.isArray(hours) || !Array.isArray(values) || hours.length !== 7 || hours.length !== values.length) return null;
  if (!hours.every((h, i) => h === 12 + i) ||
      !values.every(v => Number.isFinite(v) && v >= 0)) return null;
  const total = values.reduce((sum, value) => sum + value, 0);
  if (!(total > 0)) return null;
  const points = hours.map((hour: number, i: number) => ({hour, value: values[i] as number, share: values[i] / total * 100}));
  return {year, total, points, peakHour: hours[values.indexOf(Math.max(...values))] as number,
    lateShare: points.filter(p => p.hour >= 16).reduce((sum, p) => sum + p.value, 0) / total * 100};
}

export function timelineTime(value: number | null) {
  if (value == null || !Number.isFinite(value)) return 'Unavailable';
  const minutes = ((Math.round(value * 60) % 1440) + 1440) % 1440;
  const h = Math.floor(minutes / 60), m = minutes % 60;
  return `${h % 12 || 12}${m ? ':' + String(m).padStart(2, '0') : ''} ${h >= 12 ? 'pm' : 'am'}`;
}
