# Latest mock implementation — 15 November 2026

Applied inputs: `burnclock_site_mock.html`, its 11-page PDF, and the latest `DATA_CONTRACT.md`. The HTML/PDF provide the design and tasks. Scientific values remain calculated from the supplied release rather than copied from illustrative mock labels.

| Supplied screen | Implemented view |
| --- | --- |
| 1. Home | `#home`: place search and Check, six presets, four task entrances, Punjab evidence teaser and source-derived hourly-share comparison |
| 2. Punjab report | `#explorer`: editable season/years, separate timing checks, satellite and combined comparisons, actions, annual bounds, hourly context and detailed monthly record |
| 3. Other user roles | Four distinct role panels with model, monitoring, reporting and research actions; CSV, source profile, citation and claim-card handoffs |
| 4. African report | Same report with Africa's selected months and actual missing-data/uncertainty limits; no invented hourly evidence |
| 5. Punjab evidence | `#receipt`: actual coupled satellite maps near the top, hourly slider, source-derived share chart, baseline controls, complete tables and caveats |
| 6. Check a claim | `#claim`: submitted text stored in the view URL, explicit comparison limits, editable selection, defensible wording and phone-readable PNG preview |
| 7. Monitoring brief | `#brief` and downloadable one-page A4 PDF, generated from the receipt |
| 8. Where it matters | `#clock`: actual global contours/year selector, source-value inspection, ranked country links, detection-ratio diagnostics and measured time shifts |
| 9. Reliability | `#validation`: held-out, seam and same-day-pair summary; prominent failures; full results and qualified competitor comparison |
| 10. About | Purpose, limits, source credits, citation, code access and AI disclosure links |
| 11. Phone | Collapsible menu, stacked report, role selector, bounded tables and readable claim preview at 375px |

## Changes required by the actual evidence

- The stated Punjab–Haryana rectangle, October–November 2021→2025, gives S-NPP −80.96%, Aqua −73.69%, and combined activity −80.35% (approximate bounds −87.99% to −69.35%). Terra's 2025 total is 26 cell-days, below the 50-observation comparison threshold. The mock's −84%, −75% and −83% are not reused.
- The official Punjab 71,304→5,114 decline remains 93%, with its mixed MODIS/S-NPP protocol and September 15–November 30 window beside the explanation. It is not literally an exclusively 1:30 pm count.
- The supplied hourly counts support 2021 and 2025 shares: 4 pm or later 51.92%→96.19%; 1–2 pm 21.82%→1.09%. The mock's complete 2019–25 hourly-share series is unavailable, so the chart uses only supported years.
- Country changes are MODIS/S-NPP observation-ratio diagnostics, not measured errors in the true fire count or isolated causal effects of orbital drift.
- Same-day-pair results, GK2A and burned-area context retain their distinct units, baseline windows and limitations.

## Missing §1b and the selected-month interpretation

The latest contract supersedes the single fixed-season timing badge and directs both checks to monthly `tiles/*.json.raw`. Its referenced revised addendum §1b was not included; the supplied addendum goes directly from section 1 to section 2. This limitation is visible in Methods and the check details.

The implementation uses the previously documented log-ratio threshold, `max(2 × population SD, 0.15)`, applied to **the user's selected months**. Seven complete, positive baseline ratios (2013–19), selected-year S-NPP ≥200 and the MODIS platform ≥50 are required. A positive Aqua departure flags a possible later-burning signal. An absolute Terra or Aqua departure flags a changed MODIS relationship. A negative finding for the latter requires both comparisons to be testable; otherwise it is inconclusive. These are documented implementation choices, not a claim to reproduce an unavailable specification or establish causation.

Calendar corner badges were removed. CSV rows now contain separately named month-specific timing fields; embedded cards and report guidance use the new selected-month rules. Clock tiles remain the source of approximate annual pass times. Historical fixed-season calculations remain in the scientific reference code, clearly separated from current UI verdicts.

## Verification and remaining work

`make reproduce` runs independent Python reference calculations, selected-month and legacy scientific regression tests, numerical browser checks, sharing/print checks and the latest mock workflow/accessibility suite. Current results are on Methods and in `public/qa/`.

No human participants have been simulated. Five-second comprehension, real task success, crop interpretation and before/after retesting remain for the team. The actual DOI, GOES observations and global raster grid also remain pending. Current site and GitHub access remain private.
