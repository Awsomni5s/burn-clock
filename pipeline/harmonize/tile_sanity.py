"""Sanity: global annual sums of harm / harm_lo / harm_hi and src shares read back from public tiles."""
import json, glob, numpy as np, sys
m = json.load(open("/home/claude/burnclock/public/data/manifest.json"))["months"]
yrs = np.array([int(s[:4]) for s in m]); U = sorted(set(yrs))
H = np.zeros(len(m)); L = np.zeros(len(m)); Hi = np.zeros(len(m)); TA = np.zeros(len(m)); N = np.zeros(len(m)); bad = 0
srcM = np.zeros(len(m))
for f in glob.glob("/home/claude/burnclock/public/data/tiles/*.json"):
    t = json.load(open(f))
    a = np.array(t["harm"], float); H += np.nansum(a, 0)
    L += np.nansum(np.array(t["harm_lo"], float), 0); Hi += np.nansum(np.array(t["harm_hi"], float), 0)
    for p, arr in [("T", TA), ("A", TA), ("N", N)]:
        if t["raw"][p]:
            arr += np.nansum(np.array(t["raw"][p], float), 0)
    srcM += np.array([[c == "M" for c in s] for s in t["src"]]).sum(0)
    bad += int((np.array(t["harm_lo"], float) > a + 1e-6).sum() + (np.array(t["harm_hi"], float) < a - 1e-6).sum())
print("interval violations:", bad)
print("year  harm      lo        hi        rawT+A    rawN      src")
for y in U:
    s = yrs == y
    print(y, f"{H[s].sum():9.0f} {L[s].sum():9.0f} {Hi[s].sum():9.0f} {TA[s].sum():9.0f} {N[s].sum():9.0f}", "M" if srcM[s].sum() > 0 and N[s].sum() == 0 else ("V" if srcM[s].sum() == 0 else "mixed"))
