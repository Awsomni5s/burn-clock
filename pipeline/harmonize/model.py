"""Panel construction, VIIRS bridge, hierarchical k ratio model, GBM competitor."""
import numpy as np
import pandas as pd
from common import (PLATS, load_day, universe_cells, coverage_table, presence, add_levels,
                    continents_for, log)

VIIRS = ["N", "J1", "J2"]


class Panel:
    """Dense day-count arrays R[p][iy, cell, moy] for a set of years, plus coverage cov[p][iy, moy]."""

    def __init__(self, cfg, which, years, allow_locked=False, value=None, cells=None, df=None):
        self.cfg = cfg
        grid = cfg["inputs"][which]["grid_deg"]
        self.grid = grid
        if df is None:
            df = load_day(cfg, which, years=years, allow_locked=allow_locked, value=value)
        self.years = sorted(int(y) for y in years if (allow_locked or y not in cfg["method"]["years"]["locked_test"]))
        if cells is None:
            cells = universe_cells(cfg, which)
            cells = add_levels(cells, grid)
            cells["continent"] = continents_for(cfg, cells)
        self.cells = cells.reset_index(drop=True)
        n = len(self.cells)
        self.n = n
        df = df[df.year.isin(self.years)]
        kc = pd.DataFrame({"a": np.round(self.cells.lat.values * 4).astype(np.int64),
                           "b": np.round(self.cells.lon.values * 4).astype(np.int64), "ci": np.arange(n)})
        kd = pd.DataFrame({"a": np.round(df.lat.values * 4).astype(np.int64), "b": np.round(df.lon.values * 4).astype(np.int64)})
        ci = kd.merge(kc, on=["a", "b"], how="left").ci.fillna(-1).astype(np.int64).values
        assert (ci >= 0).all(), "rows outside universe"
        yi = np.searchsorted(self.years, df.year.values)
        mi = df.month.values.astype(int) - 1
        self.R = {}
        for p in PLATS:
            a = np.zeros((len(self.years), n, 12), np.float32)
            s = (df.plat.values == p)
            np.add.at(a, (yi[s], ci[s], mi[s]), df.v.values[s])
            self.R[p] = a
        covt = coverage_table(cfg, presence(df))
        self.cov = {p: np.array([[covt.loc[(y, m + 1), p] for m in range(12)] for y in self.years]) for p in PLATS}
        self.cov_sources = covt.attrs.get("sources", [])
        # hierarchy indices
        self.u1, self.i1 = np.unique(self.cells.c1.values, return_inverse=True)
        self.u5, self.i5 = np.unique(self.cells.c5.values, return_inverse=True)
        # parent of each 1deg cell in 5deg
        self.p1to5 = np.zeros(len(self.u1), int)
        self.p1to5[self.i1] = self.i5
        cm = self.cfg["method"]["coverage"]
        self.fit_min, self.use_min = cm["fit_min"], cm["use_min"]
        self.fitmask = ((self.cov["T"] >= self.fit_min) & (self.cov["A"] >= self.fit_min) &
                        (self.cov["N"] >= self.fit_min))  # [Y,12]

    def yidx(self, years):
        return [self.years.index(y) for y in years if y in self.years]

    def scaled(self, p, thr):
        """R/cov for usable months, NaN where cov<thr. [Y,n,12]"""
        c = self.cov[p]
        ok = c >= thr
        f = np.where(ok, 1.0 / np.where(c > 0, c, 1), np.nan).astype(np.float32)
        return self.R[p] * f[:, None, :]


# ------------------------------------------------------------------ bridge
def bridge_sums(pan, P, years):
    """Per (c5, moy) and global sums of N and P over months where N and P coverage >= fit_min."""
    iy = pan.yidx(years)
    ok = (pan.cov["N"] >= pan.fit_min) & (pan.cov[P] >= pan.fit_min)  # [Y,12]
    Ns, Ps = pan.scaled("N", pan.fit_min), pan.scaled(P, pan.fit_min)
    n5 = len(pan.u5)
    SN = np.zeros((n5, 12)); SP = np.zeros((n5, 12))
    for y in iy:
        for m in range(12):
            if ok[y, m]:
                SN[:, m] += np.bincount(pan.i5, Ns[y, :, m], n5)
                SP[:, m] += np.bincount(pan.i5, Ps[y, :, m], n5)
    return SN, SP


def bridge_from_sums(SN, SP, tau_b):
    gN, gP = SN.sum(0), SP.sum(0)
    rg = np.where(gP > 0, gN / np.where(gP > 0, gP, 1), np.nan)
    if np.isnan(rg).all():
        return None
    rg = np.where(np.isnan(rg), np.nanmean(rg), rg)
    den = SP + tau_b
    r = np.where(den > 0, (SN + tau_b * rg[None, :]) / np.where(den > 0, den, 1), rg[None, :])
    return r  # [n5,12]


def fit_bridges(pan, years, tau_b):
    out = {"N": np.ones((len(pan.u5), 12))}
    for P in ["J1", "J2"]:
        SN, SP = bridge_sums(pan, P, years)
        r = bridge_from_sums(SN, SP, tau_b)
        out[P] = r
    return out


def viirs_V(pan, r, thr):
    """Mean over usable VIIRS platforms (cov>=thr) of r_P * P/cov. NaN where none usable. [Y,n,12]"""
    num = np.zeros((len(pan.years), pan.n, 12), np.float32)
    cnt = np.zeros((len(pan.years), 1, 12), np.float32)
    for P in VIIRS:
        if r.get(P) is None:
            continue
        s = pan.scaled(P, thr)
        ok = ~np.isnan(s[:, 0, :])  # month-level usability
        if not ok.any():
            continue
        rr = r[P][pan.i5][None, :, :].astype(np.float32)
        num += np.where(ok[:, None, :], np.nan_to_num(s) * rr, 0)
        cnt[:, 0, :] += ok
    with np.errstate(invalid="ignore", divide="ignore"):
        V = np.where(cnt > 0, num / np.where(cnt > 0, cnt, 1), np.nan)
    return V.astype(np.float32)


# ------------------------------------------------------------------ k model
def M_of(pan, combo, thr):
    plats = {"TA": ["T", "A"], "T": ["T"], "A": ["A"]}[combo]
    out = None
    for p in plats:
        s = pan.scaled(p, thr)
        out = s if out is None else out + s
    return out


def k_sums(pan, V, M, years, mask=None, cell_keep=None):
    """Per-year cell x moy arrays restricted to fit months -> summed over years. returns Vc, Mc [n,12]."""
    iy = pan.yidx(years)
    fm = pan.fitmask if mask is None else mask
    Vc = np.zeros((pan.n, 12)); Mc = np.zeros((pan.n, 12))
    for y in iy:
        ok = fm[y] & ~np.isnan(V[y, 0, :]) & ~np.isnan(M[y, 0, :])
        Vc[:, ok] += V[y][:, ok]
        Mc[:, ok] += M[y][:, ok]
    if cell_keep is not None:
        Vc[~cell_keep] = 0; Mc[~cell_keep] = 0
    return Vc, Mc


def k_from_sums(pan, Vc, Mc, tau):
    n1, n5 = len(pan.u1), len(pan.u5)
    V1 = np.stack([np.bincount(pan.i1, Vc[:, m], n1) for m in range(12)], 1)
    M1 = np.stack([np.bincount(pan.i1, Mc[:, m], n1) for m in range(12)], 1)
    V5 = np.stack([np.bincount(pan.i5, Vc[:, m], n5) for m in range(12)], 1)
    M5 = np.stack([np.bincount(pan.i5, Mc[:, m], n5) for m in range(12)], 1)
    Vg, Mg = Vc.sum(0), Mc.sum(0)
    kg = np.where(Mg > 0, Vg / np.where(Mg > 0, Mg, 1), np.nan)
    kg = np.where(np.isnan(kg), np.nanmean(kg), kg)

    def shrink(V, M, parent):
        den = M + tau
        return np.where(den > 0, (V + tau * parent) / np.where(den > 0, den, 1), parent)

    k5 = shrink(V5, M5, kg[None, :])
    k1 = shrink(V1, M1, k5[pan.p1to5])
    if pan.grid >= 1.0 - 1e-9:   # cells are 1deg: cell level == 1deg level
        kc = k1[pan.i1]
    else:
        kc = shrink(Vc, Mc, k1[pan.i1])
    return kc  # [n,12]


def poisson_dev(y, mu):
    y = np.asarray(y, float); mu = np.asarray(mu, float)
    with np.errstate(divide="ignore", invalid="ignore"):
        t = np.where(y > 0, y * np.log(y / mu), 0.0) - (y - mu)
    return 2 * np.nansum(np.where(np.isfinite(t), t, np.inf))


# ------------------------------------------------------------------ GBM competitor
def gbm_design(pan, years, V, kt5, rng=None, sub=None, usable_only=True):
    """Dense rows (cell x month) for given years. Returns X, y, w, (iy, cell, moy)."""
    iy = pan.yidx(years)
    T = pan.scaled("T", pan.fit_min); A = pan.scaled("A", pan.fit_min)
    Xs, ys, ws, ids = [], [], [], []
    clat = pan.cells.clat.values.astype(np.float32); clon = pan.cells.clon.values.astype(np.float32)
    kt = kt5[pan.i5].astype(np.float32)
    for y in iy:
        for m in range(12):
            if usable_only and not (pan.fitmask[y, m] and not np.isnan(V[y, 0, m])):
                continue
            t, a, v = T[y, :, m], A[y, :, m], V[y, :, m]
            keep = np.ones(pan.n, bool); w = np.ones(pan.n, np.float32)
            if sub is not None:
                z = (t == 0) & (a == 0) & (v == 0)
                draw = rng.random(pan.n) < sub
                keep = ~z | draw
                w = np.where(z, 1.0 / sub, 1.0).astype(np.float32)
            idx = np.nonzero(keep)[0]
            X = np.column_stack([np.log1p(t[idx]), np.log1p(a[idx]), np.full(len(idx), m + 1, np.float32),
                                 clat[idx], clon[idx], kt[idx]]).astype(np.float32)
            Xs.append(X); ys.append(v[idx]); ws.append(w[idx])
            ids.append(np.column_stack([np.full(len(idx), y), idx, np.full(len(idx), m)]))
    return np.vstack(Xs), np.concatenate(ys), np.concatenate(ws), np.vstack(ids)


def tile_mean_k(pan, V, M, years):
    Vc, Mc = k_sums(pan, V, M, years)
    n5 = len(pan.u5)
    V5 = np.bincount(pan.i5, Vc.sum(1), n5); M5 = np.bincount(pan.i5, Mc.sum(1), n5)
    g = Vc.sum() / Mc.sum()
    return np.where(M5 > 0, V5 / np.where(M5 > 0, M5, 1), g)


def fit_gbm(cfg, pan, years, V, seed=0):
    from sklearn.ensemble import HistGradientBoostingRegressor
    g = cfg["method"]["gbm"]
    M = M_of(pan, "TA", pan.fit_min)
    kt5 = tile_mean_k(pan, V, M, years)
    rng = np.random.default_rng(cfg["method"]["uncertainty"]["seed"] + seed)
    X, y, w, _ = gbm_design(pan, years, V, kt5, rng=rng, sub=0.25)
    mdl = HistGradientBoostingRegressor(**g["params"], categorical_features=None)
    mdl.fit(X, np.log1p(y), sample_weight=w)
    p = np.expm1(mdl.predict(X)).clip(0)
    smear = float((w * y).sum() / (w * p).sum())
    return {"model": mdl, "kt5": kt5, "smear": smear, "n_rows": int(len(y))}


def predict_gbm(pan, g, years, V):
    X, y, w, ids = gbm_design(pan, years, V, g["kt5"], usable_only=True)
    p = np.expm1(g["model"].predict(X)).clip(0) * g["smear"]
    out = np.full((len(pan.years), pan.n, 12), np.nan, np.float32)
    out[ids[:, 0], ids[:, 1], ids[:, 2]] = p
    return out
