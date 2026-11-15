# Timeline mock implementation

The supplied `timeline_mock.html` replaces the circular satellite clock with a shared horizontal time axis. The chart appears in the place/claim report and the global timing page. It keeps Burn Clock's chosen logo/button palette and the established named satellite colors.

## Data and interpretation

- Pass markers use the selected area's `clock/*.json → look`: the median of available 1° cell medians. Hollow baseline markers use available 2013–19 observations. Each satellite is labelled separately; VIIRS is not assumed to have exactly unchanged detection times.
- Times use the box midpoint's IANA zone and 15 November of the chosen observation year. These are approximate annual fire-season summaries, independent of the selected monthly trend filter; they are not orbital predictions. The baseline is converted with the same reference-date offset.
- Punjab bars use `punjab_receipt.json → gk2a_by_hour.pixel_hours_2021` and `pixel_hours_2025`, divided by each year's own noon–6 pm total. The 2025 late share is 18,654 / 19,392 = 96.2% rounded; the 2021 share is 20,435 / 39,361 = 51.9% rounded.
- Hourly observations describe Punjab state in October–November, not the selected Punjab + Haryana box or arbitrary months. No distribution is inferred from contours, no 2019 bars are fabricated, and no hourly signal is shown for other regions. Unknown observation years show an explicit unavailable state.
- The 2021/2025 comparison toggle is stored in `timelineCompare` and respects reload, sharing and browser Back. The global observation-year slider controls the displayed year; place/claim reports use the comparison's end year.
- Mobile displays the complete afternoon in a compact layout. Large labels are rounded to whole percentages; the expandable source table retains one decimal for every hour. Chart and table values open provenance.

## Verification

The reproduction command now includes `scripts/timeline_browser_checks.mjs`. Existing independent numeric browser checks also verify the current and baseline pass-time labels for every available satellite across six presets and all clock years. Unit tests check original integer totals, missing/invalid hourly series, zero denominators and clock-label boundaries. The new browser checks cover hourly shares, unavailable comparisons, URL history, two non-India time zones, eight accessible responsive states, and keyboard provenance. Reports are recorded only after successful runs; human-study results remain pending.

## Reference file

- Filename: `timeline_mock.html`
- SHA-256: `ad7cbc77716fcac84065cac24c39ca3c3f4754f21cdd0a259f6aefaa38091d04`

The mock's illustrative pass times and non-Punjab placeholder geography were replaced with actual area values. No upstream data or scientific timing-check thresholds changed.
