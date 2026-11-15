"""Shared helpers: config + hash lock, input adapter, coverage, geography, metrics."""
import os, sys, json, hashlib, datetime, calendar
import numpy as np
import pandas as pd
import yaml

HERE = os.path.dirname(os.path.abspath(__file__))
CONFIG_PATH = os.path.join(HERE, "CONFIG.yaml")
LOCK_PATH = os.path.join(HERE, "CONFIG.lock")
OUT = os.path.join(HERE, "out")
os.makedirs(OUT, exist_ok=True)
PLATS = ["T", "A", "N", "J1", "J2"]


def method_hash(cfg):
    canon = json.dumps(cfg["method"], sort_keys=True, separators=(",", ":"), default=str)
    return hashlib.sha256(canon.encode()).hexdigest()


def load_config(require_lock=True):
    cfg = yaml.safe_load(open(CONFIG_PATH))
    h = method_hash(cfg)
    if require_lock:
        if not os.path.exists(LOCK_PATH):
            sys.exit("CONFIG.lock missing: run lock_config.py before any scoring")
        lock = json.load(open(LOCK_PATH))
        if lock["config_hash"] != h:
            sys.exit(f"method block changed since lock ({lock['config_hash'][:12]} != {h[:12]}); refusing")
    cfg["config_hash"] = h
    return cfg


def log(*a):
    print(datetime.datetime.utcnow().strftime("%H:%M:%S"), *a, flush=True)


# ------------------------------------------------------------------ input adapter
def _pick(cols, cands):
    for c in cands:
        if c in cols:
            return c
    return None


def load_day(cfg, which, years=None, allow_locked=False, value=None):
    """Return long DataFrame: lat, lon (SW corner, deg), year, month, plat (T/A/N/J1/J2), v (float).
    Daytime only. Locked test years removed unless allow_locked."""
    import pyarrow.parquet as pq
    inp = cfg["inputs"][which]
    path = inp["path"]
    vcol = value or inp["value"]
    cols = pq.ParquetFile(path).schema_arrow.names
    locked = set(cfg["method"]["years"]["locked_test"])
    if which == "dev":
        df = pd.read_parquet(path, columns=["year", "ilat", "ilon", "month", "platform", "daynight", vcol])
        df = df[df.daynight == "D"]
        df = df.rename(columns={"ilat": "lat", "ilon": "lon", vcol: "v"})
        df["plat"] = df.platform.map({"T": "T", "A": "A", "N": "N", "N20": "J1", "J1": "J1", "J2": "J2", "N21": "J2"})
        df = df[["lat", "lon", "year", "month", "plat", "v"]]
    else:
        latc = _pick(cols, ["lat", "lat25", "cell_lat", "ilat", "lat_sw"])
        lonc = _pick(cols, ["lon", "lon25", "cell_lon", "ilon", "lon_sw"])
        ymc = _pick(cols, ["ym", "yyyymm", "month_str", "yearmonth"])
        plc = _pick(cols, ["plat", "platform", "sat"])
        dnc = _pick(cols, ["dn", "daynight", "day_night"])
        need = [latc, lonc, plc, dnc, vcol] + ([ymc] if ymc else ["year", "month"])
        assert None not in need, f"q25 schema not understood: {cols}"
        df = pd.read_parquet(path, columns=need)
        dnv = df[dnc]
        if dnv.dtype.kind in "iu":
            df = df[dnv == 1]
        else:
            df = df[dnv.astype(str).str.upper().str[0] == "D"]
        if ymc:
            ym = df[ymc].astype(str)
            df["year"] = ym.str[:4].astype(np.int16)
            df["month"] = ym.str[-2:].astype(np.int8)
        df = df.rename(columns={latc: "lat", lonc: "lon", vcol: "v", plc: "plat"})
        df["plat"] = df.plat.astype(str).map({"T": "T", "A": "A", "N": "N", "J1": "J1", "J2": "J2", "N20": "J1",
                                               "N21": "J2", "Terra": "T", "Aqua": "A"})
        df = df[["lat", "lon", "year", "month", "plat", "v"]]
    df = df[df.plat.notna()]
    if not allow_locked:
        df = df[~df.year.isin(locked)]
    if years is not None:
        df = df[df.year.isin(years)]
    df["v"] = df.v.astype(np.float64)
    df["year"] = df.year.astype(np.int16)
    df["month"] = df.month.astype(np.int8)
    df = df.groupby(["lat", "lon", "year", "month", "plat"], as_index=False, observed=True).v.sum()
    return df


def universe_cells(cfg, which):
    """Cells with >=1 detection ever (any platform, day or night, all years incl. locked: geometry only)."""
    inp = cfg["inputs"][which]
    if which == "dev":
        d = pd.read_parquet(inp["path"], columns=["ilat", "ilon"]).drop_duplicates()
        d = d.rename(columns={"ilat": "lat", "ilon": "lon"})
    else:
        import pyarrow.parquet as pq
        cols = pq.ParquetFile(inp["path"]).schema_arrow.names
        latc = _pick(cols, ["lat", "lat25", "cell_lat", "ilat", "lat_sw"])
        lonc = _pick(cols, ["lon", "lon25", "cell_lon", "ilon", "lon_sw"])
        d = pd.read_parquet(inp["path"], columns=[latc, lonc]).drop_duplicates()
        d = d.rename(columns={latc: "lat", lonc: "lon"})
    return d.sort_values(["lat", "lon"]).reset_index(drop=True)


# ------------------------------------------------------------------ coverage
def coverage_table(cfg, years_present):
    """DataFrame index (year, month), columns PLATS, coverage in [0,1]."""
    idx = pd.MultiIndex.from_tuples([(y, m) for y in range(2000, 2027) for m in range(1, 13)], names=["year", "month"])
    cov = pd.DataFrame(np.nan, index=idx, columns=PLATS)
    man = cfg["inputs"]["manifest"]
    used = []
    pmap = {0: "T", 1: "A", 2: "N", 3: "J1", 4: "J2"}
    p = cfg["inputs"]["coverage_csv"]
    if os.path.exists(p):
        c = pd.read_csv(p)
        for r in c.itertuples():
            cov.loc[(r.year, r.month), pmap[r.plat]] = r.coverage
        used.append(p)
    od = cfg["inputs"].get("outage_days")
    if od and os.path.exists(od):
        try:
            oj = json.load(open(od))
            for p_, info in oj.get("platforms", {}).items():
                if p_ not in PLATS:
                    continue
                miss = pd.to_datetime(pd.Series(info.get("missing_days", []), dtype=str))
                first, last = pd.Timestamp(info["first_day"]), pd.Timestamp(info["last_day"])
                for per in pd.period_range(first.to_period("M"), last.to_period("M"), freq="M"):
                    nd = per.days_in_month
                    st, en = per.start_time.normalize(), per.end_time.normalize()
                    lo, hi = max(st, first), min(en, last)
                    flying = (hi - lo).days + 1
                    nm = int(((miss >= lo) & (miss <= hi)).sum()) if len(miss) else 0
                    cov.loc[(per.year, per.month), p_] = max(0.0, (flying - nm) / nd)
            used.append(od)
        except Exception as e:
            log("outage_days read failed", e)
    if os.path.exists(man):
        try:
            mj = json.load(open(man))
            for o in mj.get("outage_months", []):
                y, m = map(int, o["month"].split("-"))
                nd = calendar.monthrange(y, m)[1]
                cov.loc[(y, m), o["platform"]] = 1 - len(o.get("missing_days", [])) / nd
            used.append(man)
        except Exception as e:
            log("manifest outage read failed", e)
    # platform-months with data but no coverage info -> 1.0 ; without data -> 0
    for p_ in PLATS:
        pres = years_present.get(p_, set())
        for ym in cov.index:
            if np.isnan(cov.loc[ym, p_]):
                cov.loc[ym, p_] = 1.0 if ym in pres else 0.0
            elif ym not in pres:
                cov.loc[ym, p_] = 0.0
    cov.attrs["sources"] = used
    return cov


def presence(df):
    return {p: set(map(tuple, g[["year", "month"]].drop_duplicates().values.tolist()))
            for p, g in df.groupby("plat")}


# ------------------------------------------------------------------ geography
def add_levels(cells, grid):
    """cells: DataFrame lat, lon (SW corner). Adds c1 (1deg key), c5 (5deg tile key), centre coords."""
    c = cells.copy()
    c["clat"] = c.lat + grid / 2
    c["clon"] = c.lon + grid / 2
    c["l1"] = np.floor(c.lat + 1e-9).astype(int)
    c["o1"] = np.floor(c.lon + 1e-9).astype(int)
    c["l5"] = (np.floor(c.lat / 5 + 1e-9) * 5).astype(int)
    c["o5"] = (np.floor(c.lon / 5 + 1e-9) * 5).astype(int)
    c["c1"] = c.l1 * 1000 + c.o1
    c["c5"] = c.l5 * 1000 + c.o5
    return c


def tile_name(l5, o5):
    f = lambda v, w: ("p" if v >= 0 else "m") + str(abs(int(v))).zfill(w)
    return f"{f(l5, 2)}_{f(o5, 3)}"


def continents_for(cfg, cells):
    sys.path.insert(0, "/home/claude/burnclock/scratch/global")
    from regions import continent
    ct = pd.read_parquet(cfg["inputs"]["country_cells"], columns=["country", "ilat", "ilon", "plat", "n"])
    ct = ct[ct.plat == 2].groupby(["ilat", "ilon", "country"]).n.sum().reset_index()
    ct = ct.sort_values("n", ascending=False).drop_duplicates(["ilat", "ilon"])
    ct["continent"] = [continent(a, b + 0.5) for a, b in zip(ct.country, ct.ilon)]
    m = dict(zip(zip(ct.ilat, ct.ilon), ct.continent))
    return np.array([m.get((a, b), "Unmapped") for a, b in zip(cells.l1, cells.o1)])


def in_box(cells, box):
    s, w, n, e = box
    return ((cells.clat >= s) & (cells.clat <= n) & (cells.clon >= w) & (cells.clon <= e)).values


# ------------------------------------------------------------------ metrics
def annual_err(pred_year_tot, obs_year_tot):
    """dicts year->total. returns per-year signed % error list."""
    out = {}
    for y in obs_year_tot:
        o = obs_year_tot[y]
        if o > 0:
            out[int(y)] = 100.0 * (pred_year_tot.get(y, 0.0) - o) / o
    return out


def r2_log(pred, obs):
    p = np.log1p(np.asarray(pred, float))
    o = np.log1p(np.asarray(obs, float))
    if len(o) < 3:
        return None
    ss = ((o - o.mean()) ** 2).sum()
    return float(1 - ((o - p) ** 2).sum() / ss) if ss > 0 else None


def summarize(errs):
    v = np.array(list(errs.values()), float)
    if len(v) == 0:
        return {"median_annual_err_pct": None, "mean_signed_err_pct": None, "n_years": 0}
    return {"median_annual_err_pct": round(float(np.median(np.abs(v))), 2),
            "mean_signed_err_pct": round(float(v.mean()), 2),
            "per_year_signed_pct": {str(k): round(x, 2) for k, x in sorted(errs.items())},
            "n_years": int(len(v))}


def atomic_json(path, obj, **kw):
    tmp = path + f".tmp{os.getpid()}"
    with open(tmp, "w") as f:
        json.dump(obj, f, **kw)
    os.replace(tmp, path)
