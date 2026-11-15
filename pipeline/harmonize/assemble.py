"""Assemble public/data/validation.json (DATA_CONTRACT section 6) from pipeline outputs.

usage: python3 -I assemble.py --input q25
Uses out/train_<input>.json (always), out/final_<input>.json (if present: locked-year scores),
out/{train,final}_<input>_detections.json (FireClock-like detections variant, if present),
and the atlas clock-check CSVs in scratch/global/out (copied with their source path).
"""
import sys, os, json, argparse, hashlib, time
import pandas as pd
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from common import load_config, OUT, atomic_json

ap = argparse.ArgumentParser()
ap.add_argument("--input", default="q25")
ap.add_argument("--out", default=None)
args = ap.parse_args()
cfg = load_config()
M_ = cfg["method"]
J = lambda n: json.load(open(f"{OUT}/{n}.json")) if os.path.exists(f"{OUT}/{n}.json") else None
TR, FI = J(f"train_{args.input}"), J(f"final_{args.input}")
TRd, FId = J(f"train_{args.input}_detections"), J(f"final_{args.input}_detections")
assert TR and TR["config_hash"] == cfg["config_hash"]


def slim(m):
    if m is None:
        return None
    return {k: m.get(k) for k in ["median_annual_err_pct", "mean_signed_err_pct", "r2_log_monthly", "per_year_signed_pct",
                                  "n_years", "n_months", "obs_annual_total_mean"] if k in m}


CONT = ["Africa", "Asia", "Europe", "North America", "Oceania", "South America"]
lb = TR["loyo_bridge"]
inp = cfg["inputs"][args.input]
sha = hashlib.sha256(open(inp["path"], "rb").read()).hexdigest()

v = {"version": "1", "generated_utc": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
     "config_hash": cfg["config_hash"],
     "input": {"path": inp["path"].replace("/home/claude/burnclock/", ""), "sha256": sha, "grid_deg": TR["grid_deg"],
               "value": TR["value_column"], "n_cells": TR["n_cells"]},
     "unit": "daytime active cell-days on the S-NPP VIIRS scale",
     "tau": TR["tau"], "tau_b": TR["tau_b"],
     "locked_test_years": M_["years"]["locked_test"],
     "training_years": M_["years"]["training"],
     "loyo": {"design": "each training year held out in turn; k fit on the other training years; VIIRS predicted from Terra+Aqua",
              "global": slim(lb["global"]), "punjab": slim(lb.get("punjab_haryana")), "parana": slim(lb.get("parana_delta")),
              "by_continent": {c: slim(lb.get(c)) for c in CONT},
              "tile_5deg": TR["loyo_bridge_tile"]},
     "loro": {"design": "spatial hold-out on training years: held-out cells get k from the hierarchy fitted without them",
              "by_region": [{"region": r["region"], "type": r["type"], **slim(r)} for r in TR["loro"]["by_region"]],
              "tile_blocks_5deg": {"n_folds": TR["loro"]["tile_blocks_5deg"]["n_folds"],
                                   "global": slim(TR["loro"]["tile_blocks_5deg"]["metrics"]["global"]),
                                   **TR["loro"]["tile_blocks_5deg"]["tile"]}},
     "denial": [], "changepoint": {}, "models": []}

for d in TR["denial"]:
    g = d["metrics"].get("global", {})
    v["denial"].append({"hidden": d["hidden"], "reconstructed_from": d["reconstructed_from"], "design": d["design"],
                        "median_err_pct": g.get("median_annual_err_pct"), "r2_log_monthly": g.get("r2_log_monthly"),
                        "punjab": slim(d["metrics"].get("punjab_haryana")), "parana": slim(d["metrics"].get("parana_delta")),
                        "by_continent": {c: (d["metrics"].get(c) or {}).get("median_annual_err_pct") for c in CONT},
                        **({"tile_5deg": d["tile"]} if "tile" in d else {})})

SRC = FI or TR
seam = SRC["drift_seam"]
v["changepoint"]["drift_2020_22"] = {
    "definition": "R(y) = sum(k_pre * MODIS T+A) / sum(observed VIIRS); seam = mean R(2023-25) / mean R(training years)",
    "k_fit_years": SRC.get("drift_seam_k_years"),
    "global": seam["global"], "by_region": {k: x for k, x in seam.items() if k != "global"}}
s12 = SRC["seam_2012"]
if isinstance(s12, dict):
    v["changepoint"]["seam_2012"] = {**s12["global"], "by_region": {k: x for k, x in s12.items() if k != "global"},
                                     "definition": "mean annual 2013-15 / mean annual 2009-11; raw = MODIS T+A to 2011 then S-NPP; harm = shipped series; modis_only = T+A both periods"}
else:
    v["changepoint"]["seam_2012"] = {"raw_jump": None, "harm_jump": None, "note": s12}

dc = TR["drift_contaminated"]
models = [{"name": "ratio_bridge_pre_drift", "fit_years": "training years (2013-15, 2017-18) minus held-out",
           "score": {"loyo_global": slim(lb["global"]), "loyo_punjab": slim(lb.get("punjab_haryana")),
                     "loyo_parana": slim(lb.get("parana_delta")),
                     "primary_tile_median_abs_annual_err_pct": TR["loyo_bridge_tile"]["median_abs_annual_err_pct_tile_years"]}}]
if "loyo_gbm" in TR:
    models.append({"name": "gbm", "estimator": "HistGradientBoostingRegressor on log1p(V)",
                   "score": {"loyo_global": slim(TR["loyo_gbm"]["global"]), "loyo_punjab": slim(TR["loyo_gbm"].get("punjab_haryana")),
                             "loyo_parana": slim(TR["loyo_gbm"].get("parana_delta")),
                             "primary_tile_median_abs_annual_err_pct": TR["loyo_gbm_tile"]["median_abs_annual_err_pct_tile_years"]}})
models.append({"name": "ratio_bridge_all_years_drift_contaminated", "fit_years": dc["fit_years"],
               "score": {"loyo_global": slim(dc["loyo_training_years"]["global"]),
                         "loyo_punjab": slim(dc["loyo_training_years"].get("punjab_haryana")),
                         "loyo_parana": slim(dc["loyo_training_years"].get("parana_delta")),
                         "by_continent": {c: slim(dc["loyo_training_years"].get(c)) for c in CONT}},
               "k_all_vs_k_pre_scale_pct": dc["k_all_vs_k_pre_scale_pct"]})
if FI:
    models[0]["score"]["locked"] = {"global": slim(FI["locked_bridge"]["global"]), "punjab": slim(FI["locked_bridge"].get("punjab_haryana")),
                                    "parana": slim(FI["locked_bridge"].get("parana_delta")),
                                    "by_continent": {c: slim(FI["locked_bridge"].get(c)) for c in CONT},
                                    "tile_5deg": FI["locked_bridge_tile"]}
    if "locked_gbm" in FI and len(models) > 1 and models[1]["name"] == "gbm":
        models[1]["score"]["locked"] = {"global": slim(FI["locked_gbm"]["global"]), "punjab": slim(FI["locked_gbm"].get("punjab_haryana")),
                                        "parana": slim(FI["locked_gbm"].get("parana_delta")),
                                        "by_continent": {c: slim(FI["locked_gbm"].get(c)) for c in CONT},
                                        "tile_5deg": FI["locked_gbm_tile"]}
v["models"] = models
v["chosen_model"] = TR["model_choice"]["chosen"]
v["model_choice"] = TR["model_choice"]
v["locked_test_scored"] = bool(FI)

bench = [{"name": "FireClock (fireclock-team/fireclock README)", "status": "REPORTED BY RIVAL, not reproduced",
          "region": "Punjab + Haryana, bbox 27.6-32.6N 73.8-77.6E", "median_annual_err_pct": 7.3, "r2_log_monthly": 0.983,
          "note": "FireClock scores raw daytime detections, a single regional k per calendar month fitted on Punjab itself, "
                  "LOYO over 2013-2020 (8 years incl. 2016, 2019, 2020). Burn Clock scores 0.05-deg active cell-days "
                  "(not detections), one global hierarchical k (cell->1deg->5deg->global), LOYO over 5 training years "
                  "with 2016/2019 locked. The numbers are not like-for-like; the detections variant below is the closer match."}]
if TRd:
    bench.append({"name": "Burn Clock, detections variant (same pipeline, value = detections)",
                  "region": "Punjab + Haryana", "loyo": slim(TRd["loyo_bridge"].get("punjab_haryana")),
                  "loyo_global": slim(TRd["loyo_bridge"]["global"]), "tau": TRd["tau"],
                  **({"locked": slim(FId["locked_bridge"].get("punjab_haryana"))} if FId else {})})
v["benchmarks"] = bench

# clock checks: copied from the global atlas outputs (reproduced there), with provenance
try:
    npc = pd.read_csv("/home/claude/burnclock/scratch/global/out/check_night_placebo.csv").set_index("year")
    ops = pd.read_csv("/home/claude/burnclock/scratch/global/out/check_opposite_sign.csv")
    o25 = ops[ops.years.astype(str) == "2025"].sort_values("tercile")
    v["clock_checks"] = {"terra_day_night_opposite_share": round(1 - float(npc.loc[2025, "T_day_night_same_sign_frac"]), 3),
                         "opposite_sign_by_afternoon_tercile": [round(float(x), 3) for x in o25.frac_A_up_T_down],
                         "year": 2025, "source": "scratch/global/out/check_night_placebo.csv, check_opposite_sign.csv (GLOBAL_ATLAS)"}
except Exception as e:
    v["clock_checks"] = {"error": str(e)}
v["same_day_pairs"] = None
v["same_day_pairs_note"] = "not computed by the harmonization pipeline"
outp = args.out or cfg["inputs"]["validation_out"]
atomic_json(outp, v, indent=1)
print("wrote", outp)
