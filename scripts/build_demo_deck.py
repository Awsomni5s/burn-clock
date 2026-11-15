"""Builds the 7-slide Space Apps demo deck (PDF) from real app screenshots and data files.
Run from the repo root with a preview server on :4173 after /tmp deck screenshots exist in .deck/img.
Output: public/docs/Burn_Clock_Demo_7_Slides.pdf (+ PNG per slide in .deck/out)."""
import json, gzip, base64, pathlib, asyncio
from playwright.async_api import async_playwright
from PIL import Image

R = pathlib.Path(".")
IMG = R / ".deck/img"; OUT = R / ".deck/out"; OUT.mkdir(parents=True, exist_ok=True)
TEAM = json.loads((R / ".deck/team.json").read_text()) if (R / ".deck/team.json").exists() else {}
team_name = TEAM.get("team") or "[TEAM NAME]"
members = TEAM.get("members") or "[Member 1] · [Member 2] · [Member 3]"
site = TEAM.get("site") or "[live site link]"
repo = TEAM.get("repo") or "github.com/Awsomni5s/burn-clock"
ph = lambda s: s if not s.startswith("[") else f'<mark>{s}</mark>'

man = json.load(gzip.open(R / "public/data/manifest.json.gz"))
val = json.load(gzip.open(R / "public/data/validation.json.gz"))
gk = json.load(open(R / "public/data/gk2a_hourly_by_year.json"))
cases = json.load(open(R / "public/data/case_studies.json"))["cases"]
rows = man["totals"]["detections_processed"]
loyo = val["loyo"]; seam = val["changepoint"]["seam_2012"]
ph_ = gk["pixel_hours"]
share = lambda y, hs: 100 * sum(v for h, v in zip(gk["hours_ist"], ph_[y]) if h in hs) / sum(ph_[y])
late19, late25 = share("2019", [16, 17, 18]), share("2025", [16, 17, 18])
early19, early25 = share("2019", [13, 14]), share("2025", [13, 14])
img = lambda f: "data:image/png;base64," + base64.b64encode((IMG / f).read_bytes()).decode()
logo = "data:image/svg+xml;base64," + base64.b64encode((R / "public/brand/burnclock_lockup_mono_light.svg").read_bytes()).decode()
VC = {"timing": ("#c2410c", "#fff1e0", "#7a3300"), "modis": ("#b58105", "#fff7d6", "#6b4a00"), "clear": ("#00703c", "#e7f4ec", "#005a30"), "unknown": ("#6f777b", "#f3f2f1", "#383f43")}
chip = lambda v, t: f'<span class="chip" style="border-color:{VC[v][0]};background:{VC[v][1]};color:{VC[v][2]}">{t}</span>'

CSS = """*{box-sizing:border-box}body{margin:0;background:#888;font-family:-apple-system,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#0b0c0c}
.s{width:1280px;height:720px;background:#fff;position:relative;overflow:hidden;padding:46px 58px 40px;margin:0 0 20px}
h1{font-size:46px;line-height:1.08;margin:0 0 14px;letter-spacing:-.02em}h2{font-size:38px;line-height:1.1;margin:0 0 10px;letter-spacing:-.02em}
p{font-size:21px;line-height:1.4;margin:0 0 12px}.sub{font-size:22px;color:#383f43}.small{font-size:15px;color:#505a5f}
.eyebrow{font-size:14px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:#b34b20;margin:0 0 8px}
.foot{position:absolute;left:58px;right:58px;bottom:18px;display:flex;justify-content:space-between;font-size:12px;color:#6f777b;border-top:1px solid #ddd;padding-top:6px}
.cols{display:grid;gap:30px;align-items:start}.shot{width:100%;border:1px solid #d4d8db;box-shadow:0 2px 10px rgba(0,0,0,.08)}
.big{font-size:56px;font-weight:800;color:#b34b20;line-height:1}.kpis{display:grid;grid-template-columns:repeat(3,1fr);gap:18px;margin:16px 0}
.kpi{border-top:5px solid #b34b20;padding-top:8px}.kpi b{display:block;font-size:34px}.kpi span{font-size:16px;color:#383f43}
.chip{display:inline-block;border:2px solid;font-weight:700;font-size:15px;padding:2px 8px;white-space:nowrap}
table{border-collapse:collapse;width:100%;font-size:17px}td,th{border-bottom:1px solid #d4d8db;padding:8px 8px;text-align:left;vertical-align:top}th{font-size:14px;color:#505a5f}
mark{background:#ffdd00;padding:0 4px}ul{margin:6px 0 0;padding-left:22px}li{font-size:19px;line-height:1.4;margin:0 0 7px}
.logo{height:44px}"""

foot = lambda n: f'<div class="foot"><span>Burn Clock · {ph(team_name)} · NASA Space Apps 2026 · Harmonization of MODIS and VIIRS Hot Spots</span><span>Prepared with AI assistance · {n}/7</span></div>'

def vcard(c, big=False):
    e, bg, ink = VC[c['verdict']]
    fs = 30 if big else 24
    return (f'<div style="border:2px solid {e};border-left:12px solid {e};padding:18px 22px">'
            f'<div class="small" style="font-weight:700;letter-spacing:.08em">CAN YOU TRUST THIS TREND? · {c["title"].upper()} · {c["season"].split(" (")[0].upper()}</div>'
            f'<div style="display:inline-block;margin:10px 0;padding:4px 12px;border:2px solid {e};background:{bg};color:{ink};font-weight:800;font-size:{fs}px">{c["verdict_label"]}</div>'
            f'<p style="font-size:{20 if big else 18}px;font-weight:700;margin:0 0 12px">{c["sentence"]}</p>'
            f'<div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;font-size:16px"><div style="border:1px solid #d4d8db;padding:8px 10px">Has burning moved to hours the satellites miss? <b>{c["late"]}</b></div>'
            f'<div style="border:1px solid #d4d8db;padding:8px 10px">Is the older MODIS record off here? <b>{c["modis"]}</b></div></div></div>')
byid = {c['id']: c for c in cases}
S = []
S.append(f"""<div class="s"><img class="logo" src="{logo}"><div class="cols" style="grid-template-columns:1.05fr 1fr;margin-top:26px">
<div><p class="eyebrow">NASA Space Apps 2026 · Harmonization of MODIS and VIIRS Hot Spots</p><h1>Can you trust the fire count for your area?</h1>
<p class="sub">Burn Clock joins NASA’s MODIS and VIIRS fire records into one 2001–2025 series, then tells you, for any place, whether a fire trend is real or an artifact of <b>when satellites look</b>, and what to do about it.</p>
<p style="margin-top:22px;font-size:19px"><b>Team:</b> {ph(team_name)}<br><b>Members:</b> {ph(members)}</p>
<p style="font-size:17px">Live: {ph(site)} · Code: {repo}</p></div>
<div style="margin-top:40px">{vcard(byid['punjab-stubble'], True)}<p class="small" style="margin-top:8px">The answer every place report leads with: Punjab + Haryana, Oct–Nov, 2021 vs 2025. Live output of the app.</p></div></div>{foot(1)}</div>""")

S.append(f"""<div class="s"><p class="eyebrow">The problem</p><h2>Satellites count fires at a few fixed times a day. Burning moved.</h2>
<div class="cols" style="grid-template-columns:1fr 1fr;margin-top:14px"><div>
<p>India reported that Punjab’s farm fires fell <b>93%</b> from 2021 to 2025. That count comes from polar satellites passing at about 10 am and 1:30 pm.</p>
<p>A Korean geostationary satellite (GK2A) watches every 10 minutes. It shows burning moving later, every year:</p>
<div class="kpis" style="grid-template-columns:1fr 1fr"><div class="kpi"><b>{late19:.0f}% → {late25:.0f}%</b><span>of afternoon fire detections at 4 pm or later, 2019 → 2025</span></div><div class="kpi" style="border-color:#1d70b8"><b style="color:#1d70b8">{early19:.0f}% → {early25:.0f}%</b><span>at 1–2 pm, when the counting satellites pass</span></div></div>
<p style="font-size:19px">And two of the satellites drifted: Terra now passes about an hour earlier, Aqua about an hour later. Every MODIS-based record is bent.</p>
<p class="small">The Punjab shift was first reported by NASA (Jethva 2026), ISRO’s Space Applications Centre and iFOREST (2025). Burn Clock makes the check possible anywhere.</p></div>
<div><img class="shot" src="{img('hourshare.png')}"></div></div>{foot(2)}</div>""")

S.append(f"""<div class="s"><p class="eyebrow">What we built: the harmonized record</p><h2>One fire record, 2001–2025, from {rows:,} NASA detections</h2>
<div class="kpis"><div class="kpi"><b>×{seam['raw_jump']:.2f} → ×{seam['harm_jump']:.2f}</b><span>the 2012 MODIS→VIIRS jump, before and after harmonization</span></div><div class="kpi"><b>{loyo['global']['median_annual_err_pct']:.1f}%</b><span>median error on years held out of the model (Punjab {loyo['punjab']['median_annual_err_pct']:.1f}%)</span></div><div class="kpi"><b>5 satellites</b><span>Terra, Aqua, S-NPP, NOAA-20 archive · NOAA-21 in the live view</span></div></div>
<div class="cols" style="grid-template-columns:1.5fr 1fr"><img class="shot" src="{img('annual_punjab.png')}"><div><p style="font-size:19px">MODIS is converted to the VIIRS scale using only 2013–19, before the drift. Every value carries a range.</p><p style="font-size:19px">Where it fails, we show it: conversion factors don’t carry between continents (Europe, Oceania), and the Paraná Delta is noisy.</p></div></div>{foot(3)}</div>""")

S.append(f"""<div class="s"><p class="eyebrow">What only Burn Clock does</p><h2>Every place gets a verdict: can you trust this trend?</h2>
<p style="font-size:20px">Two checks, for the exact place and months you choose: <b>Has burning moved to hours the satellites miss?</b> (the later-drifting Aqua vs fixed VIIRS) and <b>Is the older MODIS record off?</b> (Terra and Aqua vs VIIRS, against 2013–19).</p>
<div class="cols" style="grid-template-columns:1fr 1fr;margin-top:10px">{vcard(byid['punjab-stubble'])}{vcard(byid['kalimantan'])}</div><p class="small" style="margin-top:12px">Satellites compared with themselves for the chosen months; a change beyond twice the normal 2013–19 swing counts. A diagnostic, not proof of cause.</p>{foot(4)}</div>""")

rows_html = "".join(f"<tr><td>{chip(c['verdict'], c['verdict_label'])}</td><td><b>{c['title']}</b><br><span class='small'>{c['season']} · {c['a']} vs {c['b']}</span></td><td>{c['lesson']}</td></tr>" for c in cases)
kinds = len({c['verdict'] for c in cases})
S.append(f"""<div class="s"><p class="eyebrow">Case studies</p><h2>Six places, {['','one','two','three','four','five','six'][kinds]} different answers</h2>
<p style="font-size:19px">Burn Clock doesn’t say “timing matters” everywhere. Each verdict below is computed by the app itself.</p>
<table><tr><th style="width:290px">Verdict</th><th style="width:330px">Place and season</th><th>Lesson</th></tr>{rows_html}</table>{foot(5)}</div>""")

ADV = [("Monitor or enforce", "Watch the late afternoon, after 3–4 pm, and add a geostationary feed to fire alerts.", "Track change since 2020 with VIIRS or the combined record, not MODIS counts."),
       ("Forecast air quality", "Move your fire timing later; don’t scale emissions with VIIRS counts.", "Use VIIRS-based activity data from 2021; your timing profile can stay."),
       ("Report a claim", "Don’t report the drop in the count as the drop in burning.", "Ask whether a MODIS-based trend allows for the satellites’ drift."),
       ("Study trends", "Treat post-2021 changes as partly a timing effect.", "Don’t use Terra or Aqua trends after 2020 without a drift correction.")]
adv_rows = "".join(f"<tr><th style='font-size:17px;color:#0b0c0c'>{r}</th><td>{a}</td><td>{b}</td></tr>" for r, a, b in ADV)
S.append(f"""<div class="s"><p class="eyebrow">From answer to action</p><h2>The advice changes with the verdict and with your job</h2>
<div class="cols" style="grid-template-columns:1.45fr 1fr;margin-top:12px"><table><tr><th style="width:150px">If you…</th><th>{chip('timing','Timing matters')} Punjab, Oct–Nov</th><th>{chip('modis','MODIS record off')} Kalimantan, Aug–Sep</th></tr>{adv_rows}</table>
<div><img class="shot" src="{img('claimcard_top.png')}"><p class="small" style="margin-top:6px">Share a claim card: the verdict and its caveats travel inside the image. Print a one-page monitoring brief. Download CSV and GeoJSON.</p></div></div>{foot(6)}</div>""")
S.append(f"""<div class="s"><p class="eyebrow">Why you can trust it</p><h2>Every number traces to NASA data and the code that made it</h2>
<div class="cols" style="grid-template-columns:1fr 1fr;margin-top:10px"><div><ul>
<li>Click any number to see its file, field and producing script.</li><li>Method locked before scoring; two test years held back and scored once.</li><li>Automated checks rebuild the reference numbers on every push.</li><li>Real failures and limits are on the page, not hidden.</li><li>Case-study verdicts are generated by the app’s own code.</li></ul></div>
<div><p style="font-size:19px"><b>NASA data:</b> FIRMS MODIS C6.1 (Terra, Aqua) and VIIRS 375 m (S-NPP, NOAA-20), 2000–2025; FIRMS near-real-time feeds incl. NOAA-21.</p>
<p style="font-size:19px"><b>Other data:</b> GK2A-AMI hourly fire data, Punjab and Haryana (KMA satellite; Jethva 2026, Zenodo 20084790, CC-BY-4.0); Natural Earth; geoBoundaries.</p>
<p style="font-size:19px"><b>AI use:</b> built with AI assistants (Claude, Codex) for code, analysis and text; the team reviewed results. No AI-generated imagery.</p>
<p style="font-size:20px;margin-top:16px"><b>Try it:</b> {ph(site)}<br><b>Code:</b> {repo}</p></div></div>{foot(7)}</div>""")

html = f"<!doctype html><html><head><meta charset='utf-8'><style>{CSS}</style></head><body>{''.join(S)}</body></html>"
(R / ".deck/deck.html").write_text(html)

async def render():
    async with async_playwright() as p:
        b = await p.chromium.launch(); pg = await b.new_page(viewport={"width": 1280, "height": 720}, device_scale_factor=2)
        await pg.goto("file://" + str((R / ".deck/deck.html").resolve())); await pg.wait_for_timeout(500)
        n = await pg.locator(".s").count()
        for i in range(n):
            await pg.locator(".s").nth(i).screenshot(path=str(OUT / f"slide_{i+1}.png"))
        await b.close()
    ims = [Image.open(OUT / f"slide_{i+1}.png").convert("RGB") for i in range(n)]
    ims[0].save(R / "public/docs/Burn_Clock_Demo_7_Slides.pdf", save_all=True, append_images=ims[1:], resolution=192)
    print(n, "slides")
asyncio.run(render())
