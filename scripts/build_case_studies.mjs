/** Builds public/data/case_studies.json by opening each case in the built app and reading the
 * verdict and numbers the app itself computes (src/timing.ts, src/verdict.ts, src/stats.ts).
 * Nothing is typed by hand: the cards on #cases always match the place reports.
 * Usage: BURN_CLOCK_URL=http://127.0.0.1:4173 node scripts/build_case_studies.mjs */
import {chromium} from 'playwright';
import {readFileSync,writeFileSync} from 'node:fs';
const base=process.env.BURN_CLOCK_URL??'http://127.0.0.1:4173';
const cases=JSON.parse(readFileSync('scripts/case_studies.config.json','utf8'));
const PRESET={punjab:[27.6,73.8,32.6,77.6],parana:[-34.5,-60.8,-32,-58.3],cerrado:[-13,-50,-5,-42],africa:[5,18,10,30],kalimantan:[-3.5,110,1,117],california:[34,-124,42,-117]};
const browser=await chromium.launch(),page=await browser.newPage({viewport:{width:1280,height:900}});
const out=[];
for(const c of cases){
  const box=PRESET[c.preset];
  const url=`${base}/?box=${box.join(',')}&months=${c.months.join(',')}&a=${c.a}&b=${c.b}#explorer`;
  await page.goto(url);await page.getByTestId('verdict').waitFor({timeout:120000});
  const t=async id=>(await page.getByTestId(id).first().innerText()).trim();
  const verdictClass=await page.locator('.trend-verdict').getAttribute('class');
  const row={...c,box,link:`?box=${box.join(',')}&months=${c.months.join(',')}&a=${c.a}&b=${c.b}#explorer`,
    verdict:verdictClass.match(/verdict-(\w+)/)[1],verdict_label:await t('verdict'),sentence:await t('verdict-sentence'),
    late:await t('timing-late'),modis:await t('timing-relationship'),viirs:await t('claim-N'),aqua:await t('claim-A')};
  out.push(row);console.log(c.id,row.verdict,'|',row.sentence);
}
await browser.close();
writeFileSync('public/data/case_studies.json',JSON.stringify({generated_utc:new Date().toISOString(),producer:'scripts/build_case_studies.mjs (reads the app’s own verdicts)',cases:out},null,1));
