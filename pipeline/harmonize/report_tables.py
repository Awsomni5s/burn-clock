"""Print markdown tables from public/data/validation.json (or a given path) for VALIDATION_REPORT.md."""
import json, sys
p = sys.argv[1] if len(sys.argv) > 1 else "/home/claude/burnclock/public/data/validation.json"
v = json.load(open(p))
f = lambda x, n=1: "–" if x is None else (f"{x:.{n}f}" if isinstance(x, (int, float)) else str(x))
CONT = ["Africa", "Asia", "Europe", "North America", "Oceania", "South America"]


def row(name, m):
    if not m:
        return f"| {name} | – | – | – | – |"
    py = m.get("per_year_signed_pct") or {}
    return (f"| {name} | {f(m.get('median_annual_err_pct'))} | {f(m.get('mean_signed_err_pct'))} | "
            f"{f(m.get('r2_log_monthly'), 3)} | {', '.join(f'{k}: {x:+.1f}' for k, x in py.items())} |")


H = "| Region | Median abs annual err % | Mean signed % | R² log monthly | Per-year signed % |\n|---|---|---|---|---|"
L = v["loyo"]
print("### LOYO, ratio bridge (pre-drift)\n" + H)
print(row("Global", L["global"]))
for c in CONT:
    print(row(c, L["by_continent"].get(c)))
print(row("Punjab+Haryana", L["punjab"]))
print(row("Paraná Delta", L["parana"]))
print(f"\n5° tile-years: median |annual err| {f(L['tile_5deg']['median_abs_annual_err_pct_tile_years'])}% (n={L['tile_5deg']['n_tile_years']})\n")

print("### Models on identical LOYO splits\n| Model | Global med err % | Global R² | Punjab med err % | Punjab R² | Paraná med err % | Primary (5° tile-years) % |\n|---|---|---|---|---|---|---|")
for m in v["models"]:
    s = m["score"]
    g, pj, pa = s.get("loyo_global") or {}, s.get("loyo_punjab") or {}, s.get("loyo_parana") or {}
    print(f"| {m['name']} | {f(g.get('median_annual_err_pct'))} | {f(g.get('r2_log_monthly'), 3)} | {f(pj.get('median_annual_err_pct'))} | "
          f"{f(pj.get('r2_log_monthly'), 3)} | {f(pa.get('median_annual_err_pct'))} | {f(s.get('primary_tile_median_abs_annual_err_pct'))} |")
print(f"\nChosen: **{v['chosen_model']}** ({json.dumps(v['model_choice'])})\n")

if v.get("locked_test_scored"):
    print("### Locked test years 2016, 2019 (scored once, after freezing)\n" + H)
    for m in v["models"]:
        lk = m["score"].get("locked")
        if not lk:
            continue
        print(row(f"{m['name']} global", lk["global"]))
        for c in CONT:
            print(row(f"{m['name']} {c}", lk["by_continent"].get(c)))
        print(row(f"{m['name']} Punjab", lk["punjab"]))
        print(row(f"{m['name']} Paraná", lk["parana"]))
        print(f"| {m['name']} 5° tile-years | {f(lk['tile_5deg']['median_abs_annual_err_pct_tile_years'])} | | | n={lk['tile_5deg']['n_tile_years']} |")

print("\n### LORO\n" + H)
for r in v["loro"]["by_region"]:
    print(row(r["region"] + " (held out)", r))
tb = v["loro"]["tile_blocks_5deg"]
print(f"\n5° tile blocks ({tb['n_folds']} folds): global {f((tb.get('global') or {}).get('median_annual_err_pct'))}%, "
      f"tile-years median {f(tb.get('median_abs_annual_err_pct_tile_years'))}% (n={tb.get('n_tile_years')})\n")

print("### Denial\n| Hidden | From | Design | Global med err % | Global R² | Punjab med err % | Paraná med err % | 5° tile-years % |\n|---|---|---|---|---|---|---|---|")
for d in v["denial"]:
    print(f"| {d['hidden']} | {d['reconstructed_from']} | {d['design']} | {f(d['median_err_pct'])} | {f(d['r2_log_monthly'], 3)} | "
          f"{f((d['punjab'] or {}).get('median_annual_err_pct'))} | {f((d['parana'] or {}).get('median_annual_err_pct'))} | "
          f"{f((d.get('tile_5deg') or {}).get('median_abs_annual_err_pct_tile_years'))} |")

print("\n### Drift seam: MODIS-only reconstruction / observed VIIRS, R(y)")
cp = v["changepoint"]["drift_2020_22"]
regs = {"Global": cp["global"], **cp["by_region"]}
yrs = sorted(next(iter(regs.values()))["R_by_year"].keys())
print("| Region | " + " | ".join(yrs) + " | seam 2023-25 / training |\n|" + "---|" * (len(yrs) + 2))
for k, x in regs.items():
    print(f"| {k} | " + " | ".join(f(x["R_by_year"].get(y), 3) for y in yrs) + f" | {f(x['seam_2023_25_vs_training'], 3)} |")

s12 = v["changepoint"]["seam_2012"]
print("\n### 2012 seam")
if s12.get("raw_jump") is None:
    print(s12.get("note"))
else:
    print("| Region | raw jump | harmonized jump | MODIS-only jump |\n|---|---|---|---|")
    print(f"| Global | {f(s12['raw_jump'], 2)} | {f(s12['harm_jump'], 2)} | {f(s12['modis_only_jump'], 2)} |")
    for k, x in s12["by_region"].items():
        print(f"| {k} | {f(x['raw_jump'], 2)} | {f(x['harm_jump'], 2)} | {f(x['modis_only_jump'], 2)} |")

dc = [m for m in v["models"] if m["name"].startswith("ratio_bridge_all")][0]
print("\n### Drift-contaminated fit (k on 2013-2025) vs pre-drift\n| Region | LOYO med err % (all-years k) | mean signed % | scale k_all/k_pre −1, 2013-15 (%) | MODIS era (%) |\n|---|---|---|---|---|")
sc = dc["k_all_vs_k_pre_scale_pct"]
for k in ["global"] + CONT + ["punjab_haryana", "parana_delta"]:
    m = dc["score"]["loyo_global"] if k == "global" else (dc["score"]["by_continent"].get(k) if k in CONT else dc["score"].get("loyo_punjab" if k == "punjab_haryana" else "loyo_parana"))
    s = sc.get(k, {})
    print(f"| {k} | {f((m or {}).get('median_annual_err_pct'))} | {f((m or {}).get('mean_signed_err_pct'))} | {f(s.get('2013-15'), 2)} | {f(s.get('MODIS-era 2003-2011'), 2)} |")

print("\n### Benchmarks")
for b in v["benchmarks"]:
    print("-", json.dumps(b))
