# Analysis report: receipt, hot-smoke check, VIIRS pairs, world JSON (2026-11-14)
Code is in `pipeline/analysis/`. Outputs are in `public/data/` and `pipeline/analysis/out/`. Comparisons are Punjab, Oct–Nov, 2025 vs 2021.

## Punjab receipt (`public/data/punjab_receipt.json`)
**Polar daytime cell-days**, outage-masked. Each row gives the ratio and the 2025 median look time:

| Satellite | 2025 ÷ 2021 | Look time (IST) |
|---|---|---|
| Terra | ×0.013 | 10.05 |
| S-NPP | ×0.119 | 13.70 |
| NOAA-20 | ×0.121 | 13.63 |
| Aqua | ×0.216 | 15.25 |

**GK2A (conf ≥ 2) by IST hour:** 13 h ×0.045; 14 h ×0.015; 17 h ×1.40.

**GK2A unique pixel-days:** ×0.66 vs 2021; ×1.73 vs 2019.

**Base-year fan (2025 ÷ base):**

| Base | GK2A pixel-days | S-NPP | NOAA-20 |
|---|---|---|---|
| 2019 | 1.73 | 0.155 | 0.152 |
| 2021 | 0.64 | 0.118 | 0.122 |
| 2022 | 1.13 | 0.161 | 0.157 |
| 2023 | 1.00 | 0.202 | 0.198 |

**Verdict:** `clock_sensitive`. Aqua's shift is Δρ = +0.72 against a 0.15 threshold; Terra had too few detections to test.
- **By year:** 2021–22 robust; 2023–25 clock-sensitive.
- **Share of the decline:** the geostationary change explains 21–33% of the log VIIRS decline.
- **VIIRS night:** cell-days rose 29 → 69 (S-NPP) and 46 → 88 (NOAA-20).

**Outage mask:** a platform-day is dropped when its India-wide daytime count falls below 20% of its 31-day median. The same calendar day is removed from both years of every ratio.
- S-NPP: 3–6 Nov 2024, 31 Oct 2019, 2 Nov 2023, 12 Nov 2025.
- NOAA-20: 1 Oct 2023.
- Terra: 11–23 Oct 2022.

**Window caveat:** the official 93% covers Sep 15–Nov 30 and mixes MODIS with S-NPP. This analysis covers Oct–Nov only.

## Hot-smoke check (2021–25; placebo = same pixel with the date shifted ±7 d)
| GK2A pixel-days | Share with VIIRS within 4 km | Placebo |
|---|---|---|
| 16–18 IST | 44.2% | 37.6% |
| 12–14 IST | 92.6% | 85.8% |
| Late only | 37.8% | 31.1% |

**Inconclusive and low power.** VIIRS can't see fires lit after its pass, and the night re-detection rate is ~0.2%.

## Same-day S-NPP vs NOAA-20 pairs (Punjab + Haryana)
| Period | % change per hour of delay | 90% CI |
|---|---|---|
| 2018–21 | +6.3 | [+1.0, +12.1] |
| 2022–25 | +9.7 | [+2.9, +17.2] |

**The steepening is not significant.** MP and UP are ≤ 0.
- **Robust to controls:** a scan-size control gives +9.2 / +11.0; year intercepts give +5.9 / +10.0.
- **2024:** the 2024-only slope is +23.7%/h, but from 2024 NOAA-20 was the later pass on 75–82% of days, so it is less well identified.
- **Unit difference:** FireClock reports +28.6 / +29.6 %/h. That figure uses detections, ours uses cell-days, and the two unit choices give different answers.

## World JSON
72 countries with ISO3 (57 reliable, ≥ 8 cells), plus 6 continents and World. World bend = −12.7%; artifact 2019→2025 = −11.1%.
- **Units:** the world files use nominal/high-confidence detections from the 1° atlas, not cell-days (documented in the contract).
- **Interval keys:** the interval sits in flat `lo` / `hi` keys.
- **Maps:** clock_map_2025.png, terra_night_2025.png, aqua_2025.png.
