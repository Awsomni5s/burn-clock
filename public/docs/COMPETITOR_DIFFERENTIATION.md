# Burn Clock: competitive research

Audit date: 14 November 2026. This is a public README review, not a benchmark of the competitors' implementations. All four repositories named in the build brief were publicly readable. No rival code, data, figures, or design assets were copied. Reported capabilities and scores below are the respective authors' claims; their pipelines were not rerun.

| Project | Publicly documented strengths | Burn Clock's useful emphasis |
| --- | --- | --- |
| [FireClock](https://github.com/fireclock-team/fireclock) | Punjab/Haryana and Paraná explorer; measured look times; Terra/Aqua drift; pre-drift calibration; NOAA-20/21 bridge; calendar, ranges and CSV. Its README reports a 7.3% Punjab annual holdout error using detections. | Connect an area-specific calendar to a worldwide clock atlas and a GK2A receipt with an explicit choice of comparison year. A clock warning or pre-drift calibration alone is not a unique feature. |
| [Fire Harmony](https://github.com/Warren-530/fire-harmony) | Worldwide calendar on a NOAA-20 scale; H3 aggregation; static-source masking; 90% ranges; published Parquet; contextual climate, exposure and haze data. | Keep the core task direct: select an area, inspect the calendar, understand the satellite's observation time, export the exact displayed series. The supplied Burn Clock bundle is historical through 2025; do not imply newer coverage than this rival. |
| [SHIFT](https://github.com/squadronzero/project-shift) | Worldwide calendar; 0.05° active cell-days; FRP; locally shrunk conversion factors; NOAA-20 continuation; outage treatment; documented validation and source tracking. | Give measured clock sensitivity, opposite day/night behavior, and the separate geostationary receipt a clear place in the user journey. Cell-days, global coverage, bridging, and reproducible validation are shared capabilities. |
| [Kiln Watch](https://github.com/Aalvee-Aarham/kiln-watch) | Nine prebuilt regions; Terra-to-Aqua and VIIRS-to-Aqua bridges; empirical-Bayes monthly factors; separate day/night treatment; 95% ranges; satellite-denial tests and an AI agent. | Make the VIIRS reference scale, global selection, validation failures, and downloadable evidence legible. Do not compare its Aqua-scale error directly with Burn Clock's VIIRS-scale error. |

Burn Clock's defensible positioning is an integrated workflow: a historical fire calendar, a measured satellite-clock diagnostic, and a clearly qualified Punjab evidence receipt. This review does not establish that the combination is unique across all teams. It cannot substantiate a promise to beat every rival or predict judging outcomes.

The earlier supplied plan understates overlap with current rivals. FireClock already discusses Terra and Aqua and uses pre-drift calibration. SHIFT already uses active cell-days globally. Claims such as “nobody uses this unit,” “the only clock-aware calendar,” and “the first global bridge” should not appear in the product. A smaller published error is not evidence of a better model unless geography, unit, confidence filters, observation dates, holdout design and scoring scale are identical.

Product decisions supported by this review:

- Keep Calendar first, with exact coverage and units next to its values.
- Make the satellite clock explain the selected area's data; label annual seasonal badges as annual seasonal diagnostics.
- Give the receipt its own screen and preserve both fixed-clock and drifting-clock evidence.
- Publish the failures alongside the strong global score: Paraná, sparse cells, spatial transfer and the earliest Terra-only years.
- Make exports reproducible by including the selected area, baseline, source, missingness, uncertainty interpretation and data version.

These are implementation priorities, not verified claims that a rival lacks them. The competitor websites were not interactively tested in this audit.

## Update, 15 November 2026: what each tool lets a user *do*

- **Scope:** a README review of 326 public repositories for this challenge pushed after 13 November (294 had a readable README).
- **Read in full:** FireClock, BlindSpot, Mee, HazeWatch and Oryx (Punjab).
- **Limits:** this is not an interactive benchmark, and capabilities are as the authors describe them.

| Need | Closest rival approach | Burn Clock |
| --- | --- | --- |
| Is this place's trend distorted by satellite timing? | FireClock: a satellite-clock panel for Punjab & Haryana and Paraná | A four-way verdict for any place and months, with actions per verdict × role |
| When should field teams check? | BlindSpot: best hours from gaps between satellite passes (Pakistan) | Best window from when fire was actually observed burning (hourly GK2A), per Punjab district, plus the busiest two weeks |
| How far to trust the count for emissions inputs? | Described qualitatively by several projects | Count change vs whole-afternoon change per district and base year, shown as a sensitivity range |
| What can a reporter safely write? | — | "You can say / Don't say / Why", generated per district, withheld for thin data |
| Live season | FireClock: archive to 13 Nov 2026 | This week's NASA files by district, compared with the same days in every year since 2013 (Aqua ÷ NOAA-20) |
| Find my area, share it | Mee: use my location; BlindSpot: district share images | Use my location (computed in the browser), a field card image, a per-district link, a calendar file of check windows |
| Alerts | Mee (Telegram), BlindSpot | Not offered: needs a live server; listed as future work |

Overlap remains real. FireClock reports the same Aqua-drift finding for Punjab, with a wheat-season placebo and a second continent. Burn Clock's distinct contribution is turning that evidence into district-level, role-specific actions. This review does not establish that no other team does this.
