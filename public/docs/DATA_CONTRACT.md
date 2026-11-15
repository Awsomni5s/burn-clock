# Burn Clock: data contract (Claude pipeline → Codex app)
Version 1, 2026-11-14.

The app is static. Everything below lives under `public/data/` and is read with `fetch()`. Codex builds the UI against this contract and may use mock files with the same shape until the real ones land.

All numbers come from `pipeline/` scripts. The UI must never compute a number that is not defined here, and must never hard-code one.

## Conventions
- **Platforms.** Short and display names:

  | Short | Display name | Period |
  |---|---|---|
  | `T` | Terra MODIS | 2000-11 → |
  | `A` | Aqua MODIS | 2002-07 → |
  | `N` | S-NPP VIIRS | 2012-01 → 2026-11-02 |
  | `J1` | NOAA-20 VIIRS | 2018 → |
  | `J2` | NOAA-21 VIIRS | 2023/24 →, if available |

- **Unit.** The unit is the **active cell-day**: a 0.05° cell with ≥1 detection (FIRMS type 0, all confidences) on a local-solar day, counted per platform and **daytime only**. Night is shown on the clock screens only.
- **Grid.** Calendar cells are **0.25°**, keyed by their SW corner (`lat`, `lon` as multiples of 0.25). Clock cells are **1°**.
- **Time.** Months are `YYYY-MM`. Local solar time = UTC + lon/15. Look times are decimal hours of local solar time.
- **Missing data.** Missing is `null` (outage-masked or platform not yet flying). It is never 0.

## Files
### 1. `manifest.json`
```json
{ "version": "1", "generated_utc": "...", "pipeline_commit": "...",
  "months": ["2000-11", "...", "2025-12"],
  "platforms": {"T": {"first": "2000-11", "last": "2025-12"}, "...": {}},
  "totals": {"detections_processed": 0, "by_platform": {"T": 0, "A": 0, "N": 0, "J1": 0, "J2": 0},
             "type0_detections": 0, "active_cell_days": 0},
  "tiles": ["p25_p070", "..."],
  "sources": [{"name": "...", "url": "...", "sha256": "...", "bytes": 0, "rows": 0}],
  "outage_months": [{"platform": "N", "month": "2024-11", "missing_days": ["2024-11-03", "..."]}] }
```

### 2. `tiles/<tile>.json`: the calendar
- A **5°×5° tile** is named by its SW corner: `p25_p070` means lat +25, lon +070; `m10_m055` means lat −10, lon −55.
- Data is columnar. Each array has one row per cell and one column per month in `manifest.months`.
- `harm_lo` / `harm_hi` are the year-block bootstrap 90% interval.
- `src` codes: `"V"` = VIIRS observed (mean of the available VIIRS platforms on the S-NPP scale); `"M"` = MODIS converted with pre-drift factors; `"X"` = no data.
- Only cells with ≥1 detection ever are included.

```json
{ "tile": "p25_p070",
  "cells": [[30.25, 75.50], "..."],
  "raw": { "T": [[0, 3, null, "..."], "..."], "A": [], "N": [], "J1": [], "J2": [] },
  "harm": [[1.2, 5.0, "..."], "..."],
  "harm_lo": [], "harm_hi": [],
  "src": ["VVVVMMMX...", "..."] }
```

**AOI behaviour in the browser.**
- Sum the cells inside the drawn box per month.
- `harm` sums directly.
- For the interval, sum `harm_lo` and sum `harm_hi`. This is conservative; label it "approximate (cells assumed fully correlated)".
- Anomaly: compare against the 2003–2022 median of the AOI's harmonized monthly series for the same calendar month. Bands: above p75 / within p25–p75 / below p25.

### 3. `clock/<tile>.json`: the satellite clock, 1° cells inside the same 5° tile
```json
{ "tile": "p25_p070",
  "cells": [[30, 75], "..."],
  "years": [2013, "...", 2025],
  "season_months": [[10, 11, 5], "..."],
  "look": { "T": [[10.8, "...", 9.6], "..."], "A": [], "N": [], "J1": [] },
  "day":   { "T": [[n2013, "...", n2025], "..."], "A": [], "N": [], "J1": [] },
  "night": { "T": [], "A": [], "N": [], "J1": [] } }
```
- `season_months`: the cell's top-3 months by VIIRS (2013–19), held fixed.
- `look`: median daytime look time, fire season.
- `day` / `night`: fire-season cell-day counts per year.

**AOI badge, computed in the browser by this rule (written in Methods):**
- Sum `day` counts over the AOI's 1° cells.
- For year y ≥ 2021: ρ_P(y) = ln(P_day / N_day) for P ∈ {T, A}. Baseline = mean over 2013–2019. Δρ_P = ρ_P(y) − baseline.
- Noise σ_P = the standard deviation of ρ_P over 2013–2019.
- Badge:
  - Test **each platform separately**. Platform P is *testable* in year y if N_day(y) ≥ 200 and P_day(y) ≥ 50.
  - `not_identifiable` if no platform is testable.
  - `clock_sensitive` if any testable P has |Δρ_P| > max(2σ_P, 0.15).
  - Otherwise `robust`.
  - Name the platform(s) that drove the verdict (e.g. "Aqua +0.72; Terra too few to test").
- Show the signed bend of a naive MODIS (T+A) record: bend = (T+A)/N ÷ baseline((T+A)/N) − 1, as a %.
- Show the look-time change per platform vs 2013–19.

### 4. `world/`
- `world/clock_map_2025.png`, `world/terra_night_2025.png`, `world/aqua_2025.png`: figures with a legend.
- `world/countries.json`: `[{"country": "China", "iso3": "CHN", "bend_TA_pct": -38.9, "bend_A_pct": -28.3, "bend_T_pct": -55.0, "cells": 83}, ...]`
- `world/continents.json`: the same fields plus `artifact_2019_2025_pct`, with its interval in flat `lo` / `hi` keys.
- **Units of the world files:** nominal/high-confidence **detections** on 1° cells (from the atlas), not cell-days. Say so on the map screen.

### 5. `punjab_receipt.json`
```json
{ "claim": "Punjab farm fires fell 93% (2021→2025)",
  "claim_source": {"value_2021": 71304, "value_2025": 5114, "url": "..."},
  "by_clock": [{"label": "Terra MODIS", "ist_hour": 10.0, "ratio": 0.011, "unit": "day cell-days"}, "..."],
  "gk2a_by_hour": {"hours": [12, "...", 18], "ratio_2025_2021": [0.22, "..."], "conf_min": 2},
  "gk2a_unique_pixel_days": {"2019": 7527, "...": 0},
  "base_year_fan": [{"base": 2019, "gk2a": 2.14, "snpp": 0.0}, "..."],
  "verdict": "clock_sensitive",
  "assumptions": ["..."],
  "sources": ["..."] }
```

### 6. `validation.json`
```json
{ "loyo": {"global": {"median_annual_err_pct": 0, "r2_log_monthly": 0}, "punjab": {}, "parana": {}},
  "loro": {"by_region": [{"region": "...", "median_annual_err_pct": 0}]},
  "denial": [{"hidden": "A", "reconstructed_from": "T+N", "median_err_pct": 0}],
  "changepoint": {"seam_2012": {"raw_jump": 0, "harm_jump": 0}, "drift_2020_22": {}},
  "models": [{"name": "ratio_bridge_pre_drift", "score": {}}, {"name": "gbm", "score": {}}],
  "chosen_model": "...",
  "locked_test_years": [2016, 2019], "config_hash": "...",
  "same_day_pairs": {"by_region": [{"region": "...", "pct_change_per_hour": 0, "ci90": [0, 0]}]},
  "clock_checks": {"terra_day_night_opposite_share": 0.84, "opposite_sign_by_afternoon_tercile": [0.40, 0.52, 0.58]} }
```

## Presets (AOI boxes: south, west, north, east)
| Preset | Box |
|---|---|
| Punjab + Haryana (India) | 27.6, 73.8, 32.6, 77.6 |
| Paraná Delta (Argentina) | −34.5, −60.8, −32.0, −58.3 |
| Cerrado / MATOPIBA (Brazil) | −13, −50, −5, −42 |
| Central African savanna (CAR / S. Sudan) | 5, 18, 10, 30 |
| Kalimantan (Indonesia) | −3.5, 110, 1, 117 |
| California (USA) | 34, −124, 42, −117 |
