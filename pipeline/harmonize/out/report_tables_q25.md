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
