"""Exit 0 iff q25_month.parquet has daytime T, A, N data for every year 2013-2025."""
import sys, pyarrow.parquet as pq
try:
    t = pq.read_table("/home/claude/burnclock/data/processed/q25_month.parquet", columns=["ym", "plat"]).to_pandas()
except Exception as e:
    print("not readable", e); sys.exit(1)
t["y"] = t.ym.astype(str).str[:4].astype(int)
have = t.groupby("plat", observed=True).y.agg(lambda s: set(s.unique()))
need = set(range(2013, 2026))
ok = all(p in have.index and need <= have[p] for p in ["T", "A", "N"])
print({p: (min(v), max(v), len(v)) for p, v in have.items()}, "ready" if ok else "not ready")
sys.exit(0 if ok else 1)
