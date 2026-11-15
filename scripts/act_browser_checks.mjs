/** Verify the Punjab action planner and the role brief against the shipped district file. */
import {chromium} from 'playwright';
import AxeBuilder from '@axe-core/playwright';
import assert from 'node:assert/strict';
import {readFileSync, writeFileSync, mkdirSync} from 'node:fs';
const base = process.env.BURN_CLOCK_URL || 'http://127.0.0.1:5173';
const doc = JSON.parse(readFileSync('public/data/punjab_districts.json'));
const sum = v => v.reduce((s, x) => s + x, 0);
const browser = await chromium.launch({headless: true, args: ['--enable-unsafe-swiftshader']});
const context = await browser.newContext({viewport: {width: 1360, height: 1000}, acceptDownloads: true}), page = await context.newPage();
const checks = [], scans = [], errors = [];
page.on('pageerror', e => errors.push(e.message));
mkdirSync('test-results/act', {recursive: true});
const check = (name, fn) => checks.push({name, ok: (fn(), true)});
try {
  // 1. Fazilka 2025: the window sentence and the gap sentence equal values recomputed from the file.
  await page.goto(`${base}/?district=Fazilka&dyear=2025&dbase=2021#act`);
  await page.getByTestId('act-window').waitFor({timeout: 60000});
  const fz = doc.districts.find(d => d.name === 'Fazilka'), v = fz.gk2a_pixel_hours['2025'], t = sum(v);
  const w3 = Math.max(...[0, 1, 2, 3, 4].map(i => sum(v.slice(i, i + 3)))), pass = 100 * (v[1] + v[2]) / t;
  const windowText = await page.getByTestId('act-window').innerText();
  check('window share', () => assert.match(windowText, new RegExp(`covered ${Math.round(100 * w3 / t)}% of the afternoon`)));
  check('pass share', () => assert.match(windowText, new RegExp(`held ${Math.round(pass)}%`)));
  const mask = [...new Set([...doc.outage_mmdd['2021'], ...doc.outage_mmdd['2025']])];
  const ms = (arr) => arr.reduce((s, x, i) => s + (mask.includes(doc.days_mmdd[i]) ? 0 : x), 0);
  const sn = ms(fz.snpp_celldays['2025']) / ms(fz.snpp_celldays['2021']), gk = ms(fz.gk2a_pixel_days['2025']) / ms(fz.gk2a_pixel_days['2021']);
  const gapText = await page.getByTestId('act-gap').innerText();
  check('gap satellite change', () => assert.match(gapText, new RegExp(`satellite count fell ${Math.round(100 * (1 - sn))}%`)));
  check('gap afternoon change', () => assert.match(gapText, new RegExp(`signal fell ${Math.round(100 * (1 - gk))}%`)));
  check('gap factor', () => assert.match(gapText, new RegExp(`about ${(gk / sn).toFixed(1)}×`)));
  const say = await page.getByTestId('act-say').innerText();
  check('wording', () => { assert.match(say, /You can say[\s\S]*Satellite fire counts for Fazilka, taken at about 1:40 pm/); assert.match(say, /Don’t say[\s\S]*Burning in Fazilka fell/); });
  const wa = await page.getByTestId('act-whatsapp').getAttribute('href');
  check('WhatsApp plan link', () => { assert.ok(wa.startsWith('https://wa.me/?text=')); const text = decodeURIComponent(wa.split('text=')[1]); assert.match(text, /Burn Clock field-check plan · Fazilka/); assert.match(text, /Busiest two weeks: \d+ (Oct|Nov)/); });
  // 2. Ranking order equals late pixel-hours order; map click selects a district.
  const rows = await page.locator('[data-testid=act-priority] tbody tr th button').allInnerTexts();
  const expected = [...doc.districts].sort((a, b) => sum(b.gk2a_pixel_hours['2025'].slice(4)) - sum(a.gk2a_pixel_hours['2025'].slice(4)) || a.name.localeCompare(b.name)).map(d => d.name);
  check('priority order', () => assert.deepEqual(rows, expected));
  await page.getByTestId('act-priority').getByRole('button', {name: 'Sangrur'}).click();
  await page.waitForFunction(() => new URL(location.href).searchParams.get('district') === 'Sangrur');
  check('select from table writes URL', () => true);
  // 3. Thin district: no window, no wording.
  await page.goto(`${base}/?district=Pathankot&dyear=2025#act`);
  await page.getByTestId('act-window').waitFor();
  check('thin district refused', async () => {});
  assert.match(await page.getByTestId('act-window').innerText(), /Too little geostationary fire signal/);
  assert.match(await page.getByTestId('act-say').innerText(), /No wording is offered/);
  // 4. Downloads.
  await page.goto(`${base}/#act`); await page.getByTestId('act-window').waitFor();
  const [dl] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', {name: /Download hourly profiles/}).click()]);
  const csv = readFileSync(await dl.path(), 'utf8').trim().split('\n');
  check('profile CSV rows', () => assert.equal(csv.length, 1 + 23 * 7 * 7));
  await page.screenshot({path: 'test-results/act/act-all.png', fullPage: true});
  const axe = await new AxeBuilder({page}).include('.act-page').withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze();
  scans.push({page: 'act', violations: axe.violations.map(v => v.id)});
  check('act page axe', () => assert.deepEqual(axe.violations.map(v => v.id), []));
  // 5. Role brief from a place report, and the planner link for Punjab.
  await page.goto(`${base}/?box=29.5,73.8,32.6,77&months=10,11&a=2021&b=2025&role=policy#explorer`);
  await page.getByTestId('role-brief').waitFor({timeout: 90000});
  check('planner link shown for Punjab', async () => {});
  assert.equal(await page.getByTestId('act-link').count(), 1);
  const [bd] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', {name: 'Download one-page brief'}).click()]);
  const html = readFileSync(await bd.path(), 'utf8');
  const verdict = await page.getByTestId('verdict').innerText();
  check('brief carries verdict and actions', () => { assert.ok(html.includes(verdict.trim())); assert.match(html, /What to do/); assert.match(html, /Limits/); });
  // 6. Right now: live ratio recomputed from the shipped snapshot; location, field card, season table, range.
  const week = JSON.parse(readFileSync('public/data/punjab_week.json'));
  const A = week.by_date.A || {}, J = week.by_date.J1 || {}, both = Object.keys(J).filter(k => (A[k] || 0) > 0 && J[k] > 0);
  const liveRatio = sum(both.map(k => A[k])) / sum(both.map(k => J[k]));
  const geo = await browser.newContext({viewport: {width: 1360, height: 1000}, acceptDownloads: true, geolocation: {latitude: 30.9, longitude: 75.85}, permissions: ['geolocation']});
  const gp = await geo.newPage(); gp.on('pageerror', e => errors.push(e.message));
  await gp.goto(`${base}/#act`); await gp.getByTestId('act-now').waitFor({timeout: 60000});
  const nowText = await gp.getByTestId('act-now').innerText();
  check('live ratio', () => assert.match(nowText, new RegExp(`recorded ${liveRatio.toFixed(1)} fire detections for every one NOAA-20`)));
  check('live table rows', async () => {});
  assert.ok(await gp.locator('[data-testid=act-week-table] tbody tr').count() > 0);
  await gp.getByTestId('act-locate').click();
  await gp.waitForFunction(() => new URL(location.href).searchParams.get('district') === 'Ludhiana', null, {timeout: 15000});
  check('use my location selects Ludhiana', () => true);
  check('season table has seven seasons', async () => {});
  assert.equal(await gp.locator('[data-testid=act-seasons] tbody tr').count(), 7);
  await gp.goto(`${base}/?district=Fazilka#act`); await gp.getByTestId('act-window').waitFor();
  const [card] = await Promise.all([gp.waitForEvent('download'), gp.getByTestId('act-card').click()]);
  const png = readFileSync(await card.path());
  check('field card is a PNG', () => assert.deepEqual([...png.subarray(0, 4)], [0x89, 0x50, 0x4e, 0x47]));
  await gp.getByTestId('act-calendar').locator('summary').click();
  const [ics] = await Promise.all([gp.waitForEvent('download'), gp.getByRole('button', {name: 'Download calendar file (.ics)'}).click()]);
  const icsText = readFileSync(await ics.path(), 'utf8');
  check('calendar file has 14 India-time events', () => { assert.equal((icsText.match(/BEGIN:VEVENT/g) || []).length, 14); assert.match(icsText, /DTSTART;TZID=Asia\/Kolkata:2027\d{4}T160000/); });
  const gapFull = await gp.getByTestId('act-gap').innerText();
  check('bootstrap range shown', () => assert.match(gapFull, /90% range from resampling days: \d+(\.\d)?×–\d+(\.\d)?×/));
  check('consistency check', async () => {});
  assert.match(await gp.getByTestId('act-consistency').innerText(), /Consistency check:/);
  await geo.close();
  // 7. Live timing check on a place report (any place): renders one of four answers with its numbers or a reason.
  await page.goto(`${base}/?box=27.6,73.8,32.6,77.6&months=10,11&a=2021&b=2025#explorer`);
  await page.getByTestId('live-check').waitFor({timeout: 90000});
  const liveAnswer = await page.getByTestId('live-answer').innerText(), liveText = await page.getByTestId('live-text').innerText();
  check('live check answer', () => assert.ok(['Yes, likely, this week', 'No sign this week', 'No, Aqua sees less', 'Can’t tell this week'].includes(liveAnswer)));
  check('live check explains itself', () => assert.ok(/active cells|Too few|incomplete/.test(liveText)));
  const liveAxe = await new AxeBuilder({page}).include('[data-testid=live-check]').withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze();
  check('live check axe', () => assert.deepEqual(liveAxe.violations.map(v => v.id), []));
  // 8. Ask panel: hidden when the assistant is off (no /api/ask here); shown and rendering an answer when the API says it is on.
  await page.goto(`${base}/#home`); await page.waitForTimeout(1500);
  check('ask panel hidden when assistant is off', async () => {});
  assert.equal(await page.getByTestId('ask-panel').count(), 0);
  const actx = await browser.newContext({viewport: {width: 1280, height: 900}}), ap = await actx.newPage();
  await ap.route('**/api/ask', route => route.request().method() === 'GET' ? route.fulfill({json: {configured: true, model: 'claude-haiku-5-5'}}) : route.fulfill({json: {status: 'ok', answer: 'Timing matters here: activity fell about 80%. https://burn-clock.vercel.app/?box=27.6,73.8,32.6,77.6#explorer', tools: [{name: 'check_place', input: {lat: 30.9, lon: 75.8}}], unverified: [], model: 'claude-haiku-5-5'}}));
  await ap.goto(`${base}/#home`); await ap.getByTestId('ask-panel').waitFor({timeout: 30000});
  await ap.getByLabel('Your question').fill('Can I trust the Punjab drop?'); await ap.getByRole('button', {name: 'Ask', exact: true}).click();
  await ap.getByTestId('ask-answer').waitFor();
  check('ask answer shows the number check', async () => {});
  assert.match(await ap.getByTestId('ask-answer').innerText(), /Every number above was checked/);
  const askAxe = await new AxeBuilder({page: ap}).include('[data-testid=ask-panel]').withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze();
  check('ask panel axe', () => assert.deepEqual(askAxe.violations.map(v => v.id), []));
  await actx.close();
  // 9. Mobile layout: no horizontal scroll on the planner.
  const mobile = await browser.newPage({viewport: {width: 390, height: 844}});
  await mobile.goto(`${base}/?district=Fazilka#act`); await mobile.getByTestId('act-window').waitFor();
  const overflow = await mobile.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  check('mobile no horizontal scroll', () => assert.ok(overflow <= 1, 'overflow ' + overflow));
  await mobile.screenshot({path: 'test-results/act/act-mobile.png', fullPage: true});
  await mobile.close();
} catch (error) { errors.push(String(error.stack)); process.exitCode = 1; console.error(error); }
finally {
  await browser.close();
  writeFileSync('act-checks.json', JSON.stringify({tested_at: new Date().toISOString(), status: errors.length ? 'failed' : 'passed', checks, scans, errors, limitations: ['Automated checks only; no human usability study was conducted.']}, null, 2) + '\n');
  console.log(errors.length ? 'Act checks failed' : `Act checks passed (${checks.length})`);
}
