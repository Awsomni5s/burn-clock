# Changelog

## 2026-11-15 — Verdicts, case studies and judge deliverables

- **Verdict card on every place report.** The answer now comes first: one of four verdicts (*Timing matters here*, *The older MODIS record is off here*, *Satellite timing doesn't explain this*, *Can't tell yet*), a one-sentence answer, and the two checks in plain words ("Yes, likely" / "No sign" / "Can't tell"). Rule in `src/verdict.ts`, unit-tested in `src/verdict.test.ts`, documented on the Methods page.
- **Advice depends on the verdict and the user's job** (4 verdicts × 4 roles) instead of one fixed list per role.
- **Case studies page** (`#cases`, replaces "Punjab evidence" in the menu): six places, four answers. Each verdict is read from the built app by `scripts/build_case_studies.mjs`, so cards always match place reports.
- **Punjab hourly data for every year 2019–2025** (`public/data/gk2a_hourly_by_year.json`, `pipeline/analysis/gk2a_hourly_by_year.py`; 2021 and 2025 asserted equal to the receipt). The home chart and timeline now show the year-by-year shift (4 pm or later: 35% → 96%); the timeline's 2019 comparison is enabled; map base years 2019–2024 with labels; the hourly caption now uses the chosen base year (it previously always said 2021).
- **Claim card leads with the verdict.** Home page gets a "Same check, different answers" strip and a sharper lead. Judge tour rewritten around the verdict.
- **Fixes:** plain map units; "Jullundur" → Jalandhar; note that fire data stops at the India border; plain outage wording ("S-NPP (November 2025)").
- **Deliverables:** 7-slide demo deck `public/docs/Burn_Clock_Demo_7_Slides.pdf` (built by `scripts/build_demo_deck.py`); `vercel.json` for public hosting.

## 2026-11-15 — Satellite and afternoon timeline

Replaced the circular clock with the uploaded timeline design and added it to place/claim reports. Each area has its own named satellite markers and baseline shifts in approximate local civil time. Punjab's observed 2021/2025 hourly shares sit on the same axis, with explicit Punjab-state/October–November scope. The comparison is shareable and supports browser Back. The unsupplied 2019 distribution is unavailable; other regions show only their pass times. Phone layouts keep the full afternoon visible and provide an exact-value source table.

The complete reproduction checks passed, including new original-count/URL/geography/provenance tests and eight additional responsive accessibility scans. Numeric checks now also compare every available baseline pass-time label against independent references. Initial automated/visual inspection led to a compact phone chart instead of a wide, partially hidden chart. These are developer findings, not human-study results. See [timeline implementation](public/docs/TIMELINE_IMPLEMENTATION.md) and the updated Methods test record.

## 2026-11-15 — Chosen logo and button palette

Added the supplied satellite-and-wordmark SVG to the responsive header, with SVG favicon and freshly rendered PNG browser/home-screen icons. The supplied PNG files contained broken-image placeholders; the original SVG artwork is intact. Buttons now use the logo's rust, dark brown and orange, including hover, selected and keyboard-focus states. Scientific satellite/chart colors remain consistent with their existing legends.

Local verification: 36 accessibility scans (nine pages at 1440, 768, 375 and 320 pixels), zero reported violations or page overflow; verified primary default/hover/focus colors, four asset URLs, logo home navigation and mobile menu. Removed a background fade after an automated scan detected transient low contrast on a changing claim-card button. These are automated/developer checks, not participant tests. See `public/qa/branding-checks.json` and `public/brand/SOURCES.json`.

## 2026-11-15 — Latest mock screens and selected-month timing

Implemented the uploaded 11-screen design: task-led home, distinct place and claim pages, four role-specific panels, annual charts with bounds, map-first Punjab evidence, global exploration, reliability summary, About and phone menu. Retained NASA links, provenance, exports, tour, citation and the one-page brief. Replaced stale mock values with source-derived values and used only the two supplied years of hourly shares.

Replaced visible fixed-season timing verdicts with two checks from selected monthly raw values. The referenced addendum §1b was absent; Methods states the exact implementation interpretation and missing specification. Missing Africa baseline support remains inconclusive. CSV and embed outputs now use explicit month/season checks.

Automated testing found and fixed a lost search-place name, unavailable NASA links on empty areas, and user-entered unverified claim text leaking into the exported comparison URL. These are automated/developer findings, not human-study results. See [mock mapping](public/docs/MOCK_IMPLEMENTATION.md) and the actual Methods test record.

## 2026-11-15 — First GitHub integrity run

GitHub's Linux run passed the data checks and all 120,786 numeric assertions, then caught mobile overflow from the long live-observations button label. Action buttons now wrap within the available width, including when system fonts are wider than macOS defaults. This was an automated finding, not participant feedback.

## 2026-11-15 — Verification, sharing and reuse

Added NASA Worldview/FIRMS links tied to area and day, a four-step judge tour, numeric provenance dialogs, a configuration/row-count footer, browser history and shareable analytical controls, atlas-derived country ranking, a one-page policy brief, API documentation, a compact iframe badge, and decompressed GIS contour downloads. Added date-specific civil-time displays, Indian digit grouping, glossary definitions and print styles.

Prepared a checksum-verified Zenodo deposit with provisional authors and no invented DOI. Added citation and license files, `make reproduce`, and a GitHub integrity workflow. Preserved the dated snapshot model after verifying that NASA blocks direct browser CSV access.

Automated inspection found and fixed a lazy-loading tour target, nested number styling that broke headline layout, and state-history gaps. These are developer/automated findings, not participant feedback.

**People tests:** not yet run. No before/after comprehension scores are available. Add the actual study date, sample size, raw task outcomes, top three confusions, fixes and new-participant retest here after the team conducts the study.

## 2026-11-14 — Addendum and supplied-data update

Integrated updated validation/same-day-pair data and unchanged original source archives; added contour maps, a real-curve timing illustration, local place search, fixed-rule decision guidance, claim cards, source-line links and checksum-verified archive downloads. Made the peak-2021 baseline, 2019 comparison, observation units and missing-data limitations visible. Kept full upstream reproduction and human testing explicitly pending.
