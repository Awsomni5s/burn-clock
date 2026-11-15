# Burn Clock: data provenance

This application is built from the user-supplied data and pipeline archives dated 14 November 2026. The manifest is the supplied ingestion record; it is not a statement that this app build independently downloaded all source data. The full scientific pipeline was not rerun because its intermediate Parquet inputs are not in the delivered workspace.

## Supplied products and units

| Product | Coverage and unit | Provenance |
| --- | --- | --- |
| Calendar tiles | November 2000–December 2025; 302 months; 0.25° display cells containing active 0.05° cell-days | `public/data/tiles/`, generated from FIRMS type-0 detections at all confidence levels; daytime only |
| Satellite clocks | 2013–2025; 1° cells; fire-season daytime/nighttime cell-days and local solar look times | `public/data/clock/`; season is the top three S-NPP months from 2013–2019 |
| World atlas | Country/continent diagnostics, principally 2025 | `public/data/world/`; supplied detection-based analysis using nominal/high-confidence detections; a different unit from the calendar |
| Punjab receipt | October–November, primarily 2025 against 2021, with other base years | `public/data/punjab_receipt.json`; FIRMS polar cell-days plus GK2A pixel-hours/pixel-days |
| Validation | Supplied model selection, temporal/spatial holdouts and satellite-denial tests | `public/data/validation.json`, `VALIDATION_REPORT.md`, and `pipeline/harmonize/` |

An active cell-day is one 0.05° cell with at least one qualifying detection on a local solar day, per platform. It is not a count of unique fires. All raw platform values share that definition; the harmonized layer is expressed on the S-NPP VIIRS scale. Platform codes are T = Terra MODIS, A = Aqua MODIS, N = S-NPP VIIRS, J1 = NOAA-20 VIIRS, and J2 = NOAA-21 VIIRS.

## Reported ingestion totals

The supplied manifest records 548,501,203 input rows before de-duplication, including 515,029,947 type-0 rows. It reports 226 exact type-0 duplicate rows removed, 192,342,680 daytime active cell-days in the contract range, and 36,715,213 nighttime active cell-days. The input files contain other types and confidence levels; the 548.5 million headline is a processed-row count, not the number of fires or displayed cell-days.

| Platform | All input rows | Daytime active cell-days in contract range |
| --- | ---: | ---: |
| Terra MODIS | 39,682,127 | 18,650,980 |
| Aqua MODIS | 71,742,290 | 41,463,177 |
| S-NPP VIIRS | 281,144,514 | 84,657,777 |
| NOAA-20 VIIRS | 155,932,272 | 47,570,746 |
| NOAA-21 VIIRS | 0 | 0 |

These totals were checked for internal consistency with the 48 source entries and detailed per-CSV manifest, not recomputed from all raw records. One source archive, MODIS 2000, was independently downloaded, hashed and counted during this app build; its 4,658,057 bytes, SHA-256 and 261,363 rows all matched. See [SOURCE_AUDIT.md](SOURCE_AUDIT.md).

The inventory comprises 26 MODIS archives (2000–2025), 14 S-NPP archives (2012–2025), and eight NOAA-20 archives (2018–2025). Their recorded downloaded sizes sum to 9,751,298,609 bytes, and row counts sum to 548,501,203 across 10,095 CSVs. These archive bytes are not the size of the web application's data bundle.

## Complete 48-source inventory

The following table was generated directly from `public/data/manifest.json`, retaining each complete URL and SHA-256. Except for the marked MODIS 2000 spot check, hashes, bytes and rows are supplied pipeline records, not independently reverified downloads. Row counts exclude CSV headers and include all input types/confidences.

| # | Source URL | Bytes | SHA-256 | Rows |
| ---: | --- | ---: | --- | ---: |
| 1 | [FIRMS modis 2000 (all countries)](https://firms.modaps.eosdis.nasa.gov/data/country/zips/modis_2000_all_countries.zip) | 4,658,057 | `569669636fd149a5cbc41a9c77bef994c20a700e17011940046f12e69cf977a2` | 261,363 |
| 2 | [FIRMS modis 2001 (all countries)](https://firms.modaps.eosdis.nasa.gov/data/country/zips/modis_2001_all_countries.zip) | 31,545,201 | `583d617aa3cf2c51971c4600c3a402c800047a861457f8ec5efad268b4304a5b` | 1,769,987 |
| 3 | [FIRMS modis 2002 (all countries)](https://firms.modaps.eosdis.nasa.gov/data/country/zips/modis_2002_all_countries.zip) | 65,275,966 | `c6e0de8fc78daffdb10097cb2fcc7ab163b903839440a240144816db75ac6476` | 3,699,859 |
| 4 | [FIRMS modis 2003 (all countries)](https://firms.modaps.eosdis.nasa.gov/data/country/zips/modis_2003_all_countries.zip) | 90,378,077 | `a199e68b9d4beacba7b527e7e9111f162e329f1de7f582c9966d4f1dcdb4f9f3` | 5,149,401 |
| 5 | [FIRMS modis 2004 (all countries)](https://firms.modaps.eosdis.nasa.gov/data/country/zips/modis_2004_all_countries.zip) | 89,357,956 | `8b0af457b85c0831e996b172520b30c97db005704b1dbe45953e4e965cd1ac07` | 5,092,534 |
| 6 | [FIRMS modis 2005 (all countries)](https://firms.modaps.eosdis.nasa.gov/data/country/zips/modis_2005_all_countries.zip) | 89,941,181 | `0beba8973ae3f0abd6556a44b7d1974f9a8d5b3d8af5cd43394ce803ccbedc28` | 5,125,152 |
| 7 | [FIRMS modis 2006 (all countries)](https://firms.modaps.eosdis.nasa.gov/data/country/zips/modis_2006_all_countries.zip) | 82,443,496 | `732206f60d73d92fd294dea01ad149da1dfe92536136b80f562b43a3df0d79bd` | 4,688,046 |
| 8 | [FIRMS modis 2007 (all countries)](https://firms.modaps.eosdis.nasa.gov/data/country/zips/modis_2007_all_countries.zip) | 90,015,477 | `98789eb5e0ad509d96908cb173845648a4e9f122519006c461870fb48adca5c0` | 5,134,642 |
| 9 | [FIRMS modis 2008 (all countries)](https://firms.modaps.eosdis.nasa.gov/data/country/zips/modis_2008_all_countries.zip) | 84,590,452 | `141ca567bc38537c8888206bdfa04202836607b6f17fd2017945d1900ca4e8fa` | 4,818,997 |
| 10 | [FIRMS modis 2009 (all countries)](https://firms.modaps.eosdis.nasa.gov/data/country/zips/modis_2009_all_countries.zip) | 78,288,906 | `b60e69f721b962d681aa5e02e50ff574bf3ac81857b41aad347407182baf5c2c` | 4,456,446 |
| 11 | [FIRMS modis 2010 (all countries)](https://firms.modaps.eosdis.nasa.gov/data/country/zips/modis_2010_all_countries.zip) | 82,694,466 | `2c33683a2acab74efdef433c573d3342b7876eb1dc5d39318e833795fbf22999` | 4,715,142 |
| 12 | [FIRMS modis 2011 (all countries)](https://firms.modaps.eosdis.nasa.gov/data/country/zips/modis_2011_all_countries.zip) | 82,526,410 | `c26c94231b37745a73821a5a6ca60629f20c5e53b35122a8935a632de5b015f4` | 4,699,314 |
| 13 | [FIRMS modis 2012 (all countries)](https://firms.modaps.eosdis.nasa.gov/data/country/zips/modis_2012_all_countries.zip) | 87,107,469 | `73fc214cdeb6dd924272b4bb9f34f80b90cda14b007f484a5dd3c4768e917386` | 4,959,509 |
| 14 | [FIRMS modis 2013 (all countries)](https://firms.modaps.eosdis.nasa.gov/data/country/zips/modis_2013_all_countries.zip) | 74,279,102 | `75047fa996f73eaa3608250da171a2af445992aebad9ee5bbe8ce5cf532ac79d` | 4,226,648 |
| 15 | [FIRMS modis 2014 (all countries)](https://firms.modaps.eosdis.nasa.gov/data/country/zips/modis_2014_all_countries.zip) | 77,920,777 | `4c07401117af1cde8c2ede482152b030669a0bff76a077dd9b8b4c36341bf853` | 4,434,374 |
| 16 | [FIRMS modis 2015 (all countries)](https://firms.modaps.eosdis.nasa.gov/data/country/zips/modis_2015_all_countries.zip) | 83,177,469 | `9a48028c03a79ed4fb7f6a807dfe42458b070f437a92716cf300cd3f4454150f` | 4,741,228 |
| 17 | [FIRMS modis 2016 (all countries)](https://firms.modaps.eosdis.nasa.gov/data/country/zips/modis_2016_all_countries.zip) | 77,490,915 | `a43708defea6302f9bcaed1bb8172d39778f856be2bbf1adf61cdcb724b1a09d` | 4,415,910 |
| 18 | [FIRMS modis 2017 (all countries)](https://firms.modaps.eosdis.nasa.gov/data/country/zips/modis_2017_all_countries.zip) | 78,290,700 | `d8725fc74e3587abb8679a828a39cc2431902bf99509f372ec5ce0c24200ef05` | 4,453,181 |
| 19 | [FIRMS modis 2018 (all countries)](https://firms.modaps.eosdis.nasa.gov/data/country/zips/modis_2018_all_countries.zip) | 73,887,176 | `a9c0db7b8b022eeb0186c25ae8deec4d3ed5e70ed71c125b83c9b59d292b532a` | 4,184,262 |
| 20 | [FIRMS modis 2019 (all countries)](https://firms.modaps.eosdis.nasa.gov/data/country/zips/modis_2019_all_countries.zip) | 80,447,291 | `13a581b5d6b28741c81bf01bd27195cf3226b85a29102337f2cd3b2cabf1a517` | 4,578,188 |
| 21 | [FIRMS modis 2020 (all countries)](https://firms.modaps.eosdis.nasa.gov/data/country/zips/modis_2020_all_countries.zip) | 77,958,638 | `bb4c7012b8f4d89dbf24da49143c4cecbaef90cc5f504433642189201d6c0ddb` | 4,440,623 |
| 22 | [FIRMS modis 2021 (all countries)](https://firms.modaps.eosdis.nasa.gov/data/country/zips/modis_2021_all_countries.zip) | 77,277,752 | `3bef964afea2d29506ede25b2299a478fa7d96a06b93bc7fc20297794979710e` | 4,384,343 |
| 23 | [FIRMS modis 2022 (all countries)](https://firms.modaps.eosdis.nasa.gov/data/country/zips/modis_2022_all_countries.zip) | 66,472,304 | `99b365825aa9df0638e64006af7ecadc38ccc7c14bb91bc7b16aa541be8377a0` | 3,789,164 |
| 24 | [FIRMS modis 2023 (all countries)](https://firms.modaps.eosdis.nasa.gov/data/country/zips/modis_2023_all_countries.zip) | 81,766,470 | `1fdd2cb87c6303dd609e2aa197e5d0ec5057921e240db51fed2f24b6d971a2e4` | 4,664,302 |
| 25 | [FIRMS modis 2024 (all countries)](https://firms.modaps.eosdis.nasa.gov/data/country/zips/modis_2024_all_countries.zip) | 84,548,676 | `034f357da2022202fec7c4a2916e4128f29536cc1578aef9b04bbf7fd6901389` | 4,848,247 |
| 26 | [FIRMS modis 2025 (all countries)](https://firms.modaps.eosdis.nasa.gov/data/country/zips/modis_2025_all_countries.zip) | 64,771,492 | `e4dfcfe082422625aa858c8fb0672eb8b3d0b881f3cc4b6960a85a7666ca9ab7` | 3,693,555 |
| 27 | [FIRMS viirs-jpss1 2018 (all countries)](https://firms.modaps.eosdis.nasa.gov/data/country/zips/viirs-jpss1_2018_all_countries.zip) | 259,896,539 | `a700e10e05a7f98bfba5c1f2e71d2c5fabd3d966961b893c22da0919edec6795` | 14,524,817 |
| 28 | [FIRMS viirs-jpss1 2019 (all countries)](https://firms.modaps.eosdis.nasa.gov/data/country/zips/viirs-jpss1_2019_all_countries.zip) | 370,806,690 | `57b710c98b70defbd4bf28304704adbdb64a9621f54fac651908556c71204320` | 20,742,304 |
| 29 | [FIRMS viirs-jpss1 2020 (all countries)](https://firms.modaps.eosdis.nasa.gov/data/country/zips/viirs-jpss1_2020_all_countries.zip) | 365,551,116 | `3ef226fc817647c1f5c276eaaf732a8bf1b2fbcf0c89eecd7d8ca0ee81aa8325` | 20,385,806 |
| 30 | [FIRMS viirs-jpss1 2021 (all countries)](https://firms.modaps.eosdis.nasa.gov/data/country/zips/viirs-jpss1_2021_all_countries.zip) | 358,433,386 | `875468c497227aad8fbe9c6967c9eb05e5a37a2255085a26ef9748b65f48202e` | 20,059,802 |
| 31 | [FIRMS viirs-jpss1 2022 (all countries)](https://firms.modaps.eosdis.nasa.gov/data/country/zips/viirs-jpss1_2022_all_countries.zip) | 324,844,239 | `e6144d08da0a2c2dfb4acb989b89c68193c2207881eaba6a92b9663e1e1dc224` | 18,043,578 |
| 32 | [FIRMS viirs-jpss1 2023 (all countries)](https://firms.modaps.eosdis.nasa.gov/data/country/zips/viirs-jpss1_2023_all_countries.zip) | 379,557,198 | `644215a51e5acdd1834376be5730371471dd7beb5e1b2a5e722d8dd44c39c2f6` | 21,288,380 |
| 33 | [FIRMS viirs-jpss1 2024 (all countries)](https://firms.modaps.eosdis.nasa.gov/data/country/zips/viirs-jpss1_2024_all_countries.zip) | 401,156,384 | `43a49b1d5ffd7607662c936909fa4761af3b382976145e2cfa86563a252e585c` | 22,511,092 |
| 34 | [FIRMS viirs-jpss1 2025 (all countries)](https://firms.modaps.eosdis.nasa.gov/data/country/zips/viirs-jpss1_2025_all_countries.zip) | 328,649,496 | `c52dcf311ff809adb2be0cfd5f169634a7c465d0eb55de4088cc5ebe95a6b50c` | 18,376,493 |
| 35 | [FIRMS viirs-snpp 2012 (all countries)](https://firms.modaps.eosdis.nasa.gov/data/country/zips/viirs-snpp_2012_all_countries.zip) | 369,758,237 | `5fbf5d857d261f17c3e06f6c0d1201ec52b88ea6663e6542cc0c43a751758c9b` | 20,864,680 |
| 36 | [FIRMS viirs-snpp 2013 (all countries)](https://firms.modaps.eosdis.nasa.gov/data/country/zips/viirs-snpp_2013_all_countries.zip) | 344,965,208 | `084a978b2a96751c1f44350d17c00457795bce0d51de929d320522e11e2aa1ca` | 19,296,980 |
| 37 | [FIRMS viirs-snpp 2014 (all countries)](https://firms.modaps.eosdis.nasa.gov/data/country/zips/viirs-snpp_2014_all_countries.zip) | 360,173,547 | `f2d4e5bc578ceba9cda5f52118a3a321a46cdb14ca66fb85c05047384a59ed41` | 20,190,209 |
| 38 | [FIRMS viirs-snpp 2015 (all countries)](https://firms.modaps.eosdis.nasa.gov/data/country/zips/viirs-snpp_2015_all_countries.zip) | 379,963,894 | `511cd7d08699b7c48bffed3b219ad25fa82450753831db986500b1574eee04b0` | 21,329,469 |
| 39 | [FIRMS viirs-snpp 2016 (all countries)](https://firms.modaps.eosdis.nasa.gov/data/country/zips/viirs-snpp_2016_all_countries.zip) | 361,719,272 | `dbc2a2bd77a2e5ea7f0caf68ef4a15cf435f4267903d2cc6569bb0e5d4caa100` | 20,247,889 |
| 40 | [FIRMS viirs-snpp 2017 (all countries)](https://firms.modaps.eosdis.nasa.gov/data/country/zips/viirs-snpp_2017_all_countries.zip) | 356,194,900 | `5b996cd72544c549ae7e51e243f7c0f83eade7cadac4db5f0d77a96e9705e5ef` | 19,984,137 |
| 41 | [FIRMS viirs-snpp 2018 (all countries)](https://firms.modaps.eosdis.nasa.gov/data/country/zips/viirs-snpp_2018_all_countries.zip) | 340,393,945 | `b07430dcc76ce42d1dbb917822d1b932f5288404627b540d1e59a2266dea9ebc` | 19,067,085 |
| 42 | [FIRMS viirs-snpp 2019 (all countries)](https://firms.modaps.eosdis.nasa.gov/data/country/zips/viirs-snpp_2019_all_countries.zip) | 373,189,317 | `9ae38fbd33aeed67a75f1652009d43cb41e23ff0da2ea8b5100f0fd261111b84` | 20,990,294 |
| 43 | [FIRMS viirs-snpp 2020 (all countries)](https://firms.modaps.eosdis.nasa.gov/data/country/zips/viirs-snpp_2020_all_countries.zip) | 367,548,957 | `2095da8ff74d765d355eac3126d0349c932e5187b3ee7c9fe7eb1a8888572fe3` | 20,619,331 |
| 44 | [FIRMS viirs-snpp 2021 (all countries)](https://firms.modaps.eosdis.nasa.gov/data/country/zips/viirs-snpp_2021_all_countries.zip) | 359,617,758 | `5e891d8429513f6b1d8cd549b8a12bf908d0e8192094c12184f6c7855d636dcf` | 20,247,675 |
| 45 | [FIRMS viirs-snpp 2022 (all countries)](https://firms.modaps.eosdis.nasa.gov/data/country/zips/viirs-snpp_2022_all_countries.zip) | 307,250,332 | `b6b48250dd40672209de0523ce782bb21d86d34f502bec17cba384868c4e3b29` | 17,164,365 |
| 46 | [FIRMS viirs-snpp 2023 (all countries)](https://firms.modaps.eosdis.nasa.gov/data/country/zips/viirs-snpp_2023_all_countries.zip) | 385,385,667 | `782a022159bf01fcb1310077b25b46da1d58a09045ab9fe31f2e2b98c762ae15` | 21,750,317 |
| 47 | [FIRMS viirs-snpp 2024 (all countries)](https://firms.modaps.eosdis.nasa.gov/data/country/zips/viirs-snpp_2024_all_countries.zip) | 371,870,408 | `a38653b029d03b48868272ab2cade671d8e2df4cbcbda205ba9fdeae023e66ae` | 20,976,982 |
| 48 | [FIRMS viirs-snpp 2025 (all countries)](https://firms.modaps.eosdis.nasa.gov/data/country/zips/viirs-snpp_2025_all_countries.zip) | 327,260,243 | `1e6f650cc956333586c2fac0ddf86a30e3b50a5550a33541fc1254a23599e6d7` | 18,415,101 |

## Unavailable archive probes

These are the exact missing-file records supplied with the manifest. Only the `viirs-jpss2_2025` probe was repeated during this audit and again returned HTTP 404. A missing yearly ZIP does not establish that a satellite's data are unavailable from other NASA services. The [official Area API](https://firms.modaps.eosdis.nasa.gov/api/area) lists NOAA-21 NRT and standard-processing products. This build has no NOAA-21 observations and must not fabricate a J2 series.

| Source URL | Recorded HTTP status | Recorded check time UTC |
| --- | ---: | --- |
| [viirs-jpss2_2023_all_countries.zip](https://firms.modaps.eosdis.nasa.gov/data/country/zips/viirs-jpss2_2023_all_countries.zip) | 404 | 2026-11-14T22:14:29Z |
| [viirs-jpss2_2024_all_countries.zip](https://firms.modaps.eosdis.nasa.gov/data/country/zips/viirs-jpss2_2024_all_countries.zip) | 404 | 2026-11-14T22:14:43Z |
| [viirs-jpss2_2025_all_countries.zip](https://firms.modaps.eosdis.nasa.gov/data/country/zips/viirs-jpss2_2025_all_countries.zip) | 404 | 2026-11-14T22:15:02Z |
| [viirs-noaa21_2023_all_countries.zip](https://firms.modaps.eosdis.nasa.gov/data/country/zips/viirs-noaa21_2023_all_countries.zip) | 404 | 2026-11-14T22:14:29Z |
| [viirs-noaa21_2024_all_countries.zip](https://firms.modaps.eosdis.nasa.gov/data/country/zips/viirs-noaa21_2024_all_countries.zip) | 404 | 2026-11-14T22:14:29Z |
| [viirs-noaa21_2025_all_countries.zip](https://firms.modaps.eosdis.nasa.gov/data/country/zips/viirs-noaa21_2025_all_countries.zip) | 404 | 2026-11-14T22:14:43Z |

## Other evidence sources

- [GK2A hourly fire/hot-smoke dataset, Jethva, Zenodo 20084790](https://zenodo.org/records/20084790), associated with [Timing the Flames](https://www.mdpi.com/2072-4292/18/10/1506). The supplied receipt attributes the dataset to CC BY 4.0. The record and paper were checked, but raw GK2A files were not reprocessed in this app build. GK2A is preliminary, coarse-resolution evidence, not ground truth.
- [PIB, 1 December 2025](https://www.pib.gov.in/PressReleseDetailm.aspx?PRID=2197201&lang=2&reg=3): primary source for the reported 5,114 Punjab incidents and 93% reduction relative to 2021, using the official September 15–November 30 window. The receipt uses October–November and a different sampling unit.
- [NASA FIRMS notification](https://firms2.modaps.eosdis.nasa.gov/content/notifications/firms2/news.html): observation-delivery transition from S-NPP in November 2026. This operational context does not mean the app contains 2026 observations.
- [NASA Terra orbital information](https://terra.nasa.gov/about) and [NASA Earth Observatory timing overview](https://science.nasa.gov/earth/earth-observatory/new-timing-for-stubble-burning-in-india/): context for clock drift and time-of-day sensitivity, not independent certification of the supplied model outputs.

## Local artifact fingerprints

The fingerprints below were recomputed from the delivered files during this build. They identify these local artifacts; they do not substitute for independent scientific validation.

| File | Bytes | SHA-256 |
| --- | ---: | --- |
| `public/data/manifest.json` | 37,773 | `c27f274918f7ee1316f308159835f8f37e19db10cadbb28111e809a863101907` |
| `public/data/validation.json` | 31,588 | `de8201da433939765840d3e83b6e6fa8b72683447e45177f6586e18acd0ed089` |
| `public/data/punjab_receipt.json` | 26,828 | `d390d54d1c6a5dd87ffe3dc41713d14d34eac94a2eacfe0ea2ace8f4c51d28f2` |
| `public/data/world/countries.json` | 15,944 | `cb32d21d9cd39b45913dd424ecb571b326c99f974764ad27bd77643805395988` |
| `public/data/world/continents.json` | 1,773 | `982eccf9c11763ce4e7d80f54df583d5d4ace823919ac99684f5c4ad903f5443` |

Manifest generation: `2026-11-14T22:33:10Z`. Supplied pipeline identifier: `nogit-sha256:5a32f188e9acc29f`; this is a hash-derived identifier, not a Git commit SHA. Source retrieval timestamps run from `2026-11-14T21:56:16Z` through `2026-11-14T22:29:36Z`.

The delivered 1,237 tile JSON files total 1,120,909,041 bytes and the 887 clock files total 9,040,082 bytes. The manifest's older tile byte count and statement that harmonized arrays are empty predate final harmonization. These original inputs are retained without alteration; see the audit for the reconciliation. The bundle's 302-month axis ends at December 2025; no live-feed or 2026 scientific results are implied.

## Interpretation and reproducibility limits

The supplied final validation reports a 1.06% global median annual LOYO error, 8.83% median 5° tile-year error, 21.31% Paraná error and 40.71% spatial tile-block holdout error. Those are supplied pipeline results. Their presence in JSON was verified; their original fitting runs were not repeated. A model trained on 2013–2019 overlap cannot directly validate observations from the earlier Terra-only era against VIIRS.

Raw platform months are null when unavailable or more than 30% of days are missing; retained raw values are not coverage-scaled. The harmonized production policy can use and rescale observations at 50% coverage, so its missingness may differ. All-platform coverage and source fields must travel with exported values. Summed cell-level interval endpoints are conservative bounds rather than a calibrated 90% area-level confidence interval.

The original pipeline scripts are supplied for inspection. Re-running ingestion requires network access and the Python dependencies noted in the pipeline; re-running receipt/world analysis also requires upstream processed inputs that were not included. The application can be built and served from the delivered JSON independently of those large upstream inputs.
