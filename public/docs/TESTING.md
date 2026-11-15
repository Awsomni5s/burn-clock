# Burn Clock testing record

This is an evidence log, not a claim that every planned check has been run. Human testing remains **not run**. Never fill a participant, quote or score from an automated run or an AI review.

## Addendum revision: current work

| Check | Actual observation | Status |
|---|---|---|
| Public NRT CSV parser and statistics | Four `node:test` cases passed: quoted CSV and local-solar rollover; header-only and malformed payloads; five attempts with exponential backoff; preserving an older snapshot on feed failure and keeping first-failure values unavailable. | Passed, 2026-11-15 UTC |
| Live source fetch | Four public seven-day endpoints fetched at `2026-11-15T00:57:53.189Z`: MODIS 82,587 rows; S-NPP header only; NOAA-20 431,187 rows; NOAA-21 422,848 rows. Per-preset summaries and payload SHA-256 hashes are in `data/live/latest.json`. | Observed snapshot, provisional |
| Scientific context | iFOREST's published summary reports approximately 37% less Punjab burnt area from the 2022 peak to 2025; the analysis cutoff and inconsistent 35% slide heading are recorded. NOAA's 2 November update confirms S-NPP data delivery ended at 15:40 UTC that day. | Primary-source checked; not independent scientific reproduction |
| Full addendum calculations, rendered numbers, new controls and contours | Record final output from the revision's independent Python, unit, browser, accessibility and speed checks here after they complete. Earlier-build results below do not certify new features. | Await final integration run |
| Five-second comprehension | No real people tested. | Not run |
| T1 Punjab, T2 California card, T3 Cerrado, T4 Paraná | No participant tasks or timings recorded. | Not run |
| Human crop, screen-reader and colour-blind checks | No human observations recorded. | Not run |
| Fix top three confusions and retest new people | No observed confusions, changes or retest scores yet. | Pending real sessions |

The live snapshot is not refreshed by the hosted static site itself. The six-hour GitHub Actions file is a supplied workflow template, not an active schedule on the current Sites remote. Its artifact requires deployment to appear on the site.

## Earlier build baseline, not an addendum test result

The report recorded at `2026-11-15T00:37:18.387Z` for the preceding build contains 38 passed tests, 116,637 passed numerical assertions, six product-workflow groups and eleven interaction/edge-case groups. Its ten route/viewport accessibility scans had zero automated WCAG 2.1 A/AA rule violations and 82 node-level incomplete findings needing manual review. These numbers must not be relabelled as tests of the new Claim Checker, contour maps or live panel.

Earlier local lab observations: headline/calendar 174/444 ms on the desktop profile and 1,287/2,578 ms on the simulated mobile profile (10 Mbps, 100 ms latency, 4× CPU slowdown). They were one observation per profile against a local production preview, with an earlier ten-second calendar budget. The addendum now requires first useful answer under three seconds on specified throttled 4G; measure the new build against that target. Do not silently count earlier timings as the new test.

## Gates defined before participant testing

- Number integrity: 100% of the enumerated assertions, with coverage stated. Preset aggregations and the independent reference agree within 0.1%; displayed rounding must agree exactly where asserted.
- Five-second test: at least four of five explain that the measured decline depends on satellite timing. Report actual numerator/denominator if more people are tested.
- T1: at least 80% pass and zero “burning did not fall” or “data is fake” hard failures.
- T2: California, August–September, 2019 versus 2024; accurate card and matching share link without help; median time strictly under 120 seconds. Publish failures and timeouts, not just successful times.
- First useful answer: under three seconds, with cold-cache device/network/CPU and timing definition recorded.
- Manual crop and accessibility gates require observations, not an automated pass inferred from rendering.

The facilitator script and empty result sheet are [USER_TEST_PROTOCOL.md](USER_TEST_PROTOCOL.md) and [USER_TEST_RESULTS_TEMPLATE.csv](USER_TEST_RESULTS_TEMPLATE.csv).

## Real-person results

| Field | Round 1 | New-participant retest |
|---|---|---|
| Actual date, build and URL | Not run | Not run |
| N, role mix and proxy status | Not recorded | Not recorded |
| Five-second passes / starters | Not recorded | Not recorded |
| T1 passes / starters; hard failures | Not recorded | Not recorded |
| T2 successes / starters; median, range, timeouts | Not recorded | Not recorded |
| T3 and T4 passes / starters | Not recorded | Not recorded |
| Actual permitted quotes | None | None |
| Misuse attempts and failures | Not run | Not run |
| Manual accessibility observations | Not run | Not run |

After real sessions, replace pending cells only with observed results and link their retained evidence. Record the top three confusions, changes and build, then genuine before/after results from new people. Use “Tested with N people; X of N read the Punjab result correctly” only when N and X actually exist.
