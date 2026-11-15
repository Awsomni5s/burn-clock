# Burn Clock: harmonization and validation report

Generated 2026-11-14, about 23:10 UTC. Every number below comes from `pipeline/harmonize/` run on real FIRMS data. Nothing is hand-typed: the tables are printed by `report_tables.py` from `public/data/validation.json`. Failures are listed as failures.

- **Input:** `data/processed/q25_month.parquet` (sha256 `8a2512771ebb…`), 0.25° cells × month × platform × day/night.
- **Unit:** daytime active cell-days (cells with a detection on a given day).
- **Coverage:** 191,187 cells; T 2000–2025, A 2002–2025, N 2012–2025, J1 2018–2025.
- **NOAA-21 (J2):** absent from the input, so no J2 bridge was fitted.
- **Pre-registered method:** `harmonize/CONFIG.yaml`. config_hash `d0f62a55636f6def8856f4be39ec2b67bb79fd4fce96adf42234f297d98cec63` was locked at 21:54:54 UTC (`CONFIG.lock`), before any scoring.
- **Locked test years:** 2016 and 2019. Every training-stage load drops them. They were unlocked once, at the `final` stage, after τ, τ_b and the model choice had been written to `out/train_q25.json`.

## Headline
- **Shipped model: the transparent ratio bridge,** k = (V + τ·k_parent)/(M + τ). Shrinkage runs cell → 1° → 5° → global per month of year, with τ = 30 MODIS cell-days, fit on pre-drift 2013–2019 daytime data. The GBM did not clear the pre-registered bar: its primary metric was 10.55% against 8.83% for the bridge, and the bar was ≤ 0.9×.
- **LOYO (5 training years), median annual error:**
  - global 1.1% (R² log monthly 0.969);
  - continents 0.7–4.5%;
  - Punjab+Haryana 5.9% (R² 0.973);
  - Paraná Delta 21.3% (R² 0.55);
  - 5° tile-years 8.8%.
- **Locked 2016/2019, scored once:**
  - global 1.1% (R² 0.977);
  - Punjab 6.9% (both years over-predicted, +5.5% and +8.3%);
  - Paraná 17.0%;
  - 5° tile-years 8.6%.

  So the held-out years confirm the LOYO numbers.
- **2012 seam, global:** a naive MODIS→S-NPP splice jumps ×2.48. The harmonized series moves ×0.96, while MODIS alone moves ×0.97 over the same span. Punjab goes from ×3.16 raw to ×0.99.
- **Drift contamination:**
  - Fitting k on all overlap years (2013–2025) raises the global LOYO error on clean years from 1.1% to 3.1% (bias +3.5%).
  - It also inflates the whole MODIS-era (2003–2011) history by +2.6% globally and +4.6% in Africa.
- **FireClock comparison:** FireClock reports 7.3% / R² 0.983 for Punjab (REPORTED BY RIVAL; raw detections, regional k, LOYO over 2013–2020).
  - Our cell-day Punjab result is 5.9% / 0.973.
  - Our detections variant is 8.1% / 0.963 on LOYO and 5.0% / 0.950 on the locked years.
  - In short: comparable, not clearly better.

## Method as run (pre-registered; see CONFIG.yaml)
- **VIIRS scale = S-NPP.** NOAA-20 is bridged by r(5° tile × month of year) = (ΣN + τ_b·r_global)/(ΣJ1 + τ_b).
  - Fit years: 2018 and 2020–2025, with 2019 excluded as locked; this exclusion also holds in production, as pre-registered.
  - LOYO chose τ_b = 100. The global N/J1 ratio is 0.976–0.994 by month.
- **Harmonized value:**
  - `V`: the mean over usable VIIRS platforms of r_P·P/coverage.
  - `M`: k_combo·MODIS/coverage, using T+A, or T alone before 2002-07 or when Aqua is unusable.
  - `X`: no usable platform. Zero cell-months in output.
- **Coverage** comes from `outage_days.json` (missing-day fraction):
  - A month enters fits or scores only if T, A and N coverage are all ≥ 0.9.
  - A platform-month is usable in output at coverage ≥ 0.5 and is rescaled by 1/coverage.
  - Months excluded from scoring: 2016-02, 2022-07, 2022-08, 2022-10, 2024-07, 2024-11.
- **τ selection:** LOYO Poisson deviance over held-out cell-months with M > 0 chose τ = 30. The deviance curve is interior: 6.75M at 30, against 6.80M at 100 and 7.09M at 10.
- **Uncertainty:**
  - B = 200 year-block bootstrap over 2013–2019 refits k at the fixed τ. The bridge bootstrap is over its fit years.
  - The interval is the 5–95% of a negative binomial matched to mean = harm and var = harm + count²·Var_b(factor).
  - The median bootstrap CV of k_TA per cell-month is 0.108.
- **GBM competitor:**
  - Model: HistGradientBoosting on log1p(V), with features log1p T, log1p A, month, lat, lon and 5° mean k.
  - Training data: a dense cell × month grid, with all-zero rows subsampled at 0.25 and given weight 4. About 3.9M rows per fold, smearing factor 1.13.
  - Scored on the same LOYO folds and locked years as the bridge.

## Results
### LOYO, ratio bridge (pre-drift)
| Region | Median abs annual err % | Mean signed % | R² log monthly | Per-year signed % |
|---|---|---|---|---|
| Global | 1.1 | 0.7 | 0.969 | 2013: +0.2, 2014: -1.1, 2015: +1.7, 2017: +3.1, 2018: -0.6 |
| Africa | 0.7 | 0.1 | 0.989 | 2013: +0.7, 2014: -1.1, 2015: +1.5, 2017: +0.0, 2018: -0.7 |
| Asia | 0.8 | 1.2 | 0.987 | 2013: -0.8, 2014: -0.7, 2015: +1.1, 2017: +6.8, 2018: -0.2 |
| Europe | 2.4 | 2.8 | 0.989 | 2013: -2.4, 2014: +3.8, 2015: +1.7, 2017: +13.1, 2018: -1.9 |
| North America | 2.8 | 1.9 | 0.986 | 2013: +6.4, 2014: -2.8, 2015: -1.2, 2017: +9.3, 2018: -2.0 |
| Oceania | 4.5 | 3.4 | 0.989 | 2013: +0.8, 2014: -0.0, 2015: +4.8, 2017: +4.5, 2018: +6.8 |
| South America | 3.3 | 1.0 | 0.990 | 2013: -3.3, 2014: -2.1, 2015: +3.8, 2017: +9.0, 2018: -2.4 |
| Punjab+Haryana | 5.9 | 0.4 | 0.973 | 2013: +16.1, 2014: -3.1, 2015: -9.8, 2017: -5.9, 2018: +4.7 |
| Paraná Delta | 21.3 | 19.3 | 0.546 | 2013: +21.3, 2014: +34.0, 2015: +13.6, 2017: +48.6, 2018: -21.1 |

5° tile-years: median |annual err| 8.8% (n=2973)

### Models on identical LOYO splits
| Model | Global med err % | Global R² | Punjab med err % | Punjab R² | Paraná med err % | Primary (5° tile-years) % |
|---|---|---|---|---|---|---|
| ratio_bridge_pre_drift | 1.1 | 0.969 | 5.9 | 0.973 | 21.3 | 8.8 |
| gbm | 1.1 | 0.963 | 4.8 | 0.925 | 23.6 | 10.6 |
| ratio_bridge_all_years_drift_contaminated | 3.1 | 0.945 | 4.5 | 0.971 | 25.8 | – |

Chosen: **ratio_bridge_pre_drift** ({"primary_bridge": 8.83, "primary_gbm": 10.55, "rule": "ship gbm iff primary_gbm <= 0.9 * primary_bridge, else ship ratio_bridge_pre_drift", "chosen": "ratio_bridge_pre_drift"})

### Locked test years 2016, 2019 (scored once, after freezing)
| Region | Median abs annual err % | Mean signed % | R² log monthly | Per-year signed % |
|---|---|---|---|---|
| ratio_bridge_pre_drift global | 1.1 | 0.2 | 0.977 | 2016: +1.3, 2019: -0.9 |
| ratio_bridge_pre_drift Africa | 2.3 | -1.4 | 0.987 | 2016: +0.9, 2019: -3.6 |
| ratio_bridge_pre_drift Asia | 1.5 | 1.5 | 0.986 | 2016: +1.2, 2019: +1.7 |
| ratio_bridge_pre_drift Europe | 1.5 | -0.9 | 0.991 | 2016: -2.4, 2019: +0.5 |
| ratio_bridge_pre_drift North America | 2.7 | 2.7 | 0.990 | 2016: +2.9, 2019: +2.5 |
| ratio_bridge_pre_drift Oceania | 6.1 | 5.7 | 0.926 | 2016: -0.4, 2019: +11.8 |
| ratio_bridge_pre_drift South America | 3.8 | 3.8 | 0.991 | 2016: +3.9, 2019: +3.6 |
| ratio_bridge_pre_drift Punjab | 6.9 | 6.9 | 0.945 | 2016: +5.5, 2019: +8.3 |
| ratio_bridge_pre_drift Paraná | 17.0 | -14.1 | 0.371 | 2016: +2.9, 2019: -31.0 |
| ratio_bridge_pre_drift 5° tile-years | 8.6 | | | n=1190 |
| gbm global | 0.7 | -0.7 | 0.971 | 2016: -0.2, 2019: -1.2 |
| gbm Africa | 2.7 | 2.7 | 0.991 | 2016: +3.7, 2019: +1.8 |
| gbm Asia | 8.2 | -8.2 | 0.964 | 2016: -8.9, 2019: -7.5 |
| gbm Europe | 8.5 | -8.5 | 0.978 | 2016: -9.2, 2019: -7.8 |
| gbm North America | 5.5 | -5.5 | 0.967 | 2016: -5.2, 2019: -5.7 |
| gbm Oceania | 2.5 | 2.0 | 0.957 | 2016: -0.5, 2019: +4.5 |
| gbm South America | 4.1 | -4.1 | 0.984 | 2016: -4.3, 2019: -4.0 |
| gbm Punjab | 6.5 | 6.5 | 0.899 | 2016: +3.8, 2019: +9.3 |
| gbm Paraná | 18.8 | -11.9 | 0.561 | 2016: +6.9, 2019: -30.7 |
| gbm 5° tile-years | 10.1 | | | n=1190 |

### LORO
| Region | Median abs annual err % | Mean signed % | R² log monthly | Per-year signed % |
|---|---|---|---|---|
| Africa (held out) | 15.4 | -15.2 | 0.628 | 2013: -15.4, 2014: -15.6, 2015: -14.4, 2017: -15.1, 2018: -15.4 |
| Asia (held out) | 3.4 | -0.5 | 0.846 | 2013: -3.0, 2014: +3.4, 2015: -0.7, 2017: +3.8, 2018: -6.0 |
| Europe (held out) | 43.8 | 40.2 | 0.940 | 2013: +30.0, 2014: +50.4, 2015: +43.8, 2017: +44.1, 2018: +33.0 |
| North America (held out) | 23.1 | 26.6 | 0.669 | 2013: +22.7, 2014: +23.1, 2015: +26.8, 2017: +38.2, 2018: +22.0 |
| Oceania (held out) | 54.8 | 54.8 | 0.597 | 2013: +48.1, 2014: +54.8, 2015: +48.1, 2017: +61.3, 2018: +61.6 |
| South America (held out) | 5.7 | 8.4 | 0.956 | 2013: +4.0, 2014: +5.7, 2015: +9.4, 2017: +18.0, 2018: +5.2 |

5° tile blocks (10 folds): global 1.7%, tile-years median 40.7% (n=2973)

### Denial
| Hidden | From | Design | Global med err % | Global R² | Punjab med err % | Paraná med err % | 5° tile-years % |
|---|---|---|---|---|---|---|---|
| V | T+A | LOYO training years | 1.1 | 0.969 | 5.9 | 21.3 | – |
| V | T+A | forward: fit 2013-15, reconstruct 2017-18 | 2.1 | 0.964 | 4.3 | 25.8 | – |
| V,A | T | LOYO training years | 3.7 | 0.890 | 22.9 | 30.9 | 15.7 |
| V,T | A | LOYO training years | 0.9 | 0.972 | 8.3 | 25.1 | 8.8 |
| N | J1 (bridge) | LOYO over bridge years | 0.3 | 0.996 | 1.6 | 0.6 | – |

### Drift seam: MODIS-only reconstruction / observed VIIRS, R(y)
| Region | 2012 | 2013 | 2014 | 2015 | 2016 | 2017 | 2018 | 2019 | 2020 | 2021 | 2022 | 2023 | 2024 | 2025 | seam 2023-25 / training |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Global | 1.050 | 0.974 | 0.967 | 0.983 | 0.994 | 0.992 | 0.967 | 0.959 | 0.980 | 0.994 | 0.947 | 0.963 | 0.968 | 0.915 | 0.971 |
| Africa | 1.042 | 0.989 | 0.979 | 0.995 | 1.008 | 0.982 | 0.979 | 0.952 | 0.961 | 0.970 | 0.948 | 0.923 | 0.935 | 0.863 | 0.921 |
| Asia | 1.093 | 0.943 | 0.952 | 0.958 | 0.959 | 1.002 | 0.949 | 0.961 | 0.989 | 1.072 | 0.915 | 1.021 | 0.997 | 1.046 | 1.063 |
| Europe | 1.099 | 0.924 | 0.979 | 0.970 | 0.937 | 1.030 | 0.925 | 0.950 | 1.049 | 1.022 | 1.016 | 1.002 | 1.000 | 1.015 | 1.042 |
| North America | 0.991 | 0.993 | 0.937 | 0.932 | 0.984 | 1.005 | 0.927 | 0.973 | 1.027 | 1.032 | 0.915 | 1.035 | 1.017 | 0.972 | 1.051 |
| Oceania | 1.111 | 0.948 | 0.954 | 0.982 | 0.952 | 0.976 | 0.994 | 0.991 | 0.885 | 0.956 | 0.885 | 1.035 | 0.936 | 0.919 | 0.992 |
| South America | 1.015 | 0.936 | 0.946 | 0.983 | 0.990 | 1.022 | 0.938 | 0.983 | 1.036 | 1.010 | 0.985 | 1.019 | 1.078 | 1.020 | 1.077 |
| punjab_haryana | 1.153 | 1.085 | 0.941 | 0.893 | 1.014 | 0.921 | 0.998 | 1.050 | 0.982 | 1.033 | 0.949 | 0.855 | 0.967 | 0.997 | 0.971 |
| parana_delta | 1.257 | 1.079 | 1.276 | 1.075 | 1.062 | 1.364 | 0.823 | 0.700 | 1.426 | 1.061 | 1.044 | 0.975 | 0.722 | 0.694 | 0.709 |

### 2012 seam
| Region | raw jump | harmonized jump | MODIS-only jump |
|---|---|---|---|
| Global | 2.48 | 0.96 | 0.97 |
| Africa | 2.64 | 0.95 | 0.98 |
| Asia | 2.84 | 1.07 | 1.07 |
| Europe | 1.52 | 0.83 | 0.83 |
| North America | 2.07 | 0.92 | 0.98 |
| Oceania | 1.63 | 0.97 | 0.93 |
| South America | 2.10 | 0.88 | 0.85 |
| punjab_haryana | 3.16 | 0.99 | 0.96 |
| parana_delta | 1.45 | 0.80 | 0.94 |

### Drift-contaminated fit (k on 2013-2025) vs pre-drift
| Region | LOYO med err % (all-years k) | mean signed % | scale k_all/k_pre −1, 2013-15 (%) | MODIS era (%) |
|---|---|---|---|---|
| global | 3.1 | 3.5 | 3.70 | 2.56 |
| Africa | 4.7 | 4.9 | 5.12 | 4.59 |
| Asia | 1.8 | 1.3 | 2.02 | 0.56 |
| Europe | 2.0 | 2.1 | 0.76 | -0.15 |
| North America | 3.3 | 0.8 | 1.22 | -0.11 |
| Oceania | 6.8 | 6.8 | 4.20 | 2.47 |
| South America | 3.7 | -0.4 | 0.34 | -1.80 |
| punjab_haryana | 4.5 | 1.9 | 2.16 | 2.97 |
| parana_delta | 25.8 | 33.2 | 7.41 | -6.54 |

### Benchmarks
- {"name": "FireClock (fireclock-team/fireclock README)", "status": "REPORTED BY RIVAL, not reproduced", "region": "Punjab + Haryana, bbox 27.6-32.6N 73.8-77.6E", "median_annual_err_pct": 7.3, "r2_log_monthly": 0.983, "note": "FireClock scores raw daytime detections, a single regional k per calendar month fitted on Punjab itself, LOYO over 2013-2020 (8 years incl. 2016, 2019, 2020). Burn Clock scores 0.05-deg active cell-days (not detections), one global hierarchical k (cell->1deg->5deg->global), LOYO over 5 training years with 2016/2019 locked. The numbers are not like-for-like; the detections variant below is the closer match."}
- {"name": "Burn Clock, detections variant (same pipeline, value = detections)", "region": "Punjab + Haryana", "loyo": {"median_annual_err_pct": 8.12, "mean_signed_err_pct": 0.53, "r2_log_monthly": 0.9633, "per_year_signed_pct": {"2013": 15.22, "2014": -2.47, "2015": -9.68, "2017": -8.12, "2018": 7.72}, "n_years": 5, "n_months": 60, "obs_annual_total_mean": 111357.8}, "loyo_global": {"median_annual_err_pct": 0.61, "mean_signed_err_pct": -0.04, "r2_log_monthly": 0.9892, "per_year_signed_pct": {"2013": -0.04, "2014": -1.4, "2015": 0.35, "2017": 1.49, "2018": -0.61}, "n_years": 5, "n_months": 60, "obs_annual_total_mean": 14934061.0}, "tau": 100, "locked": {"median_annual_err_pct": 5.03, "mean_signed_err_pct": 2.86, "r2_log_monthly": 0.9502, "per_year_signed_pct": {"2016": -2.17, "2019": 7.9}, "n_years": 2, "n_months": 23, "obs_annual_total_mean": 115471.4}}

### Read-back of the shipped tiles (global sums over all 1,237 tiles; `tile_sanity.py`)
```
interval violations: 0
year  harm      lo        hi        rawT+A    rawN      src
2000   1131822    797048   1509971    136259         0 M
2001   7422610   5112528  10036732    873674         0 M
2002   7283235   4972715   9897341   1900252         0 M
2003   7306576   4976854   9947952   2803679         0 M
2004   7212807   4908272   9825696   2773071         0 M
2005   7345791   5018248   9983948   2810849         0 M
2006   6619111   4458364   9074737   2579089         0 M
2007   7246060   4936674   9866232   2780508         0 M
2008   7022621   4772814   9576187   2711902         0 M
2009   6572695   4436803   9000970   2510701         0 M
2010   6719384   4575922   9153938   2570006         0 M
2011   6525521   4409220   8933600   2568061         0 M
2012   6264004   4289967   8646857   2611454   5633948 mixed
2013   6143917   4256039   8439328   2371073   6143917 V
2014   6259202   4326284   8604678   2456808   6259202 V
2015   6552989   4568679   8956920   2588522   6552989 V
2016   6365318   4457202   8679814   2422930   6365318 V
2017   5985289   4129994   8246725   2416242   5985289 V
2018   5832607   3986827   8116898   2261272   5839565 V
2019   6176353   4229451   8575077   2417379   6184066 V
2020   6330148   4362494   8755310   2391346   6323474 V
2021   5887346   4019332   8205144   2274385   5876863 V
2022   5675368   3872896   7909588   2027877   4915124 V
2023   6234200   4275559   8643816   2375739   6187747 V
2024   6563616   4580145   8981188   2457280   5708589 V
2025   5682020   3868835   7932367   1950592   5627980 V
```
- src counts: V 31,928,229 and M 25,810,245 cell-months. X: 0.
- Interval violations (lo > harm or hi < harm): 0.
- There is no visible step at 2002-07 (Terra-only to T+A) or at 2012 (M to V).
- Summed lo/hi are very wide (about ±30% globally). Per-cell quantiles are added as if fully correlated, which is the contract's documented conservative AOI rule. They are not a calibrated interval for large AOIs.

## Interpretation
1. **The bridge is accurate where the method's assumptions hold.**
   - Regional totals for years it never saw: global, continents and Punjab all within 1–7%, on both LOYO and the locked years.
   - The 2012 seam is removed. In every continent, the harmonized jump tracks the MODIS-only jump to within about 0.07; the largest gap is South America, 0.88 vs 0.85.
2. **The pre-drift fit window matters, and this is the demo number.**
   - A drift-contaminated k is worse on clean years globally (3.1% vs 1.1%, bias +3.5%).
   - It would silently rescale 2003–2011 history: +2.6% globally, +4.6% Africa, −1.8% South America.
   - **Exception (honest):** in Punjab the all-years k scored *better* on LOYO, 4.5% vs 5.9%. Punjab alone does not show the contamination penalty.
3. **The drift seam in the MODIS-only reconstruction.** R(2023–25)/R(training) is:
   - Africa 0.92 (2025 alone: 0.86), global 0.97;
   - Asia 1.06, North America 1.05, South America 1.08;
   - Punjab 0.97, Paraná 0.71.

   Africa's MODIS record now under-reads VIIRS; the Americas' and Asia's over-read. This is why post-2020 months are always taken from VIIRS (`src V`) and MODIS is never used after 2012-01 except in VIIRS-outage months; there were none at coverage < 0.5 after 2012-01.

   Note: the GLOBAL_ATLAS −11% world artifact is a raw T+A count. This R(y) is k-weighted, so the two numbers are not the same quantity.
4. **The GBM lost on the pre-registered metric** (5° tile-years: 10.55% vs 8.83%) and had larger continental biases on the locked years: Asia −8.2%, Europe −8.5%, North America −5.5%. Its globally better locked number (0.7%) comes from biases cancelling.

## Failures and weak spots (real results)
- **LORO by continent fails.** A held-out continent gets the global k fitted on the others, with errors of:
  - Oceania +55%
  - Europe +44%
  - North America +23%
  - Africa −15%

  5° tile-block LORO: tile-years median 40.7%. The global total is still 1.7% because errors cancel.

  **Consequence:** the k factors do not transfer between regions, so cells with no 2013–19 overlap data inherit a poor k. The hierarchy's local levels are what make LOYO good.
- **Paraná Delta is poor:** LOYO 21.3%, R² 0.55; locked 17.0%, with 2019 at −31%. The region has 100 cells and only about 600–2,200 VIIRS cell-days per year, and its fires are small and episodic. Any AOI this small should show the interval, not the point.
- **Terra-only conversion (hiding Aqua)** is weak in Punjab: 22.9% (global 3.7%, R² 0.89). The 2000-11 → 2002-06 segment of the calendar is the least reliable. It has not been validated on pre-2002 data, because VIIRS did not exist then.
- **Zero MODIS gives zero output.** A MODIS-only month with zero MODIS cell-days returns harm = 0, even where VIIRS would have seen small fires. Aggregate totals are unbiased by construction (k is a ratio of sums that includes those months), but individual sparse cell-months are biased low and their interval is [0, 0].
- **Coverage threshold mismatch with `raw`.** The tile builder nulls a raw platform-month at > 30% missing days; harmonization uses that platform at ≥ 50% coverage, rescaled. S-NPP 2022-08 (68% coverage) and 2024-07 (58%) therefore feed `harm` while `raw.N` shows null.
- **NOAA-21:** none in the input, so the bridge after S-NPP's end (2026-11-02) rests on NOAA-20 alone. Hiding S-NPP and rebuilding it from J1 gives 0.3% global, 1.6% Punjab and 0.6% Paraná on LOYO over the bridge years.
- **Not done:**
  - GBM LORO.
  - `same_day_pairs` (null in validation.json).
  - Terra-only accuracy before 2002 (untestable).
- **Process deviations, all recorded here:**
  - Training-stage decisions were first made on a frozen copy of q25 (2013–2025 complete; `out/q25_snapshot_2013_2025.parquet`), then re-made on the final file. The decisions were identical (τ 30, τ_b 100, bridge).
  - After the lock, code (not the method block) changed for memory: the 2003–2011 MODIS-only arrays are built separately, using the output coverage threshold.
  - The first full-file training run was OOM-killed and rerun.
  - The dev run (1° detections) chose τ_b = 3000, the edge of the grid. The real run chose an interior 100.

## Operational notes
- `build_public.py` deletes and rewrites every tile with empty harm fields. **After any rebuild of tiles, rerun:**
  `flock -w 7200 cpu.lock nice -n 10 python3 -I pipeline/harmonize/produce.py --input q25`
  This takes about 14 min. It writes each tile atomically and leaves the other fields untouched.
- The tiles directory grew from 653 MB to 1.1 GB with harm, lo, hi and src added. That may matter for static hosting.
- **Run order:**
  1. `lock_config.py`
  2. `validate.py --input q25 --stage train` (plus `--value detections --skip-gbm`)
  3. `validate.py --stage final` (both)
  4. `produce.py`
  5. `assemble.py`
  6. `report_tables.py`

  Logs and JSON are in `pipeline/harmonize/out/`.
