# Burn Clock product evidence audit

Recorded 2026-11-15 00:19 UTC (2026-11-14 in America/New_York). This is a supplement to `SOURCE_AUDIT.md`, not a replacement.

The proposed Punjab figures are reproducible with the units and windows below. The official 93% decline is a reported-incident statistic. The GK2A results describe a separate research dataset; they do not estimate the true total of all fires, burned area, or emissions.

## Verification scope

- Read `public/data/punjab_receipt.json.gz` (supplied generation timestamp: `2026-11-14T21:52:36Z`) and `pipeline/analysis/punjab_receipt.py`.
- Independently downloaded the original Zenodo Punjab files for **2019, 2021, and 2025** into memory using HTTPS with normal certificate verification. Their MD5s match the publisher's file listing.
- Recomputed confidence ≥2 hourly observation counts and unique pixel-days from those three text files. Every corresponding receipt value matched.
- Recomputed the arithmetic below from integer counts rather than rounded ratios. Checked the official reported counts and monitoring window against PIB releases.
- Did **not** rerun the full FIRMS ingestion, harmonization, outage detection, or scientific pipeline. Did not independently reproduce the polar-platform cell-days or reconstruct the official incident-deduplication protocol. The other four GK2A years were not independently downloaded in this audit.
- Original downloaded GK2A bytes were processed in memory, not retained as new workspace files. No app code or supplied data was changed.

## Original files and checksums

Publisher: [Hiren Jethva, Zenodo record 20084790](https://zenodo.org/records/20084790), version v1, published **12 May 2026**. The record covers October–November 2019–2025. Its MD5s identify the published files; they are not a scientific accuracy certification.

| Original file and URL | Bytes | Verified MD5 | All data rows | Rows with confidence ≥2 | Unique pixel-days, confidence ≥2 |
|---|---:|---|---:|---:|---:|
| [GK2-AMI_FireHotspotsData_2019_10-11_Punjab_India_v1.txt](https://zenodo.org/records/20084790/files/GK2-AMI_FireHotspotsData_2019_10-11_Punjab_India_v1.txt?download=1) | 1,358,286 | `1beebcf93173f2a9edf21903ec0c9be7` | 20,887 | 10,461 | 7,527 |
| [GK2-AMI_FireHotspotsData_2021_10-11_Punjab_India_v1.txt](https://zenodo.org/records/20084790/files/GK2-AMI_FireHotspotsData_2021_10-11_Punjab_India_v1.txt?download=1) | 4,460,606 | `4aa3f33714b8d0ddc4775862ea8f4f3c` | 68,615 | 39,361 | 24,447 |
| [GK2-AMI_FireHotspotsData_2025_10-11_Punjab_India_v1.txt](https://zenodo.org/records/20084790/files/GK2-AMI_FireHotspotsData_2025_10-11_Punjab_India_v1.txt?download=1) | 2,150,441 | `7b0993173bf0ca5260ad9ede2fee672b` | 33,074 | 19,392 | 16,096 |

## Definitions and exact calculations

**Population and window:** Punjab state, October 1–November 30, observations at 12:00, 13:00, 14:00, 15:00, 16:00, 17:00, and 18:00 Indian Standard Time (IST), confidence flag ≥2. All timestamps in the three selected raw files are at minute 00. These observations are not continuous all-day coverage.

**Pixel-hours:** one qualifying pixel observation at one of those hourly timestamps. The same pixel can contribute at several hours on the same day. This unit weights repeated observations; it is not a count of distinct fire events or a measurement of exact burning duration.

**Unique pixel-days:** deduplicate by `(longitude rounded to 4 decimal places, latitude rounded to 4 decimal places, IST date)`, matching the supplied analysis. A pixel contributes at most once per day across the 12:00–18:00 observations. This reduces repeated-observation weighting, but it still does not identify distinct fires.

The following GK2A counts are **unmasked**. Detection-only files cannot separate missing observations caused by outages from cloud or absence of detected activity.

| IST observation | 2019 pixel-hours | 2021 pixel-hours | 2025 pixel-hours |
|---|---:|---:|---:|
| 12:00 | 114 | 174 | 38 |
| 13:00 | 1,401 | 2,670 | 120 |
| 14:00 | 1,983 | 5,918 | 91 |
| 15:00 | 3,274 | 10,164 | 489 |
| 16:00 | 1,889 | 10,795 | 4,395 |
| 17:00 | 806 | 8,461 | 11,858 |
| 18:00 | 994 | 1,179 | 2,401 |
| **Total** | **10,461** | **39,361** | **19,392** |

| Proposed claim | Exact calculation | Result | Receipt field |
|---|---|---|---|
| Official reported decline, 2021→2025 | `100 × (1 − 5114 / 71304)` | **92.8279%**, rounded **93%** | `claim_source.value_2021`, `claim_source.value_2025` |
| GK2A 17:00 observation ratio, 2025/2021 | `11858 / 8461` | **1.40149×** | `gk2a_by_hour.pixel_hours_2025[5]` and `pixel_hours_2021[5]`; hour selected from `hours` |
| Whole-window unique pixel-day ratio, 2025/2021 | `16096 / 24447` | **0.658404×**; **34.1596% lower** | `gk2a_unique_pixel_days["2025"]`, `["2021"]` |
| Whole-window unique pixel-day ratio, 2025/2019 | `16096 / 7527` | **2.13843×**; about twice the 2019 count | `gk2a_unique_pixel_days["2025"]`, `["2019"]` |
| Late-hour share, 2025 | `(4395 + 11858 + 2401) / 19392` | **96.1943%** | Sum `gk2a_by_hour.pixel_hours_2025` for `hours ∈ {16,17,18}`, divided by all seven hours |
| Late-hour share, 2021 | `(10795 + 8461 + 1179) / 39361` | **51.9169%** | Same calculation using `pixel_hours_2021` |

The late-hour statistic is a **share within each year's hourly observations**, not a 2025/2021 ratio. The 17:00 statistic is a **ratio between years at one observation time**, not a share. They must not share a label or denominator.

Use **“at 16:00–18:00 IST”**, including 16:00. Strictly **after 16:00** would include only 17:00 and 18:00: `14259 / 19392 = 73.5303%` in 2025 and `9640 / 39361 = 24.4912%` in 2021. That is a different statistic. The 18:00 observation has particular threshold/sunset caveats; excluding it gives a separate sensitivity comparison of **95.6565% versus 50.4321%** for 16:00–17:00 among 12:00–17:00 observations. Do not silently substitute that window.

### The baseline fan uses a different mask

`base_year_fan` excludes the union of S-NPP and NOAA-20 flagged calendar days in the baseline and 2025, applying those same exclusions to GK2A. Its ratios are therefore not the unmasked ratios above:

| Baseline | Supplied matched-day calculation | Displayed ratio |
|---|---|---:|
| 2021 | `14190 / 22323` | **0.636×** |
| 2019 | `11745 / 6801` | **1.727×** |

These integer counts and mask definitions were read from the receipt and source code; the underlying FIRMS outage rule was **not independently rerun**. Do not pair the masked 1.727× result with an unmasked “2.14×” label, or describe either ratio as a correction for all GK2A outages/cloud.

## The official 93% is not a single-clock statistic

[PIB, 30 November 2023](https://pib.gov.in/PressReleasePage.aspx?PRID=1981276), reports **71,304** Punjab incidents for 2021. [PIB, 1 December 2025](https://www.pib.gov.in/PressReleseDetailm.aspx?PRID=2197201&lang=2&reg=3), reports **5,114** for 2025 and a rounded **93% reduction**. Both describe the official **September 15–November 30** monitoring season under the ISRO protocol. These releases verify what was officially reported, not the true number of every fire.

The receipt's `claim_source.window` identifies a **Terra/Aqua MODIS + S-NPP VIIRS** mixture, and `assumptions[1]` explicitly warns against treating it as a single-clock number. An [official ICAR-IARI/CREAMS bulletin dated 21 May 2026](https://creams.iari.res.in/Creams_website_bulletin/Fire_bulletin_2026/Fire_bulletin_2026w/51.WheatResidueFireBulletin_21May_2026_ICAR.pdf) lists those three platforms, with day and night passes, as its input sources. This later wheat-season bulletin corroborates the mixed-platform monitoring approach; it is not a reconstruction of the 2025 paddy-season protocol. The CAQM protocol PDF URL returned an accessibility page during this audit, so its complete annex was not independently retrieved.

**Do not publish:** “The 93% is a 1:30 p.m. number.” It wrongly reduces a mixed-platform seasonal count to one observation time. It also obscures the official September–November versus receipt October–November window difference. The receipt's polar rows are **daytime active 0.05° cell-days**, a further difference from official incident counts.

## A clock-sensitive Aqua badge does not establish the true decline

The receipt's `verdict_rule` compares `ln(Aqua / S-NPP)` or `ln(Terra / S-NPP)` with the 2013–2019 baseline. It flags a departure beyond the stated threshold when sample-size gates are met. For 2025, Aqua is evaluable and exceeds the threshold; Terra is too sparse. This identifies an unstable inter-platform relationship. It does not by itself identify the cause, determine the sign or size of bias in VIIRS, or measure a ground-truth decline.

**Do not implement as a logical rule:** “Aqua is sensitive, therefore VIIRS declines overstate the real drop.” Aqua's changing overpass time, changing burn timing, detection differences, cloud and sampling can affect the ratio. Independent GK2A observations support a shift toward later detected activity; they do not convert the badge into a calibrated estimate of the true reduction.

[Jethva, *Timing the Flames*, published 11 May 2026](https://www.mdpi.com/2072-4292/18/10/1506), describes the GK2A product as research detection of fires and hot-smoke hotspots with possible false positives and false negatives. Its footprint is about 4 km over the region, and thresholds vary by hour, including distinct 18:00 conditions. Cross-instrument counts are not directly interchangeable. These limitations preclude relabeling the 34.16% pixel-day reduction as “the real decline in fires.”

## Recommended product copy

- **Headline:** “Punjab reported 93% fewer fire incidents. Later observations show why satellite timing matters.”
- **17:00 metric:** “At 17:00 IST, GK2A recorded 1.40× as many qualifying pixel observations in 2025 as in 2021.”
- **Whole-afternoon metric:** “Across 12:00–18:00 IST, unique detected pixel-days fell 34% from 2021.”
- **Baseline comparison:** “The same unmasked measure was 2.14× its 2019 value.”
- **Late-hour comparison:** “Share of GK2A pixel-hours at 16:00–18:00 IST: 96% in 2025 versus 52% in 2021.”
- **Badge explanation:** “Clock-sensitive: the changing Aqua/S-NPP relationship makes a single trend hard to interpret. Independent GK2A observations show a shift toward late afternoon.”
- **Shared footnote:** “Punjab, October–November; GK2A confidence ≥2; unmasked research observations. Pixel observations and pixel-days are not distinct fires, burned area, or emissions. Official counts use a different window and method.”

All linked sources above were checked during this product audit. The result is an evidence and wording check of a historical record ending in 2025, not live 2026 fire coverage.
