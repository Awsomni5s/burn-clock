"""Punjab receipt (DATA_CONTRACT §5) -> public/data/punjab_receipt.json.

Region: state_iso == IN-PB (FIRMS India file, lat>=20). Window: Oct 1 - Nov 30 (GK2A coverage).
Polar unit: daytime active 0.05-deg cell-day (FIRMS type 0, all confidences), per platform.
GK2A unit: conf>=2 pixels (Zenodo 20084790), 12-18 IST; pixel-hours by hour; unique pixel-days by year.
Outage mask: common.outage_table() (20% of centred 31-day median of India daytime count).
"""
import sys, json, datetime as dt
sys.path.insert(0, "/home/claude/burnclock/pipeline/analysis")
import numpy as np, pandas as pd
from common import *

YEARS = list(range(2013, 2026))
MONTHS = [10, 11]
PLATS = ["Terra", "SNPP", "NOAA20", "Aqua"]

d = load_det(["platform", "local_solar_date", "acq_datetime_ist", "local_solar_hour", "daynight", "type",
              "state_iso", "cell005_lat", "cell005_lon", "year", "month"],
             filters=[("state_iso", "=", "IN-PB"), ("type", "=", 0), ("month", "in", MONTHS), ("year", ">=", 2013)])
d["platform"] = d.platform.astype(str)
day = d[d.daynight == "D"].copy()
night = d[d.daynight == "N"].copy()
day["ist_h"] = day.acq_datetime_ist.dt.hour + day.acq_datetime_ist.dt.minute / 60
day["mmdd"] = day.local_solar_date.dt.strftime("%m-%d")
cd = day.drop_duplicates(["platform", "cell005_lat", "cell005_lon", "local_solar_date"])

O = outage_table()
O = O[O.missing & O.date.dt.month.isin(MONTHS)].copy()
O["mmdd"] = O.date.dt.strftime("%m-%d"); O["year"] = O.date.dt.year


def mm_masked(plats, years):
    """calendar mm-dd masked for any of `plats` in any of `years` (same-calendar-day union)."""
    return set(O[O.platform.isin(plats) & O.year.isin(years)].mmdd)


def celldays(p, y, drop_mmdd=()):
    x = cd[(cd.platform == p) & (cd.year == y)]
    return int((~x.mmdd.isin(drop_mmdd)).sum())


# ---------- 1. by_clock: polar platforms 2025 / 2021 ----------
by_clock = []
for p in PLATS:
    drop = mm_masked([p], [2021, 2025])
    v21, v25 = celldays(p, 2021, drop), celldays(p, 2025, drop)
    u21, u25 = celldays(p, 2021), celldays(p, 2025)
    t = {y: day[(day.platform == p) & (day.year == y)] for y in (2021, 2025)}
    by_clock.append({
        "label": PLAT_LABEL[p], "platform": PLAT_SHORT[p],
        "block": "fixed_clock" if p in ("SNPP", "NOAA20") else "drifting_clock",
        "ist_hour": round(float(t[2025].ist_h.median()), 2),
        "ist_hour_2021": round(float(t[2021].ist_h.median()), 2),
        "local_solar_hour": round(float(t[2025].local_solar_hour.median()), 2),
        "local_solar_hour_2021": round(float(t[2021].local_solar_hour.median()), 2),
        "value_2021": v21, "value_2025": v25,
        "ratio": round(v25 / v21, 4) if v21 else None,
        "ratio_unmasked": round(u25 / u21, 4) if u21 else None,
        "masked_calendar_days": len(drop),
        "unit": "day cell-days"})

# ---------- 2. GK2A conf>=2 ----------
g = pd.read_parquet(GK2A)
g = g[(g.state == "Punjab") & (g.conf >= 2)].copy()
g["pix"] = g.lat.round(4).astype(str) + "_" + g.lon.round(4).astype(str)
g["mmdd"] = g.date.dt.strftime("%m-%d")
gph = g.groupby(["year", "hour_ist"]).size().unstack(fill_value=0)
hours = list(range(12, 19))
gk_by_hour = {"hours": hours,
              "ratio_2025_2021": [round(float(gph.loc[2025, h] / gph.loc[2021, h]), 3) for h in hours],
              "ratio_2024_2021": [round(float(gph.loc[2024, h] / gph.loc[2021, h]), 3) for h in hours],
              "pixel_hours_2021": [int(gph.loc[2021, h]) for h in hours],
              "pixel_hours_2025": [int(gph.loc[2025, h]) for h in hours],
              "conf_min": 2, "unit": "pixel-hours (conf>=2), Punjab, Oct-Nov",
              "outage_mask": "none (GK2A file holds detections only; GK2A outages cannot be separated from cloud)"}
gpd = g.drop_duplicates(["pix", "date"])
gk_upd = {str(y): int((gpd.year == y).sum()) for y in range(2019, 2026)}


def gk_pixdays(y, drop_mmdd=()):
    x = gpd[gpd.year == y]
    return int((~x.mmdd.isin(drop_mmdd)).sum())


# ---------- 3. base-year fan (VIIRS union mask, applied to GK2A too) ----------
fan = []
for b in [2019, 2021, 2022, 2023]:
    drop = mm_masked(["SNPP", "NOAA20"], [b, 2025])
    gb, g25 = gk_pixdays(b, drop), gk_pixdays(2025, drop)
    nb, n25 = celldays("SNPP", b, drop), celldays("SNPP", 2025, drop)
    jb, j25 = celldays("NOAA20", b, drop), celldays("NOAA20", 2025, drop)
    fan.append({"base": b, "gk2a": round(g25 / gb, 3), "snpp": round(n25 / nb, 3), "noaa20": round(j25 / jb, 3),
                "gk2a_unmasked": round(gk_pixdays(2025) / gk_pixdays(b), 3),
                "snpp_unmasked": round(celldays("SNPP", 2025) / celldays("SNPP", b), 3),
                "noaa20_unmasked": round(celldays("NOAA20", 2025) / celldays("NOAA20", b), 3),
                "counts": {"gk2a_base": gb, "gk2a_2025": g25, "snpp_base": nb, "snpp_2025": n25,
                           "noaa20_base": jb, "noaa20_2025": j25},
                "masked_calendar_days": sorted(drop)})

# ---------- 4. verdict: contract §3 badge rule on Punjab Oct-Nov ----------
def rho_series(P):
    r = {}
    for y in YEARS:
        drop = mm_masked([P, "SNPP"], [y])            # same-day union within year
        n, p = celldays("SNPP", y, drop), celldays(P, y, drop)
        r[y] = (np.log(p / n) if (n > 0 and p > 0) else np.nan, n, p)
    return r

badge = {}
for P in ["Aqua", "Terra"]:
    r = rho_series(P)
    base = np.array([r[y][0] for y in range(2013, 2020)])
    mu, sd = float(np.nanmean(base)), float(np.nanstd(base, ddof=1))
    rows = {}
    for y in range(2021, 2026):
        rho, n, p = r[y]
        drho = float(rho - mu) if np.isfinite(rho) else None
        rows[str(y)] = {"N_day": n, "P_day": p, "rho": None if not np.isfinite(rho) else round(float(rho), 3),
                        "drho": None if drho is None else round(drho, 3),
                        "threshold": round(max(2 * sd, 0.15), 3),
                        "evaluable": bool(n >= 200 and p >= 50),
                        "exceeds": bool(drho is not None and n >= 200 and p >= 50 and abs(drho) > max(2 * sd, 0.15))}
    badge[PLAT_SHORT[P]] = {"baseline_mean_2013_19": round(mu, 3), "sigma_2013_19": round(sd, 3), "years": rows}


def verdict_for(y):
    y = str(y)
    ev = [k for k in ("A", "T") if badge[k]["years"][y]["evaluable"]]
    if badge["A"]["years"][y]["N_day"] < 200 or not ev:
        return "not_identifiable", ev
    return ("clock_sensitive" if any(badge[k]["years"][y]["exceeds"] for k in ev) else "robust"), ev

verdict, evaluated = verdict_for(2025)
literal = "not_identifiable" if any(badge[k]["years"]["2025"]["P_day"] < 50 for k in ("A", "T")) else verdict
# naive MODIS bend (T+A)/N vs 2013-19
def ta_ratio(y):
    drop = mm_masked(["Terra", "Aqua", "SNPP"], [y])
    return (celldays("Terra", y, drop) + celldays("Aqua", y, drop)) / celldays("SNPP", y, drop)
bend25 = ta_ratio(2025) / np.mean([ta_ratio(y) for y in range(2013, 2020)]) - 1
# GK2A corroboration: VIIRS-hour vs late-hour ratio
r = dict(zip(hours, gk_by_hour["ratio_2025_2021"]))
gk_viirs_hr = (gph.loc[2025, [13, 14]].sum() / gph.loc[2021, [13, 14]].sum())
gk_late = (gph.loc[2025, [16, 17]].sum() / gph.loc[2021, [16, 17]].sum())

# decomposition (red team): share of ln VIIRS decline explained by GK2A activity change
lnv = np.log(by_clock[1]["ratio"]); lnj = np.log(by_clock[2]["ratio"])
lng_pd = np.log(fan[1]["gk2a"]); lng_ph = np.log(gph.loc[2025].sum() / gph.loc[2021].sum())
decomp = {"ln_snpp_2025_2021": round(float(lnv), 3), "ln_noaa20_2025_2021": round(float(lnj), 3),
          "ln_gk2a_pixel_days": round(float(lng_pd), 3), "ln_gk2a_pixel_hours": round(float(lng_ph), 3),
          "activity_share_of_snpp_log_decline": [round(float(lng_pd / lnv), 3), round(float(lng_ph / lnv), 3)],
          "note": "share = ln(GK2A ratio)/ln(S-NPP ratio); pixel-days -> pixel-hours bound. GK2A misses small fires, so bounds only."}

night_cd = night.drop_duplicates(["platform", "cell005_lat", "cell005_lon", "local_solar_date"]) \
    .groupby(["platform", "year"]).size().unstack(fill_value=0)

out = {
    "claim": "Punjab farm fires fell 93% (2021→2025)",
    "claim_source": {"value_2021": 71304, "value_2025": 5114,
                     "url": "https://theprint.in/india/punjab-haryana-saw-marked-decline-in-stubble-burning-cases-this-year-data/2804357",
                     "url_2021": "https://pib.gov.in/PressReleasePage.aspx?PRID=1981276",
                     "window": "Sep 15 - Nov 30, CREAMS/ISRO protocol (Terra+Aqua MODIS + S-NPP VIIRS)"},
    "region": "Punjab (state_iso IN-PB), Oct 1 - Nov 30, local solar date",
    "by_clock": by_clock,
    "gk2a_by_hour": gk_by_hour,
    "gk2a_unique_pixel_days": gk_upd,
    "gk2a_unique_pixel_days_note": "conf>=2, unique (pixel, IST date), 12-18 IST, Oct-Nov, Punjab; not outage-masked",
    "base_year_fan": fan,
    "verdict": verdict,
    "verdict_rule": {
        "rule": "DATA_CONTRACT §3 badge applied to Punjab Oct-Nov daytime cell-days for y=2025: rho_P=ln(P/N) for P in {A,T}; "
                "baseline = mean 2013-19, sigma = SD 2013-19; clock_sensitive if |drho_P| > max(2 sigma_P, 0.15) for any evaluable P; "
                "a platform is evaluable only if N_day>=200 and P_day>=50; not_identifiable if N_day<200 or no platform evaluable; else robust. "
                "Each year's ratio drops calendar days outage-masked for P or S-NPP.",
        "evaluated_platforms_2025": evaluated,
        "literal_reading_verdict": literal,
        "literal_reading_note": "If 'P_day<50' is read as 'any of T,A below 50' the badge is not_identifiable (Terra 2025 Punjab Oct-Nov is far below 50). Burn Clock evaluates per platform.",
        "badge": badge,
        "by_year": {str(y): verdict_for(y)[0] for y in range(2021, 2026)},
        "naive_modis_bend_2025_pct": round(float(bend25 * 100), 1),
        "gk2a_corroboration": {"ratio_2025_2021_13_14_IST": round(float(gk_viirs_hr), 3),
                               "ratio_2025_2021_16_17_IST": round(float(gk_late), 3),
                               "note": "independent fixed-clock instrument; not used to set the verdict"}},
    "decomposition": decomp,
    "viirs_night_celldays": {PLAT_SHORT[p]: {str(y): int(night_cd.loc[p, y]) for y in range(2019, 2026) if y in night_cd.columns}
                             for p in ("SNPP", "NOAA20") if p in night_cd.index},
    "outage_mask": {"rule": "platform-day missing if its India (lat>=20) daytime type-0 count < 20% of its centred 31-day median (zero-filled)",
                    "application": "by_clock: same-calendar-day union of the platform's own masked days in 2021 and 2025; "
                                   "base_year_fan: union of S-NPP and NOAA-20 masked calendar days in base and 2025, applied to GK2A, S-NPP and NOAA-20; "
                                   "verdict: within-year union of P and S-NPP masked days.",
                    "punjab_season_masked_days": masked_list(["SNPP", "NOAA20", "Terra", "Aqua"], MONTHS, range(2019, 2026)),
                    "note": "S-NPP has zero India daytime detections on 2024-11-03..06 (median ~850-980/day); masked. 2024 is not a base year here for that reason. "
                            "For MODIS the rule also flags orbit-gap days (swath misses Punjab) and cloudy days; these are dropped from both years of a ratio."},
    "assumptions": [
        "Unit for polar rows is the daytime 0.05° active cell-day (FIRMS type 0, all confidences), not detections or fires; S-NPP detections per cell-day fell (~3.0 → ~1.35), so cell-days understate any saturation-free decline less than detections do.",
        "Window is Oct 1–Nov 30 by local solar date, the GK2A record's window; the official count uses Sep 15–Nov 30 and a MODIS+S-NPP mix, so it is not a single-clock number.",
        "Terra and Aqua rows are drifting clocks: the satellite's look time and the burning time both changed, so they are not decline estimates. Only S-NPP, NOAA-20 and GK2A-by-hour are fixed-clock comparisons.",
        "GK2A is a preliminary 3.8/11.2 µm contrast product (~4 km pixel) with hour-dependent thresholds; only conf ≥ 2 is used. It can flag hot smoke and misses small fires. Its level is not comparable with VIIRS or MODIS; only within-instrument ratios are used.",
        "GK2A pixel-hours count duration; unique pixel-days are the duration-robust GK2A unit and are the fan's GK2A entry.",
        "18 IST is near or after sunset in November and uses negative ΔTb thresholds; it is shown but should not carry a headline.",
        "2021 is GK2A's peak year; the base-year fan shows how the GK2A ratio swings with base (2019 ×~2 vs 2021 ×~0.66).",
        "IST look time = FIRMS acq_time (granule time) + 5:30; it can be a few minutes early versus per-pixel scan time.",
        "Outage mask flags any platform-day under 20% of its 31-day median over India; for MODIS this also catches orbit-gap and cloudy days, which are removed from both years of the ratio.",
        "Burnt area (iFOREST, 2022→2025 −37%) disagrees with GK2A over 2022→2025 and is not used as corroboration."],
    "sources": [
        "NASA FIRMS active fire archive, MODIS C6.1 (Terra, Aqua), VIIRS 375 m (S-NPP, NOAA-20), India country files — https://firms.modaps.eosdis.nasa.gov/",
        "GK2A-AMI hourly fire pixels over Punjab/Haryana, Jethva 2026 dataset, Zenodo record 20084790 (CC-BY-4.0) — https://zenodo.org/records/20084790",
        "Jethva 2026, 'Timing the Flames…', Remote Sensing 18(10):1506 — https://www.mdpi.com/2072-4292/18/10/1506",
        "Official 2021 Punjab count 71,304 (PIB) — https://pib.gov.in/PressReleasePage.aspx?PRID=1981276",
        "Official 2025 Punjab count 5,114 and CAQM −93% vs 2021 (ThePrint) — https://theprint.in/india/punjab-haryana-saw-marked-decline-in-stubble-burning-cases-this-year-data/2804357",
        "CREAMS/IARI satellite sources (MODIS Terra/Aqua + S-NPP VIIRS) — https://www.drishtiias.com/daily-updates/daily-news-analysis/collection-of-farm-fire-data-in-india",
        "ISRO SAC SEVIRI timing shift (via NASA Earth Observatory) — https://science.nasa.gov/earth/earth-observatory/new-timing-for-stubble-burning-in-india",
        "iFOREST late-burning and burnt area (Dec 2025) — https://www.theweek.in/wire-updates/national/2025/12/08/del43-env-stubble-burning-report.html",
        "MODIS orbit drift (Giglio, LANCE UWG, May 2025) — https://landweb.modaps.eosdis.nasa.gov/data/filePost/LANCE_UWG_Orbit_Drift_Giglio_202505.pdf",
        "Terra/Aqua orbit maneuver history (Twedt 2023) — https://ntrs.nasa.gov/api/citations/20240001409/downloads/2023_SPIE_Twedt_MODIS_EV_orbit_drift_manuscript_v4.pdf.txt"],
    "generated_utc": dt.datetime.now(dt.timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
    "script": "pipeline/analysis/punjab_receipt.py",
}
json.dump(out, open(f"{ROOT}/public/data/punjab_receipt.json", "w"), indent=1, ensure_ascii=False)
print(json.dumps({k: out[k] for k in ["by_clock", "gk2a_by_hour", "gk2a_unique_pixel_days", "base_year_fan", "verdict"]}, indent=0, ensure_ascii=False)[:6000])
print(json.dumps(out["verdict_rule"], indent=0)[:3000]); print(out["decomposition"]); print(out["viirs_night_celldays"])
