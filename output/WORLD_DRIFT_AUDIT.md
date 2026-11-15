# World satellite-ratio ranking audit

Generated 2026-11-15T01:52:33+00:00 from the supplied local files. No FIRMS reprocessing or external data download was performed.

Created [`world_drift_ranked.json`](/Users/ottoskibeli/Documents/ChatGPT/Burn Clock/burn-clock/public/data/world_drift_ranked.json) (22,774 bytes). It includes all 72 supplied country rows, with every original numerical field and support flag unchanged, plus an ordinal rank and the existing search bounds. All 72 countries matched bounds; 57 have the source’s `reliable` flag.

## What the metric means

The ranking uses **`bend_TA_pct`**, directly from `public/data/world/countries.json.gz`. It is `100 × (R_2025 / R_baseline − 1)`, where `R` is the regional sum of Terra+Aqua daytime detections divided by the regional sum of S-NPP daytime detections. The baseline pools 2013–2019. This is a **ratio of sums**, not the mean of annual ratios used by some area-level calendar clock diagnostics.

The atlas uses nominal/high-confidence **detections**, baseline-qualified 1° cells, and each cell’s top three S-NPP months from 2013–2019. A country needs at least three combined-ratio cells. The source’s `reliable` flag requires eight; it is a support flag, not proof of accuracy or causality.

Negative values mean Terra+Aqua saw relatively less than S-NPP than in the baseline; positive values mean relatively more. They do **not** measure the country’s change in burning, prove that drift caused the whole ratio change, or correct the harmonized calendar. The separate `artifact_2019_2025_pct` appears in the continent file and must not be substituted for this country metric.

Definition and calculation: [`pipeline/analysis/world.py:3`](/Users/ottoskibeli/Documents/ChatGPT/Burn Clock/burn-clock/pipeline/analysis/world.py:3), country output and support rule: [`world.py:66`](/Users/ottoskibeli/Documents/ChatGPT/Burn Clock/burn-clock/pipeline/analysis/world.py:66). The original source is already sorted by descending absolute `bend_TA_pct`; that order and tie order are preserved. Rank is only list position.

## Requested examples

| Country | Exact source value | Whole-percent display | Combined-ratio support cells |
|---|---:|---:|---:|
| China | -38.9% | -39% | 83 |
| Indonesia | -29.3% | -29% | 53 |
| United States | -24.0% | -24% | 88 |
| Nicaragua | +24.3% | +24% | 14 |
| Thailand | +15.8% | +16% | 33 |

All five proposed whole-percent examples match the supplied values when rounded. A defensible label is “Terra + Aqua / S-NPP ratio change, 2025 versus 2013–19”; avoid “fires fell X%” or “drift caused X% fewer fires.”

## Country bounds

Bounds are copied exactly from `public/maps/search.json` entries with `kind: country`. No geometry or metric was inferred. These six explicit aliases reconcile the source naming systems:

| Atlas country | Search country |
|---|---|
| Timor-Leste (TLS) | East Timor |
| United States (USA) | United States of America |
| Lao PDR (LAO) | Laos |
| DR Congo (COD) | Democratic Republic of the Congo |
| Côte d'Ivoire (CIV) | Ivory Coast |
| Tanzania (TZA) | United Republic of Tanzania |

Rectangular bounds, not administrative clipping; cells from neighbouring areas can be included. Bounds use south, west, north, east; west greater than east crosses the antimeridian. Opening a country’s rectangular box in the area explorer is **not** a recomputation of this administratively grouped atlas value; it can include neighboring areas, uses different units/support, and must not be described as the same statistic.

## Provenance footer values

| Field | Verified value | Meaning |
|---|---|---|
| FIRMS rows read | 548,501,203 | `manifest.totals.detections_processed`; sum of four available platform row totals |
| Archive count | 48 | `manifest.totals.archives` |
| Type-0 detections | 515,029,947 | Separate retained-count metric; do not relabel as rows read |
| Daytime active cell-days | 192,342,680 | Separate aggregated unit |
| Calendar span | 2000-11 → 2025-12 | Historical archive coverage |
| Manifest generation | `2026-11-14T22:33:10Z` | Data-manifest timestamp, not app build time |
| Validation generation | `2026-11-14T22:49:52Z` | Harmonization validation timestamp, not country atlas build time |
| Pipeline identifier | `nogit-sha256:5a32f188e9acc29f` | Content fingerprint of sorted top-level `pipeline/*.py`; not a Git commit |
| Locked method hash | `d0f62a55636f6def8856f4be39ec2b67bb79fd4fce96adf42234f297d98cec63` | SHA-256 of canonical JSON for `CONFIG.yaml`’s `method` block |
| Method lock time | `2026-11-14T21:54:54Z` | From `pipeline/harmonize/CONFIG.lock` |

Recomputed the method hash using the implementation in `pipeline/harmonize/common.py`; it matches both `CONFIG.lock` and `validation.json`. Recomputed the top-level pipeline fingerprint using `build_public.py:44`; it matches the manifest identifier. The four available platform row totals sum exactly to 548,501,203. NOAA-21 has zero rows in this archive.

The country JSON contains no own generation timestamp. Do not invent one from manifest or validation timestamps. The app’s deployment/build date, if shown, must come from the app’s build metadata.

## Checks and limits

- Readback preserved all 792 original country field values exactly, including null platform-specific metrics.
- All 72 ISO3 identifiers are unique. All bounds match the search asset exactly and pass coordinate/antimeridian validation.
- All rankings preserve the supplied order; support flags match the pipeline’s ≥8-cell rule.
- The new JSON records SHA-256 values for the seven input/source files used here.
- This audit validates asset construction and source semantics. It does not independently rerun the atlas’s unavailable Parquet inputs or certify a causal drift estimate.
