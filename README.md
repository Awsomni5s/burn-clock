# Burn Clock

[![Integrity](https://github.com/Awsomni5s/burn-clock/actions/workflows/integrity.yml/badge.svg)](https://github.com/Awsomni5s/burn-clock/actions/workflows/integrity.yml)

**A fire calendar you can act on.** Burn Clock does what the challenge asks: it merges NASA's MODIS and VIIRS fire records (548,501,203 FIRMS detections) into one harmonized burning activity calendar for any area, every month since 2001. It shows the critical period, each month against the multi-year usual, a CSV export, and a raw view by satellite. That calendar is the home page.

Fire satellites look at each place only at a few fixed times a day, and two of them (Terra and Aqua) have drifted. When burning moves to other hours, the count changes even if the fires don't. So every calendar also carries:
- **a Clock check column**, marking each year since 2021 as trustworthy or distorted by satellite timing;
- **a verdict** for the chosen season;
- **a live check** of this week's NASA data;
- **actions for your role.**

**Your next move.** Right after you pick a place, before the calendar, three cards turn it into decisions for your job (enforcement & policy, smoke & air quality, news & fact-checks, research):
1. **When to be ready:** the place's own critical period, the busiest day (Punjab + Haryana day view), how soon the next season starts, and an `.ics` file that puts the season in your calendar with a reminder two weeks ahead.
2. **Is the trend real?** The verdict for the selected season and the combined-record change.
3. **This week:** NASA's last seven days against an average week of the same month in 2019–2025 (same satellite, NOAA-20), read together with the live timing check. A low count with burning moved later is never called progress. One tap sends the three answers and their actions to WhatsApp, or copies them with the link.

**Choose any area:** search 176 countries and about 4,600 states and provinces (real Natural Earth outlines), or on the map draw a rectangle, a circle, a shape by hand, or click a province. Only grid cells whose centre lies inside the outline count. Custom areas get their own critical period as the season. **Days:** for Punjab + Haryana the calendar switches between months and a year × day view that adds up to the monthly values.

| Verdict | Example (computed by the app) |
|---|---|
| **Timing matters here** | Punjab + Haryana, Oct–Nov 2021→2025: counts fell ~80%, but burning moved to after 4 pm (35% → 96% of afternoon fire detections, 2019→2025, hourly GK2A data). |
| **The older MODIS record is off here** | Kalimantan, Aug–Sep 2019→2025: the decline is real, but a MODIS-only record would misstate it. |
| **Satellite timing doesn't explain this** | Punjab wheat season (Apr–May) and California: same check, no timing problem. |
| **Can't tell yet** | Paraná Delta: too few fires for a verdict. |

- **Live site:** https://burn-clock.vercel.app (public, no login). The live API is at `/api/check` and `/api/punjab`.
- **Punjab action planner (`#act`):** for each of Punjab's 22 districts, it shows when the burning happens (hourly GK2A data, 2019–2025) and how much further the ~1:40 pm satellite count fell than the whole afternoon. It is built for four kinds of user:
  - **Field teams:** a ranked list of districts and a check window.
  - **Air-quality forecasters:** a sensitivity factor and hourly profiles (CSV).
  - **Reporters and officials:** "You can say / Don't say" wording.
  - **Researchers:** data files.

  Built by [`pipeline/analysis/punjab_districts.py`](pipeline/analysis/punjab_districts.py) with geoBoundaries ADM2. The browser checks recompute the planner's window, count-gap and ranking numbers from the shipped file.
- **Live check on every place report, anywhere on Earth:** the verdict's "has burning moved later?" question is also asked of NASA's latest seven-day data for the selected area, against the same month in 2013–19 (`scripts/fetch_live_cells.py`, `src/liveCheck.ts`). With the 8–15 Nov 2026 data:
  - Punjab + Haryana: **Yes, likely**. Aqua recorded 1.14 cells per NOAA-20 cell, against a normal 0.28–0.37.
  - Central African savanna and California: **No**. Aqua sees less, as a later pass would when burning peaks earlier.
  - Kalimantan: **No sign**.
  - Paraná: **Can't tell**, because there are too few fires.
- **Live JSON API** (server functions on Vercel, running the same code as the site):
  - `/api/check?box=27.6,73.8,32.6,77.6&months=10,11&a=2021&b=2025` gives the verdict, the checks, the change and range, and this week's live check for any box. You can pass `lat=&lon=` instead of `box`.
  - `/api/punjab?district=Sangrur` gives a district's check window, busiest weeks, count gap, wording and this week's fires. Add `&format=text` for a message-length version.
- **Ask what to do (Claude advisor):** a role-aware, multi-turn advisor. It's given a context layer built from the site's own files (`src/server/briefing.ts`): the official Punjab claim, the hourly shares by year, the verdict rules, validation errors, case-study findings, the verdict × role action table, site tools and limits. It answers as a direct answer, then "What to do" steps for the reader's role, then "Why" with numbers, then a link. It defaults to `claude-sonnet-5-5`, with prompt caching.
- **Ask Burn Clock** (Claude, optional): on the home page, the Punjab planner and in the Telegram bot, people can ask in plain words.
  - `/api/ask` gives Claude only three tools: Burn Clock's own `check_place`, `punjab_district` and `punjab_week`. It is told to answer only from their results.
  - Before an answer is shown, the server checks every number in it against the tool results. A number that fails gets one retry, and is then flagged to the reader.
  - Rate limits: 20 questions an hour per address, plus an optional daily cap (`ASK_DAILY_LIMIT`, default 500, kept in Upstash).
  - To switch it on, set `ANTHROPIC_API_KEY` in Vercel. `ANTHROPIC_MODEL` is optional and defaults to `claude-sonnet-5-5`. There's also a per-instance hourly cap, `ASK_HOURLY_LIMIT`, default 150. The panel stays hidden until the key is set.
- **Telegram bot** (optional, like Mee's alerts but with timing). It answers `/district Sangrur`, `/week`, `/check lat lon` and a shared location, and `/subscribe` sends a weekly update (Vercel Cron, Mondays at 17:00 India time). To switch it on:
  1. Create a bot with @BotFather.
  2. In Vercel, set `TELEGRAM_BOT_TOKEN`, `TELEGRAM_WEBHOOK_SECRET` (any long random string), `VITE_TELEGRAM_BOT` (the bot's username) and `CRON_SECRET`.
  3. For subscriptions, add a free Upstash Redis and set `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN`.
  4. Redeploy, then open `/api/telegram-setup?key=<TELEGRAM_WEBHOOK_SECRET>` once.
  - Code is in `src/server/`, bundled by `scripts/build_api.mjs` and tested with a fake Telegram and Redis in `scripts/api_checks.mjs`.
- **Live, worldwide:** the "Where it matters" page lists the areas where this week's NASA data shows burning later than usual. `scripts/build_live_world.mjs` runs the live check for the 6 presets and 57 supported countries every refresh, writing `public/data/live/world_live.json`. On 8–15 Nov 2026, 8 of the 48 testable areas showed later burning: Punjab + Haryana, Cerrado, Pakistan, the Republic of the Congo, India, Brazil, China and Paraguay.
- **Always current, no server:** `.github/workflows/live-data.yml` refreshes all live files every six hours and commits them, so a host that deploys on push (Vercel) serves fresh data.
- **Right now, this week:** the planner also compares NASA's latest seven-day fire files with the same calendar days in 2013–2025.
  - Aqua now crosses Punjab at about 4 pm. In the week of 8–15 Nov 2026 it recorded about 2.0 detections for every NOAA-20 detection at about 1:50 pm, against about 0.2 in 2013–2021.
  - The "Where to send teams this week" table pairs this week's fires with each district's check window.
  - Refresh with `python3 scripts/fetch_punjab_week.py`. It needs no API key.
- **For field teams, also:**
  - "Use my location" works out your district in the browser, so your location isn't sent anywhere;
  - a field card can be saved as an image for WhatsApp;
  - a calendar file (.ics) schedules the check windows;
  - season start, halfway and end dates by year;
  - a 90% day-resampling range on the count gap, plus a check that the two records agree at the hour the satellites pass.
- **One-page brief for your role:** every place report can download a printable brief (verdict, then actions, then numbers, then limits) or copy it as text.
- **Demo (7 slides):** [`public/docs/Burn_Clock_7_Slides_SpaceApps2026.pdf`](public/docs/Burn_Clock_7_Slides_SpaceApps2026.pdf) (earlier draft: [`Burn_Clock_Demo_7_Slides.pdf`](public/docs/Burn_Clock_Demo_7_Slides.pdf))
- **Case studies:** `#cases` in the app, built by [`scripts/build_case_studies.mjs`](scripts/build_case_studies.mjs) from the app's own verdicts.
- **AI use:** built with AI assistants (Anthropic Claude, OpenAI Codex). Every number is produced by code in this repository and checked by the tests below.

Context on Punjab: the reported count fell 93% (71,304 → 5,114). In the preliminary GK2A record, whole-afternoon unique pixel-days fell about a third from the 2021 peak, and 2025 was 2.14× 2019. These are different instruments, units and seasonal windows, not a corrected count of all fires. The shift was first reported by NASA (Jethva 2026), ISRO's Space Applications Centre and iFOREST; Burn Clock makes the same check available everywhere.

## 60-second quickstart

Requires Node.js 22+ and Python 3.10+; all application data ships in this repository.

```sh
npm ci
npm run dev
# Open the Local URL printed by Vite.
```

The latest uploaded design is implemented across `#home`, `#explorer`, `#claim`, `#receipt`, `#clock`, `#validation`, `#about` and `#brief`. See the [screen-by-screen mapping and scientific differences](public/docs/MOCK_IMPLEMENTATION.md).

Choose **Start here** for the five-step judge tour. Use the source pop-ups on numerical results, NASA verification links, shareable area/year/month/slider states, the policy brief, and API & reuse page.

## Reproduce and test

```sh
python3 -m pip install -r requirements-dev.txt
npx playwright install chromium
make reproduce
```

This single command verifies the shipped tile shapes, all interval/source flags and configuration hash; rebuilds independent Python references; runs unit and live-parser tests; builds the app; and checks the finite displayed numeric states and new product workflows in Chromium. It uses a temporary preview on port 4179. GitHub’s Integrity workflow runs it on each push and pull request, and stores the actual reports as artifacts. The badge reflects GitHub’s status, not a hard-coded pass.

**Scope:** `make reproduce` rebuilds the application’s reference calculations from the supplied precomputed outputs. It cannot recreate every upstream scientific result from raw observations: raw/Parquet intermediates, some global-atlas dependencies and the original contour generator were not supplied. Do not describe this as a complete raw-to-map scientific rerun.

Additional checks, against a running production preview:

```sh
BURN_CLOCK_URL=http://127.0.0.1:4173 node scripts/mock_product_checks.mjs
BURN_CLOCK_URL=http://127.0.0.1:4173 node scripts/release_browser_checks.mjs
# Run alone, without competing build/browser jobs:
BURN_CLOCK_URL=http://127.0.0.1:4173 node scripts/mock_product_checks.mjs
```

Reports in `public/qa/` and the Methods page identify the build/date and finite tested states. No real-person comprehension or task results have been invented. The [Sunday protocol](public/docs/USER_TEST_PROTOCOL.md) and blank results sheet remain ready for the team. Record real results, the top three confusions and a new-participant retest before reporting before/after improvements.

## Data, citation and reuse

The supplied release is dated 2026-11-14. Its scientific configuration fingerprint is `d0f62a55636f6def8856f4be39ec2b67bb79fd4fce96adf42234f297d98cec63`. The short display version identifies this configuration; release SHA-256 checksums identify the actual files. The historical archive processed 548,501,203 FIRMS rows and ends in December 2025.

- [CITATION.cff](CITATION.cff): provisional collective author; **no Burn Clock DOI has been issued**.
- `python3 scripts/prepare_zenodo.py`: prepares an upload package, metadata, original archive checksums and reproduction limits. A teammate must finalize authors, upload to Zenodo and insert the actual DOI.
- [Data contract](public/docs/DATA_CONTRACT.md), [source provenance](public/docs/DATA_PROVENANCE.md), [supplied validation report](public/docs/VALIDATION_REPORT.md).
- The app’s `#api` page documents static JSON URLs, gzip decoding, an iframe badge, CSV and GeoJSON downloads. The site is public, and a live JSON API (`/api/check`, `/api/punjab`) is documented on the same page.
- GIS contours use WGS84 and retain the supplied levels/palette. They are smoothed visualizations, not original measurements. NetCDF/GeoTIFF await the original grid.

## Live observations

`node scripts/fetch_live.mjs` retrieves NASA’s four public seven-day feeds, preserving stale values on failure and distinguishing a header-only feed from zero observations. NASA blocks direct browser reads through CORS. The GitHub six-hour workflow produces a fresh snapshot artifact; updating the hosted site still requires deploying that artifact. The visible panel always reports its saved snapshot time and does not mix provisional observations into the historical archive.

## Known limitations and actual failures

- The Punjab official count combines MODIS and VIIRS over 15 September–30 November; GK2A covers Punjab state in October–November. “93% at exactly 1:30 pm” is too specific for the official mixed-instrument count.
- GK2A is preliminary: coarse pixels, possible hot-smoke detections, hour-specific thresholds, and incomplete cloud/outage correction. No GOES/Americas receipt is present yet.
- Hotspots, cell-days, pixel-days and pixel-hours are observations, not individual fires, burned area or smoke emissions.
- Paraná and spatial transfer have documented validation weaknesses. Converted zero MODIS counts can have zero-width intervals despite undetected activity. See Validation for the actual errors.
- The latest contract references a revised addendum §1b that was not supplied. The two selected-month checks use a documented interpretation of the existing thresholds; see Methods for exact rules.
- The mock's complete 2019–25 hourly-share series is unavailable; only supplied 2021/2025 shares are plotted.
- Timing checks and country MODIS/S-NPP ratio change do not isolate a causal effect of orbit drift. Country ranking and rectangular explorer aggregation use different spatial/statistical definitions.
- Summed bounds are approximate, not a calibrated regional confidence interval. Missing coverage is never interpreted as zero burning.
- Annual detection-conditioned pass medians are converted to approximate civil time using a midpoint time zone and an explicit reference date. Large boxes can cross zones; the timezone lookup is approximate near borders. Source day assignment remains local-solar in the scientific archive.
- Automated accessibility, finite numeric checks and local speed measurements do not establish real-device percentiles, screen-reader usability or participant comprehension. Map/data loading can exceed the first-answer budget.
- External embedding depends on site sharing and host frame policy. The current audience remains owner-private.

## Licenses, credits and AI/SI disclosure

Original project code: [MIT](LICENSE). Derived data compilation: [CC BY 4.0](DATA_LICENSE.md), with upstream rights and attribution preserved. NASA FIRMS supplies MODIS/VIIRS observations; acknowledge the original missions/products. GK2A: Jethva, [Zenodo 20084790](https://zenodo.org/records/20084790), CC BY 4.0. Natural Earth basemap: public domain. MapLibre: BSD-3-Clause; React: MIT; timezone lookup: CC0-1.0; bundled fonts retain their license files.

Codex AI assistance was used to implement the application, documentation and automated checks. The supplied scientific pipeline was prepared separately with AI assistance according to the build brief. No human testing, independent raw-data rerun, NASA endorsement, DOI or competition submission is implied. See [CHANGELOG.md](CHANGELOG.md) for recorded iteration.

## Team

**Team Blackout:** Xavier Goff, Harshiv Puri and Otto Skibeli, for NASA Space Apps 2026. Built with AI assistance (Anthropic Claude, OpenAI Codex); the in-app advisor uses Claude.
