# Burn Clock data license and source attribution

The Burn Clock contributors license their original contributions to the derived
data compilation under [Creative Commons Attribution 4.0 International
(CC BY 4.0)](https://creativecommons.org/licenses/by/4.0/), to the extent they hold
rights in those contributions. The [legal code](https://creativecommons.org/licenses/by/4.0/legalcode)
governs. Credit Burn Clock contributors, link to this license and the source
records, retain applicable attribution, and identify your changes. No Burn Clock
DOI has yet been assigned. The collective author name is provisional.

This grant does not claim ownership of NASA observations, relicense third-party
work, or add restrictions to public-domain material. Original source rights and
notices remain in force. Burn Clock code and its original software documentation
are covered by the separate MIT `LICENSE`; dependencies, fonts and geographic
base layers retain their own licenses.

## NASA FIRMS observations

MODIS and VIIRS observations come from [NASA FIRMS](https://firms.modaps.eosdis.nasa.gov/).
NASA describes FIRMS as open data and asks users to provide the correct citation;
see its [FIRMS use guidance](https://www.earthdata.nasa.gov/data/tools/firms/faq),
[data use and citation policy](https://www.earthdata.nasa.gov/engage/open-data-services-software-policies/data-use-guidance),
and [LANCE disclaimer](https://www.earthdata.nasa.gov/data/projects/lance/disclaimer).
The CC BY license above applies to Burn Clock's contributions, not to the
underlying NASA material. Follow any product-specific source terms.

Acknowledgment: Burn Clock uses NASA FIRMS data, distributed through NASA's Earth
Science Data and Information System (ESDIS). NASA's [official FIRMS training
Q&A, question 25](https://appliedsciences.nasa.gov/sites/default/files/2025-04/FIRMS_Part2_QA.pdf)
provides the acknowledgment guidance. This independent project does not imply
NASA endorsement. The original source URLs, recorded hashes and product years
are preserved in the supplied manifest and `DATA_PROVENANCE.md`.

## GK2A / GK2-AMI hourly evidence

Jethva, Hiren (2026). *Hourly Fire Detection Dataset of Post-monsoon Stubble
Burning in Northwestern India derived from GK2-AMI Geostationary Satellite
Observations*, v1. Zenodo. [doi:10.5281/zenodo.20084790](https://doi.org/10.5281/zenodo.20084790).

The [source record](https://zenodo.org/records/20084790) and its
[machine-readable metadata](https://zenodo.org/api/records/20084790) identify its
license as CC BY 4.0; this was checked on 15 November 2026 UTC. The DOI belongs
to Jethva's upstream dataset, not Burn Clock. Retain this credit when reusing
GK2A-derived tables, maps or comparisons. Cite the associated study where
relevant: Jethva (2026), *Timing the Flames*,
[doi:10.3390/rs18101506](https://doi.org/10.3390/rs18101506).

## Changes and interpretation

The supplied Burn Clock products aggregate satellite detections into cell-days,
apply the documented harmonization and observation-coverage rules, aggregate
hourly GK2A evidence, and provide smoothed contour maps. The application packages
those products for display; original supplied release archive bytes are retained.
Contours are visual summaries; numerical inspection uses the unsmoothed grid.
Source attribution does not make either sensor ground truth. Detections,
cell-days, pixel-hours, burned area and emissions are different quantities.

The complete scientific inputs and original contour-generation script were not
supplied. The release's reproduction notes distinguish verified packaging and
selected source checks from a full scientific rerun.
