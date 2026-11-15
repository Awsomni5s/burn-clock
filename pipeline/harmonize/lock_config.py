"""Write CONFIG.lock = sha256 of the canonical method block. Refuses to overwrite an existing lock
unless --relock "<reason>" is given (the reason is appended to the lock history)."""
import sys, json, os, datetime
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from common import load_config, LOCK_PATH
cfg = load_config(require_lock=False)
h = cfg["config_hash"]
now = datetime.datetime.utcnow().isoformat(timespec="seconds") + "Z"
if os.path.exists(LOCK_PATH):
    lock = json.load(open(LOCK_PATH))
    if lock["config_hash"] == h:
        print("lock unchanged", h); sys.exit(0)
    if "--relock" not in sys.argv:
        sys.exit("method changed; use --relock '<reason>'")
    reason = sys.argv[sys.argv.index("--relock") + 1]
    lock.setdefault("history", []).append({"old": lock["config_hash"], "new": h, "utc": now, "reason": reason})
    lock["config_hash"] = h; lock["locked_utc"] = now
else:
    lock = {"config_hash": h, "locked_utc": now, "history": [], "unlocked_test_years": False}
json.dump(lock, open(LOCK_PATH, "w"), indent=1)
print("locked", h)
