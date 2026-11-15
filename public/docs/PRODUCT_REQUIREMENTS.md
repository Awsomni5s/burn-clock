# Burn Clock: product and testing requirements

Revision: November 14, 2026. This supplements the supplied build brief and the five-screen BURN_CLOCK_GOATED_PLAN.md. Scientific source files are retained unchanged.

## The problem, with the evidence attached

Punjab reported 71,304 fire incidents in 2021 and 5,114 in 2025: a 92.83% decline, rounded to **93%**. This is a real count comparison. Its protocol combines Terra/Aqua MODIS and S-NPP VIIRS over September 15–November 30; it is not literally a single instrument at exactly 13:30. The app must not call it fake or a farce.

The receipt asks what the afternoon observations add. All following figures are Punjab, October–November, confidence ≥2, unmasked GK2A observations:

- At 17:00 IST, pixel-hours in 2025 were 1.401× those in 2021.
- Unique pixel-days across 12:00–18:00 IST fell 34.16% from 2021 to 2025.
- 96.19% of 2025 afternoon pixel-hours occurred at 16:00, 17:00 or 18:00 IST, versus 51.92% in 2021. The denominator is all observed 12:00–18:00 pixel-hours. These are not shares of unique fires.
- 2021 is the peak in the supplied GK2A series. The same unmasked unique pixel-day measure is 2.138× higher in 2025 than in 2019. Keep this directly beneath the headline.

The matched-calendar-day fan is a distinct comparison: 0.636× versus 2021 and 1.727× versus 2019. Show the mask and baseline controls rather than mixing the two definitions.

Monitoring concentrated around satellite passes can under-sample a later daily pattern. That is a reason to check emissions timing and monitoring coverage, not proof of a quantified emissions undercount, deliberate evasion or a corrected true fire count. GK2A has coarse pixels, can detect hot smoke, and uses hour-dependent thresholds; cloud/outage effects remain. The official and GK2A windows and units differ.

Exact arithmetic, primary URLs and independently verified original GK2A files are in PRODUCT_EVIDENCE_AUDIT.md.

## Five destinations and the decisions they support

| Destination | User question | Interaction and handoff |
|---|---|---|
| Explore the record | What changed in this area, and can I compare it over time? | Draw/select box; raw/harmonized/anomaly modes; selected-month evidence; annual badge; fixed-rule So what; role-specific next step; CSV and area claim card. |
| Satellite clock | Could observation timing affect this trend? | Annual wheel and tests; the plan's world atlas is included here, with three maps and country table. |
| Punjab receipt | What does the 93% claim establish? | Count, hour and whole-afternoon context; late-hour share; immediate baseline caveat; mask/base-year fan; qualified claim card. |
| Validation | Where does the model fail? | Held-out results, both model scores, seams, satellite denial, pair tests and known failures. |
| Methods and sources | Can I trace this claim and assess product usability? | Data definitions, deterministic rule design, sources, actual automated reports and explicit pending human results. |

## Deterministic area guidance

No runtime language-model generation is used. Rules inspect these in order: load failure; loading; no archived cell centers; missing complete monthly estimate; annual clock sensitivity; inadequate paired support; before the diagnostic window; otherwise same-month historical quantile status. Coverage flags and MODIS conversion notes are attached separately.

A clock-sensitive Aqua ratio prompts satellite-specific reporting and an independent hourly check. It does **not** imply that VIIRS necessarily overstates the real decline, establish a cause, or supply a correction factor. The badge is annual, repeated on months, not a measured monthly effect. Empty and missing areas must never become zero-activity claims.

Four roles change the next step, not the evidence: emissions modellers review timing inputs; policy analysts review reporting/monitoring coverage; journalists retain units and baselines; researchers inspect CSV provenance and validation before fitting trends.

## Test order and gates

1. Independently calculate numbers from the supplied source files and compare with rendered output. Target 100% agreement within displayed rounding for the explicitly audited finite states. Record coverage and failures; do not imply exhaustive proof of every possible rectangle.
2. Exercise null/zero, empty/invalid/date-line/polar boxes, the MODIS/VIIRS transition, absent NOAA-21, outage months and failed requests.
3. Conduct an uncoached five-second homepage test with real participants, hiding the page before asking what it communicated.
4. Run all four decision tasks with 5–8 real people. Punjab pass rate must be at least 80%, with zero conclusions that burning did not fall or the data is fake. Every participant must produce an accurate claim card in under 120 seconds.
5. Test cropping and misleading captions. Unit, time, period, baseline and mask sit within each numerical card sentence, but deliberate cropping can still mislead. Never call the design crop-proof.
6. Check keyboard navigation, automated WCAG rules, mobile layout, reduced motion and local load performance. Add real screen-reader, device and network observations in the human study.

Fix the top three observed confusions, then retest with new participants. Report real counts, denominators, timings, verbatim anonymous observations, changes and before/after scores. Until collected, human testing is **not run**, not failed or passed. See USER_TEST_PROTOCOL.md and the blank USER_TEST_RESULTS_TEMPLATE.csv. No participants were recruited or messaged by this build.
