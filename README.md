# Burn Clock

Site address: [Burn Clock](https://burn-clock.ottoskibeli.chatgpt.site) (owner-private; publication status is recorded by Sites).

A static satellite observatory for harmonized burning-activity calendars and changing satellite look times. Built from the supplied November 14, 2026 pipeline and public-data bundle.

This directory contains the application. It uses React, TypeScript, MapLibre and Vite, with no application backend. The two supplied pipeline archives are byte-identical; one was imported.

## Run locally

```sh
npm ci
npm run dev
```

Open the local URL printed by Vite. `npm run build` produces the static `dist/` directory; `npm run preview` serves that output locally.

## Working features

- Worldwide rectangular area selection by presets, map drawing or coordinates, including date-line crossings.
- Month × year calendar, harmonized/raw/anomaly modes, keyboard navigation, cell values and source provenance.
- CSV downloads with raw platform counts, harmonized estimates, approximate bounds, annual clock badge, source codes and satellites.
- Annual area clock diagnostic, measured look-time wheel and global clock maps with searchable country table.
- Punjab receipt with changing base years, matched/unmasked comparisons and hourly GK2A ratios.
- Validation dashboard showing both model scores, locked years, spatial holdouts, denial tests, seams, same-day pairs and known failures.
- Methods, source audit, complete data provenance, competitor comparison, methods PDF and seven-slide overview.

## What the data contain

The supplied manifest records **548,501,203 rows**, **48 archives**, **515,029,947 type-0 detections** and **192,342,680 daytime active cell-days**. Observations span November 2000–December 2025. Terra, Aqua, S-NPP and NOAA-20 are present. NOAA-21 and 2026 observations are absent.

The app retains the supplied final scientific numbers. It does not rerun the heavy FIRMS archive, refit models or fabricate missing results. The intermediate Parquet inputs needed for a full scientific rerun were not supplied. The report's model winner is the pre-drift ratio bridge; the GBM lost on the registered tile-year metric.

`../public/data/` in the original workspace contains the extracted data (not included in this source checkout). `public/data/` contains deterministic gzip copies for serving. The supplied manifest's empty-harmonization and size notes are stale; the final tile arrays are populated. A separate generated catalog records current packaged sizes without editing the scientific manifest.

## Verification

```sh
npm test
npm run build
python3 scripts/audit_data.py
npx playwright install chromium --only-shell
node scripts/browser_checks.mjs
```

The browser checks require the dev server at `http://127.0.0.1:5173` or `BURN_CLOCK_URL` set to another running preview. Data auditing requires the original sibling `public/data/` directory. `scripts/prepare_data.py` rebuilds the gzip serving package from that directory without rerunning the scientific pipeline.

The complete tile audit checks 1,237 tiles, 191,187 cells and 57,738,474 cell-months. Every gzip copy matches the original JSON byte-for-byte; there are zero interval/source violations. See `data-audit.json`, `browser-checks.json` and the test suite for reproducible checks. One original NASA archive was independently downloaded and verified; the other 47 were reconciled against the supplied processing manifest, not redownloaded.

## Interpretation

Hotspots and active cell-days are not unique fires, burned area or emissions. Missing is distinct from zero. Summed cell uncertainty endpoints are approximate bounds, not a calibrated 90% area interval. A clock-sensitive badge is an observation-ratio diagnostic, not proof of a single cause. World-atlas detection units differ from the calendar's cell-days. The Punjab state October–November receipt differs from the larger Punjab + Haryana preset and its per-cell top-three-month annual fire seasons.

AI assistance (Codex) was used for the app, documentation and checks. The supplied research pipeline was produced separately with AI assistance according to the build brief. This is an independent project using NASA data, not a NASA endorsement.

## Source and credits

Read [DATA_PROVENANCE.md](public/docs/DATA_PROVENANCE.md), [VALIDATION_REPORT.md](public/docs/VALIDATION_REPORT.md), [SOURCE_AUDIT.md](public/docs/SOURCE_AUDIT.md), [COMPETITOR_DIFFERENTIATION.md](public/docs/COMPETITOR_DIFFERENTIATION.md) and [JUDGE_DEMO.md](public/docs/JUDGE_DEMO.md). The deployed app also exposes these under `/docs/`.

NASA FIRMS supplies MODIS and VIIRS observations. GK2A data: Jethva, Zenodo 20084790, CC BY 4.0. MapLibre: BSD 3-Clause; React: MIT; fonts DM Sans and Manrope: SIL Open Font License with license files included. Geographic base layers © Natural Earth, public domain; map glyphs from the MapLibre demo font collection. No competitor code was copied.
