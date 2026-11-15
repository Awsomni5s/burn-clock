"""Exit 0 iff q25 has T 2000-2025, A 2002-2025, N 2012-2025 and public manifest + tiles are newer than q25."""
import sys, os, glob, json, pyarrow.parquet as pq
Q = "/home/claude/burnclock/data/processed/q25_month.parquet"
MAN = "/home/claude/burnclock/public/data/manifest.json"
try:
    t = pq.read_table(Q, columns=["ym", "plat"]).to_pandas()
except Exception as e:
    print("q25 unreadable", e); sys.exit(1)
t["y"] = t.ym.astype(str).str[:4].astype(int)
have = t.groupby("plat", observed=True).y.agg(lambda s: set(s.unique()))
ok = (set(range(2000, 2026)) <= have.get("T", set()) and set(range(2002, 2026)) <= have.get("A", set())
      and set(range(2012, 2026)) <= have.get("N", set()))
tiles = glob.glob("/home/claude/burnclock/public/data/tiles/*.json")
pub = os.path.exists(MAN) and len(tiles) > 0 and os.path.getmtime(MAN) > os.path.getmtime(Q)
if pub:
    m = json.load(open(MAN))
    pub = len(m.get("tiles", [])) == len(tiles) and m.get("months", [""])[0] <= "2000-11"
print({p: (min(v), max(v), len(v)) for p, v in have.items()}, "q25_full" if ok else "q25_partial",
      "public_ready" if pub else "public_not_ready", len(tiles))
sys.exit(0 if ok and pub else 1)
