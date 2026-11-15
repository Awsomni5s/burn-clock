"""Same-day VIIRS pair test (red team M2): S-NPP vs NOAA-20 (~50 min apart on the same orbit plane).

Per region-day with both platforms observing (neither outage-masked, >= MIN_N daytime cell-days each):
  y = ln(n_J1 / n_N)  (daytime 0.05-deg active cell-days, FIRMS type 0, all confidences)
  x = t_J1 - t_N      (median local solar hour of that day's daytime detections in the region)
OLS y = a + b x. The intercept a absorbs the fixed NOAA-20/S-NPP sensitivity offset, so b is the
log change per hour of later look ("later/earlier" with a platform term). % per hour = 100(exp(b)-1).
CI: 90% percentile bootstrap, resampling 7-day blocks (year, week-of-season), 2000 reps.
Robustness: + ln(mean scan J1 / mean scan N) covariate (pixel-size / view-angle control).
"""
import sys, json
sys.path.insert(0, "/home/claude/burnclock/pipeline/analysis")
import numpy as np, pandas as pd
from common import *

MIN_N, NB, SEED = 10, 2000, 20261114
REG = {"Punjab+Haryana": ["IN-PB", "IN-HR"], "Madhya Pradesh": ["IN-MP"], "Uttar Pradesh": ["IN-UP"]}
PERIODS = {"2018-21": range(2018, 2022), "2022-25": range(2022, 2026)}

d = load_det(["platform", "local_solar_date", "local_solar_hour", "daynight", "type", "state_iso",
              "cell005_lat", "cell005_lon", "year", "month", "scan"],
             filters=[("type", "=", 0), ("daynight", "=", "D"), ("platform", "in", ["SNPP", "NOAA20"]),
                      ("month", "in", [10, 11]), ("year", ">=", 2018),
                      ("state_iso", "in", sum(REG.values(), []))])
d["platform"] = d.platform.astype(str); d["state_iso"] = d.state_iso.astype(str)
inv = {s: r for r, ss in REG.items() for s in ss}
d["region"] = d.state_iso.map(inv)
O = outage_table(); bad = set(O[O.missing & O.platform.isin(["SNPP", "NOAA20"])].date)

cd = d.drop_duplicates(["region", "platform", "cell005_lat", "cell005_lon", "local_solar_date"])
agg = cd.groupby(["region", "local_solar_date", "platform"]).size().rename("n").to_frame()
agg["t"] = d.groupby(["region", "local_solar_date", "platform"]).local_solar_hour.median()
agg["scan"] = d.groupby(["region", "local_solar_date", "platform"]).scan.mean()
W = agg.unstack("platform").dropna()
W.columns = [f"{a}_{b}" for a, b in W.columns]
W = W.reset_index()
W = W[~W.local_solar_date.isin(bad) & (W.n_SNPP >= MIN_N) & (W.n_NOAA20 >= MIN_N)].copy()
W["y"] = np.log(W.n_NOAA20 / W.n_SNPP)
W["x"] = W.t_NOAA20 - W.t_SNPP
W["z"] = np.log(W.scan_NOAA20 / W.scan_SNPP)
W["year"] = W.local_solar_date.dt.year
W["block"] = W.year.astype(str) + "_" + ((W.local_solar_date.dt.dayofyear - 274) // 7).astype(str)
W.to_csv(f"{OUT}/viirs_pairs_days.csv", index=False)


def ols(df, cov=False):
    if cov == "yearfe":
        X = np.c_[df.x.values, pd.get_dummies(df.year).values.astype(float)]
        return np.linalg.lstsq(X, df.y.values, rcond=None)[0][0]
    X = np.c_[np.ones(len(df)), df.x.values] if not cov else np.c_[np.ones(len(df)), df.x.values, df.z.values]
    return np.linalg.lstsq(X, df.y.values, rcond=None)[0][1]


def fit(df, cov=False, rng=None):
    b = ols(df, cov)
    blocks = df.block.unique(); idx = {k: v.index.values for k, v in df.groupby("block")}
    bs = []
    for _ in range(NB):
        pick = rng.choice(blocks, len(blocks))
        s = df.loc[np.concatenate([idx[k] for k in pick])]
        if s.x.std() > 0:
            bs.append(ols(s, cov))
    lo, hi = np.percentile(bs, [5, 95])
    pc = lambda v: round(float(100 * (np.exp(v) - 1)), 1)
    return {"pct_change_per_hour": pc(b), "ci90": [pc(lo), pc(hi)], "slope_log_per_h": round(float(b), 4),
            "n_days": int(len(df)), "n_blocks": int(len(blocks)),
            "dt_h_abs_median": round(float(df.x.abs().median()), 3),
            "share_J1_later": round(float((df.x > 0).mean()), 3)}


rng = np.random.default_rng(SEED)
res = {"definition": __doc__.strip(), "min_celldays_each": MIN_N, "season": "Oct-Nov", "by_region": [], "by_year_punjab_haryana": []}
for r in REG:
    for pl, yrs in PERIODS.items():
        s = W[(W.region == r) & W.year.isin(yrs)].reset_index(drop=True)
        row = {"region": r, "period": pl, **fit(s, rng=rng)}
        row["with_scan_control"] = {k: v for k, v in fit(s, True, rng).items() if k in ("pct_change_per_hour", "ci90")}
        row["with_year_intercepts"] = {k: v for k, v in fit(s, "yearfe", rng).items() if k in ("pct_change_per_hour", "ci90")}
        res["by_region"].append(row)
for y in range(2018, 2026):
    s = W[(W.region == "Punjab+Haryana") & (W.year == y)].reset_index(drop=True)
    if len(s) >= 8 and s.x.std() > 0:
        res["by_year_punjab_haryana"].append({"year": y, **fit(s, rng=rng)})
json.dump(res, open(f"{OUT}/viirs_pairs.json", "w"), indent=1)
for row in res["by_region"]:
    print(row["region"], row["period"], row["pct_change_per_hour"], row["ci90"], row["n_days"], row["dt_h_abs_median"], row["share_J1_later"], row["with_scan_control"], row["with_year_intercepts"])
for row in res["by_year_punjab_haryana"]:
    print(row["year"], row["pct_change_per_hour"], row["ci90"], row["n_days"], row["share_J1_later"])
print(W.x.describe())
