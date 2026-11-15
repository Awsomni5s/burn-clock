# Burn Clock

[![Integrity](https://github.com/Awsomni5s/burn-clock/actions/workflows/integrity.yml/badge.svg)](https://github.com/Awsomni5s/burn-clock/actions/workflows/integrity.yml)

Check a fire trend, see when satellites observed it, and carry the source and limitations into a shareable receipt. [Open Burn Clock](https://burn-clock.vercel.app/) (public, no login).

Punjab’s reported count fell 93% (71,304 → 5,114). In the supplied preliminary GK2A record, whole-afternoon unique pixel-days fell about a third from the 2021 peak; 2025 was 2.14× 2019. At 5 pm, 2025 pixel-hours were 1.40× 2021, and the share at 4 pm or later rose from about 52% to 96%. These are different instruments, units and seasonal windows—not a corrected count of all fires.

## 60-second quickstart

Requires Node.js 22+ and Python 3.10+; all application data ships in this repository.

```sh
npm ci
npm run dev
# Open the Local URL printed by Vite.
```

Choose **Start here** for the four-step judge tour. Use the source pop-ups on numerical results, NASA verification links, shareable area/year/month/slider states, the policy brief, and API & reuse page.

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
BURN_CLOCK_URL=http://127.0.0.1:4173 node scripts/addendum_product_checks.mjs
BURN_CLOCK_URL=http://127.0.0.1:4173 node scripts/release_browser_checks.mjs
# Run alone, without competing build/browser jobs:
BURN_CLOCK_URL=http://127.0.0.1:4173 node scripts/polish_performance_checks.mjs
```

Reports in `public/qa/` and the Methods page identify the build/date and finite tested states. No real-person comprehension or task results have been invented. The [Sunday protocol](public/docs/USER_TEST_PROTOCOL.md) and blank results sheet remain ready for the team. Record real results, the top three confusions and a new-participant retest before reporting before/after improvements.

## Data, citation and reuse

The supplied release is dated 2026-11-14. Its scientific configuration fingerprint is `d0f62a55636f6def8856f4be39ec2b67bb79fd4fce96adf42234f297d98cec63`. The short display version identifies this configuration; release SHA-256 checksums identify the actual files. The historical archive processed 548,501,203 FIRMS rows and ends in December 2025.

- [CITATION.cff](CITATION.cff): provisional collective author; **no Burn Clock DOI has been issued**.
- `python3 scripts/prepare_zenodo.py`: prepares an upload package, metadata, original archive checksums and reproduction limits. A teammate must finalize authors, upload to Zenodo and insert the actual DOI.
- [Data contract](public/docs/DATA_CONTRACT.md), [source provenance](public/docs/DATA_PROVENANCE.md), [supplied validation report](public/docs/VALIDATION_REPORT.md).
- The app’s `#api` page documents static JSON URLs, gzip decoding, an iframe badge, CSV and GeoJSON downloads. The site is public; the live JSON API is documented on the same page.
- GIS contours use WGS84 and retain the supplied levels/palette. They are smoothed visualizations, not original measurements. NetCDF/GeoTIFF await the original grid.

## Live observations

`node scripts/fetch_live.mjs` retrieves NASA’s four public seven-day feeds, preserving stale values on failure and distinguishing a header-only feed from zero observations. NASA blocks direct browser reads through CORS. The GitHub six-hour workflow produces a fresh snapshot artifact; updating the hosted site still requires deploying that artifact. The visible panel always reports its saved snapshot time and does not mix provisional observations into the historical archive.

## Known limitations and actual failures

- The Punjab official count combines MODIS and VIIRS over 15 September–30 November; GK2A covers Punjab state in October–November. “93% at exactly 1:30 pm” is too specific for the official mixed-instrument count.
- GK2A is preliminary: coarse pixels, possible hot-smoke detections, hour-specific thresholds, and incomplete cloud/outage correction. No GOES/Americas receipt is present yet.
- Hotspots, cell-days, pixel-days and pixel-hours are observations, not individual fires, burned area or smoke emissions.
- Paraná and spatial transfer have documented validation weaknesses. Converted zero MODIS counts can have zero-width intervals despite undetected activity. See Validation for the actual errors.
- A timing badge and country MODIS/S-NPP ratio change do not isolate a causal effect of orbit drift. Country ranking and rectangular explorer aggregation use different spatial/statistical definitions.
- Summed bounds are approximate, not a calibrated regional confidence interval. Missing coverage is never interpreted as zero burning.
- Annual detection-conditioned pass medians are converted to approximate civil time using a midpoint time zone and an explicit reference date. Large boxes can cross zones; the timezone lookup is approximate near borders. Source day assignment remains local-solar in the scientific archive.
- Automated accessibility, finite numeric checks and local speed measurements do not establish real-device percentiles, screen-reader usability or participant comprehension. Map/data loading can exceed the first-answer budget.
- External embedding depends on the host frame policy. The site is public.

## Licenses, credits and AI/SI disclosure

Original project code: [MIT](LICENSE). Derived data compilation: [CC BY 4.0](DATA_LICENSE.md), with upstream rights and attribution preserved. NASA FIRMS supplies MODIS/VIIRS observations; acknowledge the original missions/products. GK2A: Jethva, [Zenodo 20084790](https://zenodo.org/records/20084790), CC BY 4.0. Natural Earth basemap: public domain. MapLibre: BSD-3-Clause; React: MIT; timezone lookup: CC0-1.0; bundled fonts retain their license files.

Codex AI assistance was used to implement the application, documentation and automated checks. The supplied scientific pipeline was prepared separately with AI assistance according to the build brief. No human testing, independent raw-data rerun, NASA endorsement, DOI or competition submission is implied. See [CHANGELOG.md](CHANGELOG.md) for recorded iteration.
