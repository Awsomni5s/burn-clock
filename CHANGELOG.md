# Changelog

## 2026-11-15 — Ask what to do: a role-aware Claude advisor

- **Context layer** (`src/server/briefing.ts`), built from the site's published files so every number is traceable:
  - the official claim, GK2A shares by year, the 5 pm ratio and Aqua's crossing times;
  - the verdict rules, validation errors and case-study findings;
  - the verdict × role actions (now shared in `src/roleActions.ts`);
  - site pages and limits.
- **Advisor behaviour:** it asks one question if the role or place is unclear. Answers come as a direct answer, then "What to do" steps for the role, then "Why", then a link. It follows the conversation (last 8 turns), declines off-topic requests, and points to emergency services for live emergencies.
- **Model:** default `claude-sonnet-5-5`, with prompt caching of the instructions, briefing and tools. A per-instance hourly cap is added.
- **UI:** a chat panel with role choices, example questions per role, a conversation thread, per-answer number-check badges and "What it looked up".

## 2026-11-15 — Ask Burn Clock (Claude, with checked numbers)

- **`/api/ask`:** Claude answers plain-language questions using only Burn Clock's tools (`check_place`, `punjab_district`, `punjab_week`, the same code as the site).
  - Every number in the answer is checked on the server against the tool results, allowing rounding and fractions shown as percentages. A failing number triggers one retry naming it; if it still fails, the reader sees a warning listing it.
  - Rate-limited, with an optional daily cap.
  - Off until `ANTHROPIC_API_KEY` is set; the panel stays hidden until then.
- An Ask panel on the home page and the Punjab planner. Plain-text messages to the Telegram bot go to the same assistant.
- **Tests:** `src/server/ask.test.ts` covers the number checker. `scripts/api_checks.mjs` runs a fake Claude through tool use, a verified answer, a flagged invented number with retry, the off state, input checks, the rate limit and Telegram free text.

## 2026-11-15 — Public JSON API and a Telegram bot

- **`/api/check`** returns the verdict for any box or point: the two checks, the combined-record change and range, and this week's live check, as JSON with open CORS. **`/api/punjab`** returns a district's planner summary as JSON or text.
- **Telegram bot** (`/api/telegram`):
  - `/district`, `/week`, `/check lat lon`, a shared location (Punjab gives a district summary; elsewhere a verdict for 1° around the point), deep links from the site, and `/subscribe`/`/unsubscribe`;
  - a weekly digest through Vercel Cron (`/api/digest`, CRON_SECRET), with subscriptions stored in Upstash Redis;
  - one-time webhook setup at `/api/telegram-setup`.
  - It is off until its environment variables are set, and the site hides the Telegram links until then.
- The server code (`src/server/`) reuses the app's own calculations and is bundled to `api/_lib/server.mjs` by `scripts/build_api.mjs`. `scripts/api_checks.mjs`, part of the gate, checks the API against the app's verdicts and the planner file, and drives the bot with a fake Telegram and Redis.
- The API page now says the site is public and documents the live API. Place reports (research and air-quality roles) and the Punjab planner link to their JSON.

## 2026-11-15 — Live timing check for any place, auto-refreshing data

- **Live check on every place report:** "Is burning happening later than usual this week?"
  - `scripts/fetch_live_cells.py` turns NASA FIRMS' global seven-day files into `public/data/live/week_cells.json.gz` (daytime 0.05° cell-days per satellite in 0.25° bins).
  - `src/liveCheck.ts` compares this week's Aqua ÷ NOAA-20 with the same month in 2013–19 for the selected box. It uses the verdict's threshold, with NOAA-20 bridged to S-NPP from the area's own overlap.
  - Unit-tested on all six presets, and browser-checked with an axe scan.
- **Auto-refresh:** `.github/workflows/live-data.yml` now runs every six hours. It rebuilds the preset snapshot, Punjab-this-week and the live grid, then commits them, so Vercel redeploys with fresh data and no server is needed.

## 2026-11-15 — Act on it, audited against rival tools

- **Right now (live).**
  - `scripts/fetch_punjab_week.py` puts NASA FIRMS seven-day South Asia files (MODIS, NOAA-20, NOAA-21, S-NPP) into Punjab districts, writing `public/data/punjab_week.json`.
  - `pipeline/analysis/punjab_aqua_daily.py` gives the same calendar days for 2013–2025, writing `public/data/punjab_aqua_daily.json`.
  - The page shows this week's Aqua ÷ NOAA-20 ratio against every past year, with Aqua's crossing time, plus a "Where to send teams this week" table with each district's check window.
- **For field teams:**
  - "Use my location" (point-in-polygon in the browser);
  - a field card saved as an image;
  - a calendar file (.ics) of daily check windows;
  - a season-timing table (10/50/90% dates and the 4 pm+ share by year);
  - a copyable link per district.
- **For forecasters:**
  - a 90% range for the count gap from resampling days (seeded, reproducible);
  - a check of whether the 1–2 pm GK2A images and the satellite count agree at the hour the satellites pass.
  - The ranking table gains a "count fell vs afternoon" column.
- **Tests:** new unit tests (bootstrap, season dates, location, live ratio, calendar file). The browser checks now also recompute the live ratio, drive geolocation, and validate the PNG, the .ics file and the range text.

## 2026-11-15 — Act on it: Punjab, district by district, and a brief for every role

- **Punjab action planner (`#act`, new menu item "Act on it: Punjab").** Built from `public/data/punjab_districts.json`, which is made by `pipeline/analysis/punjab_districts.py`.
  - **Data:**
    - GK2A hourly fire pixels and S-NPP/NOAA-20 daytime cell-days are assigned to 22 districts using geoBoundaries ADM2 (ODbL).
    - Daily series let each comparison drop the outage days of both compared years. This is the same rule as the statewide base-year fan, and the unit tests assert the all-district result matches it.
  - **Field teams:** districts ranked by fire signal at 4 pm or later, the best 1–4-hour check window, a map, and a copyable plan.
  - **Forecasters:** how much further the ~1:40 pm count fell than the whole-afternoon record, for every base year, plus hourly profiles as CSV.
  - **Reporters:** "You can say / Don't say / Why" wording per district. It is withheld where data are thin.
  - **Researchers:** CSV and JSON downloads.
- **Role brief from any place report.** "Download one-page brief" saves a printable HTML file; "Copy brief as text" copies the same content. The order is verdict, actions for the chosen role, evidence, then limits. Areas overlapping Punjab link to the planner.
- **Links to the planner:**
  - the home page, through a Punjab callout;
  - the Punjab case study, through "Plan by district";
  - the judge tour, which gains a fifth step.
- **Tests:** `src/act.test.ts` and `src/roleBrief.test.ts`. `scripts/act_browser_checks.mjs`, now part of `node scripts/reproduce.mjs`, recomputes the window, gap and ranking from the shipped file, downloads the CSV and brief, runs an axe scan and checks for phone overflow.

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
