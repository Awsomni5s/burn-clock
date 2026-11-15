"""Orchestrator: download -> hash -> stage-1 process -> log -> delete, for FIRMS yearly zips.

usage:
  python3 -I pipeline/run_archive.py --years 2013-2025 --products modis,viirs-snpp,viirs-jpss1,viirs-jpss2
  python3 -I pipeline/run_archive.py --years 2000-2012 --products modis,viirs-snpp --build

* Re-runnable: a year-product whose stage-1 stats file exists and whose manifest entry is OK is skipped.
* Downloads run without the CPU lock (the next zip is prefetched while the current one is processed).
* Each heavy stage-1 step runs as
      flock -w 7200 cpu.lock nice -n 10 python3 -I pipeline/process_year.py ...
  because other agents share the two cores.
* Every URL tried (also 404s) is logged in pipeline/out/MANIFEST_SOURCES.json with bytes, sha256
  and rows per CSV. Zips are deleted right after processing (disk budget < 6 GB).
* --build runs stage 2 (build_intermediate.py) after every --build-every finished years and at the end.
"""
import argparse
import concurrent.futures as cf
import hashlib
import json
import os
import subprocess
import sys
import time

sys.path.insert(0, "/home/claude/burnclock/pipeline")
from common import (FIRMS_URL, LOCK, OUT, PIPE, PRODUCT_YEARS, STAGE1, TMPZIP, utcnow,
                    write_json_atomic)

MAN = f"{OUT}/MANIFEST_SOURCES.json"
LOG = f"{OUT}/run_archive.log"
CURL_ENV = dict(os.environ, CURL_CA_BUNDLE="/root/.ccr/ca-bundle.crt")


def log(msg):
    line = f"{utcnow()} {msg}"
    print(line, flush=True)
    with open(LOG, "a") as fh:
        fh.write(line + "\n")


def load_manifest():
    if os.path.exists(MAN):
        return json.load(open(MAN))
    return {"description": "Every FIRMS yearly archive URL tried by pipeline/run_archive.py. "
                           "sha256/bytes are of the downloaded zip (deleted after processing). "
                           "rows_per_csv = all rows in each country CSV.", "entries": {}}


def save_entry(entry):
    m = load_manifest()
    m["entries"][f"{entry['product']}_{entry['year']}"] = entry
    m["updated_utc"] = utcnow()
    write_json_atomic(MAN, m, indent=1)


def download(product, year):
    """Download one zip; returns dict with http status, path, bytes, sha256, seconds."""
    url = FIRMS_URL.format(product=product, year=year)
    path = f"{TMPZIP}/{product}_{year}_all_countries.zip"
    t0 = time.time()
    for attempt in range(3):
        r = subprocess.run(["curl", "-sS", "--retry", "5", "--retry-all-errors", "--retry-delay", "3",
                            "--connect-timeout", "30",
                            "--speed-limit", "50000", "--speed-time", "60", "-o", path + ".part", "-w", "%{http_code}", url],
                           env=CURL_ENV, capture_output=True, text=True)
        code = r.stdout.strip()[-3:]
        if r.returncode == 0 and code == "200":
            os.replace(path + ".part", path)
            h = hashlib.sha256()
            with open(path, "rb") as fh:
                for chunk in iter(lambda: fh.read(1 << 22), b""):
                    h.update(chunk)
            return {"url": url, "http_status": 200, "path": path, "bytes": os.path.getsize(path),
                    "sha256": h.hexdigest(), "fetched_utc": utcnow(),
                    "download_seconds": round(time.time() - t0, 1), "attempts": attempt + 1}
        if os.path.exists(path + ".part"):
            os.remove(path + ".part")
        if code in ("404", "403", "410"):
            return {"url": url, "http_status": int(code), "path": None, "fetched_utc": utcnow()}
        log(f"download retry {product} {year}: rc={r.returncode} http={code} {r.stderr.strip()[-200:]}")
        time.sleep(10)
    return {"url": url, "http_status": int(code) if code.isdigit() else None, "path": None,
            "fetched_utc": utcnow(), "error": r.stderr.strip()[-300:]}


def done(product, year):
    m = load_manifest()["entries"].get(f"{product}_{year}", {})
    return os.path.exists(f"{STAGE1}/stats_{product}_{year}.json") and m.get("status") == "OK"


def parse_years(s):
    out = []
    for part in s.split(","):
        if "-" in part:
            a, b = map(int, part.split("-"))
            out += list(range(a, b + 1))
        else:
            out.append(int(part))
    return out


def run_locked(args, logfile):
    cmd = ["flock", "-w", "7200", LOCK, "nice", "-n", "10", "python3", "-I"] + args
    with open(logfile, "w") as fh:
        return subprocess.run(cmd, stdout=fh, stderr=subprocess.STDOUT).returncode


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--years", required=True)
    ap.add_argument("--products", default="modis,viirs-snpp,viirs-jpss1,viirs-jpss2")
    ap.add_argument("--build", action="store_true", help="run stage 2 during/after the run")
    ap.add_argument("--build-every", type=int, default=3)
    a = ap.parse_args()
    for d in (OUT, f"{OUT}/logs", STAGE1, TMPZIP):
        os.makedirs(d, exist_ok=True)
    products = a.products.split(",")
    jobs = [(p, y) for y in parse_years(a.years) for p in products
            if y in PRODUCT_YEARS.get(p, []) and not done(p, y)]
    log(f"start: {len(jobs)} jobs: {jobs}")

    pool = cf.ThreadPoolExecutor(max_workers=1)
    fut = pool.submit(download, *jobs[0]) if jobs else None
    years_done = set()
    for k, (p, y) in enumerate(jobs):
        dl = fut.result()
        fut = pool.submit(download, *jobs[k + 1]) if k + 1 < len(jobs) else None   # prefetch next
        entry = {"product": p, "year": y, **{x: dl.get(x) for x in
                 ("url", "http_status", "bytes", "sha256", "fetched_utc", "download_seconds", "attempts", "error")}}
        if dl["path"] is None:
            entry["status"] = "NOT_AVAILABLE" if dl["http_status"] in (403, 404, 410) else "DOWNLOAD_FAILED"
            save_entry(entry)
            log(f"{p} {y}: {entry['status']} (HTTP {dl['http_status']})")
            continue
        t0 = time.time()
        rc = run_locked([f"{PIPE}/process_year.py", dl["path"], p, str(y)], f"{OUT}/logs/stage1_{p}_{y}.log")
        entry["process_wall_seconds"] = round(time.time() - t0, 1)
        sf = f"{STAGE1}/stats_{p}_{y}.json"
        if rc == 0 and os.path.exists(sf):
            st = json.load(open(sf))
            entry.update(status="OK", csv_files=st["csv_files"], rows=st["rows_total"],
                         rows_per_csv=st["rows_per_csv"], process_cpu_seconds=st["seconds_total"])
        else:
            entry["status"] = f"PROCESS_FAILED_rc{rc}"
        save_entry(entry)
        os.remove(dl["path"])
        log(f"{p} {y}: {entry['status']} bytes={dl['bytes']} rows={entry.get('rows')} "
            f"dl={dl.get('download_seconds')}s proc={entry['process_wall_seconds']}s")
        years_done.add(y)
        last_of_year = k + 1 == len(jobs) or jobs[k + 1][1] != y
        if a.build and last_of_year and len(years_done) % a.build_every == 0:
            rc = run_locked([f"{PIPE}/build_intermediate.py"], f"{OUT}/logs/stage2_after_{y}.log")
            log(f"stage 2 after {y}: rc={rc}")
    pool.shutdown()
    if a.build:
        rc = run_locked([f"{PIPE}/build_intermediate.py"], f"{OUT}/logs/stage2_final.log")
        log(f"stage 2 final: rc={rc}")
    log("run_archive done")


if __name__ == "__main__":
    main()
