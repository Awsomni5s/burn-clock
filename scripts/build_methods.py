"""Create Burn Clock's methods PDF from the delivered final JSON and app rules.

Run with the bundled Python (reportlab/pypdf). No upstream observations are changed.
"""
from pathlib import Path
import json
from xml.sax.saxutils import escape
from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, PageBreak

APP = Path(__file__).resolve().parents[1]
ROOT = APP.parent
DATA = ROOT / 'public/data'
OUT = APP / 'public/docs/Burn_Clock_Methods.pdf'
M = json.loads((DATA/'manifest.json').read_text())
V = json.loads((DATA/'validation.json').read_text())
R = json.loads((DATA/'punjab_receipt.json').read_text())
W = next(x for x in json.loads((DATA/'world/continents.json').read_text()) if x['continent']=='World')
INK = colors.HexColor('#272c29'); MUTED=colors.HexColor('#5d665f'); ORANGE=colors.HexColor('#cc6541'); GREEN=colors.HexColor('#497d6a')
styles = {
 'title':ParagraphStyle('title',fontName='Helvetica-Bold',fontSize=30,leading=34,textColor=INK,spaceAfter=16),
 'subtitle':ParagraphStyle('subtitle',fontName='Helvetica',fontSize=13,leading=19,textColor=MUTED,spaceAfter=14),
 'h':ParagraphStyle('h',fontName='Helvetica-Bold',fontSize=15,leading=20,textColor=GREEN,spaceBefore=12,spaceAfter=8),
 'body':ParagraphStyle('body',fontName='Helvetica',fontSize=10.4,leading=15.2,textColor=INK,spaceAfter=9),
 'small':ParagraphStyle('small',fontName='Helvetica',fontSize=8.6,leading=12.2,textColor=MUTED,spaceAfter=7),
 'formula':ParagraphStyle('formula',fontName='Courier',fontSize=10.2,leading=15,textColor=INK,backColor=colors.HexColor('#f3f5f2'),borderPadding=10,spaceBefore=6,spaceAfter=14),
 'cell':ParagraphStyle('cell',fontName='Helvetica',fontSize=9.2,leading=12.2,textColor=INK),
 'headcell':ParagraphStyle('headcell',fontName='Helvetica-Bold',fontSize=9.2,leading=12.2,textColor=GREEN),
}
story=[]
def p(s,style='body'):story.append(Paragraph(s,styles[style]))
def h(s):p(s,'h')
def page(title,subtitle=None):
 if story:story.append(PageBreak())
 p(title,'title')
 if subtitle:p(subtitle,'subtitle')
def table(rows,widths):
 cells=[[Paragraph(escape(str(v)),styles['headcell' if r==0 else 'cell']) for v in row] for r,row in enumerate(rows)]
 t=Table(cells,colWidths=widths,repeatRows=1,hAlign='LEFT')
 t.setStyle(TableStyle([('VALIGN',(0,0),(-1,-1),'TOP'),('LEFTPADDING',(0,0),(-1,-1),7),('RIGHTPADDING',(0,0),(-1,-1),7),('TOPPADDING',(0,0),(-1,-1),8),('BOTTOMPADDING',(0,0),(-1,-1),8),('LINEBELOW',(0,0),(-1,0),.8,GREEN),('LINEBELOW',(0,1),(-1,-1),.3,colors.HexColor('#dce1dc')),('BACKGROUND',(0,0),(-1,0),colors.HexColor('#f3f5f2'))]))
 story.extend([t,Spacer(1,12)])
def link(label,url):return f'<link href="{escape(url)}" color="#497d6a">{escape(label)}</link>'

page('Burn Clock\nMethods & evidence'.replace('\n','<br/>'),f"Historical satellite-fire calendar | {M['months'][0]} to {M['months'][-1]}<br/>Data release: 14 November 2026")
p('Burn Clock joins MODIS and VIIRS observations on a common VIIRS scale and shows when satellite look times complicate the interpretation. Its calendar, clock diagnostics and Punjab receipt answer related questions with explicitly different units.')
h('Observations and coverage')
p(f"The supplied pipeline records <b>{M['totals']['detections_processed']:,}</b> input rows in <b>{len(M['sources'])}</b> yearly NASA FIRMS archives and {M['totals']['csv_files']:,} country CSVs. This is a count of rows processed, not fires. It records {M['totals']['type0_detections']:,} type-0 rows before cell-day aggregation and {M['totals']['active_cell_days']:,} daytime active cell-days in the contract range.")
labels={'T':'Terra MODIS','A':'Aqua MODIS','N':'S-NPP VIIRS','J1':'NOAA-20 VIIRS','J2':'NOAA-21 VIIRS'}
rows=[['Platform','Input rows','Supplied period']]
for k,label in labels.items():
 coverage=M['platforms'].get(k);rows.append([label,f"{M['totals']['by_platform'][k]:,}",f"{coverage['first']} to {coverage['last']}" if coverage else 'Absent from bundle'])
table(rows,[140,115,232])
h('What an active cell-day means')
p('One 0.05-degree cell with at least one FIRMS type-0 detection on a local solar day, per platform. The calendar uses daytime detections at all confidence levels, aggregated to 0.25-degree cells. It does not measure unique fires, burned area, emissions, or the true number of fires.')
p('Local solar time = UTC + longitude / 15, with 24-hour wrapping and local-date rollover. The receipt also reports Indian Standard Time (UTC + 5:30); those clock conventions are labelled separately.')
p('The bundle ends in December 2025. “Latest supplied month” refers to that historical endpoint. Operational satellite status in November 2026 does not extend observational coverage.','small')

page('Harmonization','A pre-drift MODIS conversion and a single VIIRS reference scale')
h('Production model')
p('MODIS is converted to the S-NPP VIIRS scale using calendar-month factors fitted only on 2013-2019. Local factors shrink through a 1-degree, 5-degree and global hierarchy. Terra-only months use a Terra-specific conversion. All source choices remain visible as V (usable VIIRS), M (converted MODIS), or X (no usable data).')
p('k = (V + tau * k_parent) / (M + tau)','formula')
p(f"The selected MODIS shrinkage is <b>tau = {V['tau']}</b> cell-days. NOAA-20 is bridged to S-NPP using 5-degree tile by calendar-month overlap ratios with <b>tau_b = {V['tau_b']}</b>. The bridge fitting configuration excludes locked 2019. After bridging and coverage adjustment, usable VIIRS platforms are averaged; they are not added as extra fire activity. MODIS is the fallback when no VIIRS source is usable.")
h('Why this model was selected')
p(f"The supplied pre-registered decision compares median absolute annual error across held-out 5-degree tile-years. The ratio bridge scores <b>{V['model_choice']['primary_bridge']:.2f}%</b>; the gradient-boosted model scores <b>{V['model_choice']['primary_gbm']:.2f}%</b>. The rule requires the GBM to improve on the bridge by at least 10%; it did not. This is a comparison within this pipeline, not evidence of superiority over another project.")
table([['Role','Years'],['Training / LOYO',', '.join(map(str,V['training_years']))],['Locked temporal tests',', '.join(map(str,V['locked_test_years']))],['Final pre-drift production factors','2013-2019']],[185,302])
h('Coverage policies')
p('A platform-day is masked when its global type-0 count falls below 20% of a centered 31-day median. Raw monthly values become null above 30% missing days. Fits require at least 90% coverage. Production harmonization permits at least 50% coverage and rescales usable observations. A null raw month can therefore coexist with a non-null harmonized estimate.')
h('Continuity')
p('NASA states S-NPP observation delivery ended on 2 November 2026. NOAA-20 is a continuity path. NOAA-21 products exist through FIRMS APIs but are absent from these yearly archive inputs. This app does not implement a live 2026 feed.')
p('Sources: supplied validation.json, pipeline/harmonize configuration and production code; '+link('NASA FIRMS notification','https://firms2.modaps.eosdis.nasa.gov/content/notifications/firms2/news.html')+'.','small')

page('Calendar & area calculations','The browser preserves missingness and uses a fixed spatial selection rule')
h('Cell-center area selection')
p('An area is a rectangular south/west/north/east bounding box. A calendar cell is included when its center is inside: south and west are inclusive; north and east are exclusive. For a 0.25-degree cell indexed by its lower corner, its center is offset by 0.125 degrees. Clock cells use 1-degree centers, offset by 0.5 degrees. Very small areas may contain no centers.')
p('The app sums the included monthly values. If any included cell-month is missing, the corresponding aggregate remains missing; it is not shown as zero or as a partial-area total. An area with no archived active cells is displayed as no data. Raw platforms are evaluated separately. The harmonized aggregate requires usable point, lower and upper values for every included cell.')
h('Historical comparisons')
p('Each harmonized month is compared with the same calendar month in the 2003-2022 baseline, using available values. Quantiles use linear interpolation. Above the 75th percentile is “above typical”; below the 25th is “below typical”; the middle half is “within typical range.” A month without a usable value or baseline remains missing. These are descriptive historical categories, not forecasts.')
h('Uncertainty')
p('The supplied production pipeline uses 200 year-block bootstrap replicates to estimate conversion-factor uncertainty. Cell-level 5th-95th percentile bounds combine count variation and factor uncertainty using a matched negative-binomial distribution.')
p('<b>Area bounds are sums of cell endpoints.</b> This approximate rule treats uncertainty as if cells were fully correlated. It is conservative in intent, but it is not a calibrated 90% confidence interval for the selected area. The app and CSV label it accordingly.')
p('The model has no intercept. A zero MODIS count can produce a zero reconstruction and zero-width range even if VIIRS would detect small fires. A narrow or zero interval does not establish absence of fire.')
h('Export and architecture')
p('CSV exports retain the area bounds, month, each raw platform, harmonized value, approximate bounds, anomaly category, baseline median, annual clock badge, drivers, signed bend, source codes, satellites and unit. Data are loaded by geographic tile and aggregated in a browser worker. The chosen coordinates are not sent to an application backend.')
p('Implementation reference: src/data.ts and src/pages/Methods.tsx. The rules here describe the application calculation, not a new fit of the scientific model.','small')

page('Satellite-clock diagnostic','Annual fire-season ratios on a common observed footprint')
h('Season and paired support')
p('Each 1-degree clock cell has a fixed fire season: the three calendar months with the most S-NPP daytime cell-days in 2013-2019. For each MODIS platform P, the area uses only cells with paired, non-null P and S-NPP counts in all seven baseline years and the selected target year. This common complete support prevents missing cells from changing the comparison footprint. Terra and Aqua are tested separately.')
p('rho_P(y) = ln(P_day(y) / N_day(y))<br/>delta_P(y) = rho_P(y) - mean(rho_P(2013-2019))<br/>threshold_P = max(2 * sigma_P, 0.15)','formula')
p('Counts are summed over the common cells before computing each annual ratio. Sigma is the <b>population standard deviation</b> of the seven baseline log-ratios. The platform is testable only with S-NPP at least 200 cell-days, P at least 50, and seven valid baseline ratios.')
p('For target years from 2021, any testable platform whose absolute delta exceeds its threshold yields “clock-sensitive.” Testable areas inside the thresholds are “robust,” shown as “within clock threshold.” No testable platform is “not identifiable.” Years before 2021 are not evaluated. This annual seasonal badge is repeated across that year; it is not a separately measured monthly effect.')
h('Combined bend and displayed look times')
p('The combined bend uses the same complete T/A/N cells in the baseline and target year, and compares the target (T+A)/N ratio with the arithmetic mean of baseline annual (T+A)/N ratios. The percentage is 100 times the proportional difference. It is an observation-ratio diagnostic, not a causal correction.')
p('The clock wheel shows the median of the supplied cell-level median daytime look times; its baseline combines cell medians across 2013-2019. A median of medians cannot reproduce a pooled detection-level median. Look times are derived from detections, so their distribution also reflects which fires were observed.')
h('World evidence is a separate analysis')
p(f"The supplied world atlas reports a 2019-2025 clock-associated artifact of <b>{W['artifact_2019_2025_pct']:.1f}%</b> (reported bounds {W['lo']:.1f}% to {W['hi']:.1f}%). Its 2025 bend statistic is {W['bend_TA_pct']:.1f}%; that is a different comparison. The atlas uses nominal/high-confidence detections, not the calendar's all-confidence active cell-days. These values must not be substituted as calendar corrections.")
p('Clock sensitivity does not prove clock drift is the only cause. Instrument changes, cloud and sampling, sensitivity and real activity changes remain possible contributors.','small')

page('Punjab evidence receipt','October-November 2025 compared with 2021; keep clocks and units separate')
p(f"The official report records {R['claim_source']['value_2025']:,} Punjab incidents in 2025 versus {R['claim_source']['value_2021']:,} in 2021, a reported reduction of approximately {100*(1-R['claim_source']['value_2025']/R['claim_source']['value_2021']):.0f}%. Its September 15-November 30 window differs from this receipt's October-November window. It is a reported satellite count, not a total of all fires.")
rows=[['Polar sensor','2025 / 2021','2025 look, IST','Clock']]
for r in R['by_clock']:
 hh=int(r['ist_hour']); mm=round((r['ist_hour']-hh)*60)
 rows.append([r['label'],f"{r['ratio']:.3f}",f'{hh:02d}:{mm:02d}','Drifting' if r['block']=='drifting_clock' else 'Approximately fixed'])
table(rows,[135,95,105,152])
p('Polar values are daytime 0.05-degree active cell-days, with the receipt\'s paired calendar-day masking. Terra and Aqua changed their look times, so their ratios are not controlled estimates of a true activity decline.')
g=R['gk2a_unique_pixel_days']; ratio=g['2025']/g['2021']; fan={d['base']:d for d in R['base_year_fan']}
h('Independent hourly evidence')
p(f"GK2A unique pixel-days fall from {g['2021']:,} to {g['2025']:,}: a ratio of {ratio:.3f}, or a {100*(1-ratio):.1f}% decrease, before matched-calendar masking. The base-year fan applies a common calendar mask and gives {fan[2021]['gk2a']:.3f} against 2021, but {fan[2019]['gk2a']:.3f} against 2019. Comparison year and masking policy materially affect the answer.")
p(f"At 17:00 IST, GK2A's supplied pixel-hour ratio is {R['gk2a_by_hour']['ratio_2025_2021'][R['gk2a_by_hour']['hours'].index(17)]:.3f}. Pixel-hours include duration; unique pixel-days reduce repeat counting. Ratios within an instrument can be compared across years, but absolute levels across GK2A and VIIRS are not directly comparable.")
h('Limits of the receipt')
p('GK2A is a preliminary, roughly 4 km fire/hot-smoke product with hour-dependent thresholds, filtered to confidence at least 2. Cloud, smoke, small fires, duration and viewing geometry affect detection. The supplied hot-smoke check is inconclusive. GK2A is not ground truth. The receipt does not establish motive or policy effectiveness, and the ratio of percentage declines across sensors is not a measured correction factor.')
p('Sources: '+link('Official PIB release','https://www.pib.gov.in/PressReleseDetailm.aspx?PRID=2197201&lang=2&reg=3')+'; '+link('Jethva GK2A dataset','https://zenodo.org/records/20084790')+'; '+link('Timing the Flames, 2026','https://www.mdpi.com/2072-4292/18/10/1506')+'; supplied punjab_receipt.json.','small')

page('Validation & provenance','Strong aggregate results coexist with poor transfer and sparse-area failures')
locked=V['models'][0]['score']['locked'];rows=[['Region / test','Median annual error']]
for label,key in [('Global LOYO','global'),('Punjab + Haryana LOYO','punjab'),('Parana Delta LOYO','parana')]:rows.append([label,f"{V['loyo'][key]['median_annual_err_pct']:.2f}%"])
rows += [['5-degree tile-year LOYO',f"{V['loyo']['tile_5deg']['median_abs_annual_err_pct_tile_years']:.2f}%"],['Spatial tile-block holdout',f"{V['loro']['tile_blocks_5deg']['median_abs_annual_err_pct_tile_years']:.2f}%"],['Global locked-year test',f"{locked['global']['median_annual_err_pct']:.2f}%"]]
table(rows,[330,157])
p('These are supplied pipeline scores with different aggregation levels and holdout designs. The global score is not an accuracy guarantee for each selected area. Spatial transfer is poor; sparse areas and the early Terra-only era are less reliable. VIIRS did not exist before 2012, so the earliest years have no contemporaneous VIIRS validation. GBM spatial holdout was not run.')
h('What was independently checked')
p(f"All {len(M['sources'])} local manifest entries reconcile with the detailed per-CSV processing manifest. One NASA archive, MODIS 2000, was downloaded afresh: bytes, SHA-256 and {M['sources'][0]['rows']:,} data rows matched. The other archives were not redownloaded. Intermediate Parquet inputs were not delivered, so this app build did not rerun the full scientific pipeline. The complete URL, byte, hash and row inventory is in DATA_PROVENANCE.md.")
p('The supplied manifest and README describe an earlier build with empty harmonized arrays and a smaller byte count. Final delivered tiles contain harmonized arrays. This inconsistency is disclosed in SOURCE_AUDIT.md; original scientific inputs remain unchanged.')
h('SI / AI disclosure')
p('The app, documentation and artifact preparation used AI assistance (Codex). The supplied research pipeline and validation outputs were produced separately with AI assistance, as described in the build brief. Numerical claims come from the supplied JSON and cited sources; AI assistance does not certify scientific validity. Human scientific review is still needed before research or policy use. This independent project is not NASA-approved.')
h('App and reproducible evidence')
p(link('burn-clock.ottoskibeli.chatgpt.site','https://burn-clock.ottoskibeli.chatgpt.site')+'<br/>Initial deployment may require owner authentication; this link does not imply public access.','small')
p('Companion evidence: DATA_PROVENANCE.md, SOURCE_AUDIT.md, VALIDATION_REPORT.md and JUDGE_DEMO.md. Data: '+link('NASA FIRMS','https://firms.modaps.eosdis.nasa.gov/')+'; '+link('GK2A','https://zenodo.org/records/20084790')+' (CC BY 4.0).','small')

def footer(canvas,doc):
 canvas.setFillColor(MUTED);canvas.setFont('Helvetica',8)
 canvas.drawString(54,28,'BURN CLOCK  /  METHODS & EVIDENCE  /  14 NOV 2026')
 canvas.drawRightString(A4[0]-54,28,str(doc.page))
OUT.parent.mkdir(parents=True,exist_ok=True)
SimpleDocTemplate(str(OUT),pagesize=A4,rightMargin=54,leftMargin=54,topMargin=45,bottomMargin=48,title='Burn Clock: Methods & Evidence',author='Burn Clock',subject='Historical MODIS and VIIRS harmonization; methods and limits').build(story,onFirstPage=footer,onLaterPages=footer)
print(OUT)
