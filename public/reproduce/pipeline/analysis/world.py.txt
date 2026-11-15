"""World JSON (DATA_CONTRACT §4) from the GLOBAL ATLAS outputs + 2025 map figures.

bend_X_pct = 100 * (R_2025 / R_base - 1), R = sum(X day) / sum(S-NPP day) over the region's baseline-qualified
1-deg cells, fire season = each cell's top-3 S-NPP months (2013-19); base = 2013-19 (ratio of sums).
Counts are nominal/high-confidence DETECTIONS from scratch/global (not cell-days).
"""
import sys, json, shutil
sys.path.insert(0, "/home/claude/burnclock/pipeline/analysis")
import numpy as np, pandas as pd, pycountry
import matplotlib; matplotlib.use("Agg")
import matplotlib.pyplot as plt
from matplotlib.colors import LinearSegmentedColormap, TwoSlopeNorm

ROOT = "/home/claude/burnclock"; G = f"{ROOT}/scratch/global/out"; WD = f"{ROOT}/public/data/world"
BASE = list(range(2013, 2020))
W = pd.read_parquet(f"{G}/cell_season_year.parquet")


def region_table(g, years=(2025,), minc=3):
    r = {}
    for lab, dcol in [("A", "drho_A_bq"), ("T", "drho_T_bq"), ("TA", "drho_MD_bq")]:
        ok = g[g.year.isin(BASE + list(years))]
        vc = ok[ok.year.isin(years) & ok[dcol].notna()][["ilat", "ilon"]].drop_duplicates()
        r[f"n_{lab}"] = len(vc)
        if len(vc) < minc:
            r[f"D_{lab}"] = None; continue
        ok = ok.merge(vc, on=["ilat", "ilon"])
        num = ok.c_AD if lab == "A" else (ok.c_TD if lab == "T" else ok.c_TD + ok.c_AD)
        ok = ok.assign(num=num)
        b, t = ok[ok.year.isin(BASE)], ok[ok.year.isin(years)]
        r[f"D_{lab}"] = float((t.num.sum() / t.c_ND.sum()) / (b.num.sum() / b.c_ND.sum()) - 1)
    sub = g[g.year.isin(years)]
    r["dt_A_h"] = float(sub.dlst_AD.median()); r["dt_T_h"] = float(sub.dlst_TD.median())
    return r


def pct(v):
    return None if v is None or not np.isfinite(v) else round(100 * v, 1)


OVR = {"Lao_PDR": "LAO", "Dem_Rep_Korea": "PRK", "Republic_of_Korea": "KOR", "Democratic_Republic_of_the_Congo": "COD",
       "Republic_of_Congo": "COG", "Cote_d_Ivoire": "CIV", "Macedonia_Former_Yugoslav_Republic_of": "MKD",
       "Swaziland": "SWZ", "Kosovo": "XKX", "Russian_Federation": "RUS", "Iran": "IRN", "Syria": "SYR", "Bolivia": "BOL",
       "Venezuela": "VEN", "Tanzania": "TZA", "Vietnam": "VNM", "Brunei_Darussalam": "BRN", "Moldova": "MDA",
       "Palestine": "PSE", "Taiwan": "TWN", "Cape_Verde": "CPV", "Faeroe_Islands": "FRO", "Falkland_Islands": "FLK",
       "Federated_States_of_Micronesia": "FSM", "Heard_I_and_McDonald_Islands": "HMD", "Saint-Martin": "MAF",
       "Saint_Helena": "SHN", "Wallis_and_Futuna_Islands": "WLF", "United_States_Virgin_Islands": "VIR",
       "British_Virgin_Islands": "VGB", "Czech_Republic": "CZE", "Turkey": "TUR", "Timor-Leste": "TLS",
       "Aland_Islands": "ALA", "Curacao": "CUW", "Reunion": "REU", "Svalbard_and_Jan_Mayen": "SJM",
       "United_States_Minor_Outlying_Islands": "UMI", "French_Southern_and_Antarctic_Lands": "ATF"}
NAME = {"Lao_PDR": "Lao PDR", "Dem_Rep_Korea": "North Korea", "Republic_of_Korea": "South Korea",
        "Democratic_Republic_of_the_Congo": "DR Congo", "Republic_of_Congo": "Republic of the Congo",
        "Cote_d_Ivoire": "Côte d'Ivoire", "Macedonia_Former_Yugoslav_Republic_of": "North Macedonia",
        "Swaziland": "Eswatini", "Russian_Federation": "Russia", "Brunei_Darussalam": "Brunei",
        "Central_African_Republic": "Central African Republic"}


def iso3(c):
    if c in OVR: return OVR[c]
    try: return pycountry.countries.lookup(c.replace("_", " ")).alpha_3
    except LookupError:
        try: return pycountry.countries.search_fuzzy(c.replace("_", " "))[0].alpha_3
        except LookupError: return None


countries = []
for c, g in W[W.country.notna()].groupby("country"):
    r = region_table(g)
    if r["D_TA"] is None: continue
    countries.append({"country": NAME.get(c, c.replace("_", " ")), "iso3": iso3(c),
                      "bend_TA_pct": pct(r["D_TA"]), "bend_A_pct": pct(r["D_A"]), "bend_T_pct": pct(r["D_T"]),
                      "cells": r["n_TA"], "cells_A": r["n_A"], "cells_T": r["n_T"],
                      "dt_A_h": round(r["dt_A_h"], 2), "dt_T_h": round(r["dt_T_h"], 2),
                      "reliable": bool(r["n_TA"] >= 8)})
countries.sort(key=lambda d: -abs(d["bend_TA_pct"]))
missing_iso = [d["country"] for d in countries if d["iso3"] is None]

art = pd.read_csv(f"{G}/artifact_naive_modis_by_continent.csv")
art = art[(art["count"] == "n_conf") & (art.series == "T+A")].set_index("continent")
continents = []
for cont, g in list(W[W.continent.notna() & (W.continent != "Unmapped")].groupby("continent")) + [("World", W)]:
    r = region_table(g)
    a = art.loc[cont] if cont in art.index else None
    continents.append({"continent": cont, "bend_TA_pct": pct(r["D_TA"]), "bend_A_pct": pct(r["D_A"]), "bend_T_pct": pct(r["D_T"]),
                       "cells": r["n_TA"], "cells_A": r["n_A"], "cells_T": r["n_T"],
                       "dt_A_h": round(r["dt_A_h"], 2), "dt_T_h": round(r["dt_T_h"], 2),
                       "artifact_2019_2025_pct": None if a is None else float(a.artifact_raw_pct),
                       "lo": None if a is None else float(a.bound_lo_pct), "hi": None if a is None else float(a.bound_hi_pct)})

# reproducibility check vs atlas CSVs
rc = pd.read_csv(f"{G}/region_continent_2025.csv").set_index("continent")
diff_cont = max(abs(100 * rc.loc[c["continent"], "D_TA"] - c["bend_TA_pct"]) for c in continents if c["continent"] in rc.index)
rcc = pd.read_csv(f"{G}/region_country_2025.csv")
rcc["name"] = rcc.country.map(lambda c: NAME.get(c, c.replace("_", " ")))
mm = pd.DataFrame(countries).merge(rcc[["name", "D_TA"]], left_on="country", right_on="name")
diff_cty = float((100 * mm.D_TA - mm.bend_TA_pct).abs().max())

json.dump(countries, open(f"{WD}/countries.json", "w"), indent=1, ensure_ascii=False)
json.dump(continents, open(f"{WD}/continents.json", "w"), indent=1, ensure_ascii=False)
print("countries", len(countries), "reliable", sum(d["reliable"] for d in countries), "missing iso3", missing_iso)
print("max |diff| vs atlas CSV: continents", round(diff_cont, 3), "countries", round(diff_cty, 3))
for c in continents: print(c)
print([d for d in countries if d["country"] in ("China", "Nicaragua", "India", "Argentina")])

# ---------- maps ----------
shutil.copy(f"{ROOT}/research/figs/global_drho_dt_2025.png", f"{WD}/clock_map_2025.png")
coast = json.load(open(f"{ROOT}/data/raw/boundaries/ne/ne_110m_coastline.geojson"))
DIV = LinearSegmentedColormap.from_list("bc_div", ["#123f7a", "#2a78d6", "#f0efec", "#e34948", "#7d1414"])
INK, MUTED = "#222220", "#6b6b66"
plt.rcParams.update({"font.size": 9, "figure.facecolor": "#fcfcfb", "axes.facecolor": "#fcfcfb"})


def grid(df, col):
    Gd = np.full((180, 360), np.nan); v = df[["ilat", "ilon", col]].dropna()
    Gd[v.ilat.values + 90, v.ilon.values + 180] = v[col].values; return Gd


def single(col, title, fn, note):
    g = W[W.year == 2025]; Gd = grid(g, col)
    fig, ax = plt.subplots(figsize=(10, 5.0))
    for f in coast["features"]:
        geom = f["geometry"]; lines = geom["coordinates"] if geom["type"] == "MultiLineString" else [geom["coordinates"]]
        for ln in lines:
            a = np.array(ln); ax.plot(a[:, 0], a[:, 1], color="#b9b8b2", lw=0.4, zorder=1)
    m = ax.pcolormesh(np.arange(-180, 181), np.arange(-90, 91), Gd, cmap=DIV, norm=TwoSlopeNorm(0, -1, 1), zorder=2, rasterized=True)
    ax.set_xlim(-180, 180); ax.set_ylim(-58, 72); ax.set_aspect("equal"); ax.set_xticks([]); ax.set_yticks([])
    for s in ax.spines.values(): s.set_visible(False)
    ax.set_title(title, loc="left", fontsize=10.5, color=INK)
    cb = plt.colorbar(m, ax=ax, orientation="horizontal", fraction=0.05, pad=0.03, aspect=45, extend="both")
    cb.set_label("Δ log ratio vs 2013–19  (red = MODIS sees relatively more than S-NPP; blue = less)", color=MUTED); cb.outline.set_visible(False)
    ax.text(0.01, 0.02, f"{int(np.isfinite(Gd).sum())} cells · {note}", transform=ax.transAxes, color=MUTED, fontsize=7.5)
    fig.tight_layout(); fig.savefig(f"{WD}/{fn}", dpi=150); plt.close(fig)


single("drho_Tn", "Terra night: Δ log(Terra night / S-NPP night), 2025 vs 2013–19", "terra_night_2025.png",
       "1° cells, each cell's top-3 S-NPP fire months, nominal/high detections; FIRMS")
single("drho_A_bq", "Aqua day: Δ log(Aqua day / S-NPP day), 2025 vs 2013–19", "aqua_2025.png",
       "1° baseline-qualified cells, top-3 S-NPP fire months, nominal/high detections; FIRMS")
print("maps written")
