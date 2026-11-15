/** Verify the timeline against supplied counts, real URL state and geographic scope. */
import {chromium} from 'playwright';
import AxeBuilder from '@axe-core/playwright';
import assert from 'node:assert/strict';
import {readFileSync, writeFileSync, mkdirSync} from 'node:fs';
import {gunzipSync} from 'node:zlib';
const base = process.env.BURN_CLOCK_URL || 'http://127.0.0.1:5173';
const receipt = JSON.parse(gunzipSync(readFileSync('public/data/punjab_receipt.json.gz')));
const expected = JSON.parse(readFileSync('scripts/numeric_expected.json'));
const browser = await chromium.launch({headless: true, args: ['--enable-unsafe-swiftshader']});
const context = await browser.newContext({viewport: {width: 1360, height: 1000}}), page = await context.newPage();
const checks = [], scans = [], errors = [];
page.on('pageerror', e => errors.push(e.message));
mkdirSync('test-results/timeline', {recursive: true});
const go = async (box, year = 2025, route = 'clock', extra = '') => {
  await page.goto(`${base}/?box=${box.join(',')}&clockYear=${year}&b=${year}${extra}#${route}`);
  await page.locator('.timeline-pass-row[data-available=true]').first().waitFor({state: 'attached'});
};
const checkShares = async year => {
  const values = receipt.gk2a_by_hour[`pixel_hours_${year}`], total = values.reduce((a, b) => a + b, 0);
  const bars = await page.locator('.timeline-chart [data-hour]').evaluateAll(els => els.map(el => ({hour: +el.dataset.hour, value: +el.dataset.value, share: +el.dataset.share, height: +el.querySelector('rect').getAttribute('height')})));
  assert.equal(bars.length, 7);
  bars.forEach((bar, i) => {assert.equal(bar.hour, 12 + i); assert.equal(bar.value, values[i]); assert.ok(Math.abs(bar.share - values[i] / total * 100) < 1e-9); assert.ok(bar.height >= 0);});
};
try {
  await go(expected.presets.punjab.box);
  await checkShares(2025);
  assert.equal(await page.locator('[data-compare-hour]').count(), 7);
  const before = await page.locator('[data-compare-hour]').evaluateAll(els => els.map(el => +el.dataset.share));
  const baseCounts = receipt.gk2a_by_hour.pixel_hours_2021, total2021 = baseCounts.reduce((a, b) => a + b, 0);
  before.forEach((value, i) => assert.ok(Math.abs(value - baseCounts[i] / total2021 * 100) < 1e-9));
  assert.match(await page.locator('.satellite-timeline').innerText(), /96\.2%/);
  assert.match(await page.locator('.satellite-timeline').innerText(), /Punjab state; pass markers describe the selected Punjab \+ Haryana box/);
  assert.equal(await page.locator('.timeline-toggle').getByRole('button', {name: '2019', exact: true}).isDisabled(), true);
  checks.push('Both hourly distributions and late share match original integer counts; 2019 is explicitly unavailable');

  await page.locator('.timeline-toggle').getByRole('button', {name: 'None', exact: true}).click();
  assert.equal(new URL(page.url()).searchParams.get('timelineCompare'), 'none');
  assert.equal(await page.locator('[data-compare-hour]').count(), 0);
  await page.reload();await page.locator('.timeline-chart [data-platform]').first().waitFor();
  assert.equal(await page.locator('[data-compare-hour]').count(), 0);
  await page.goBack();await page.locator('[data-compare-hour]').first().waitFor();
  checks.push('Comparison toggle survives reload and browser Back restores the overlay');

  await page.getByLabel('Observation year').fill('2021');await checkShares(2021);
  assert.match(await page.locator('.satellite-timeline h2').innerText(), /4 pm/);
  assert.match(await page.locator('.satellite-timeline').innerText(), /51\.9%/);
  assert.equal(await page.locator('.timeline-toggle').getByRole('button', {name: '2025', exact: true}).count(), 1);
  await page.getByLabel('Observation year').fill('2019');
  assert.equal(await page.locator('[data-hour]').count(), 0);
  assert.match(await page.locator('.satellite-timeline').innerText(), /No usable hourly shares are supplied for 2019/);
  checks.push('Changing the observed year updates bars and peak, with no fabricated 2019 shares');

  for (const id of ['africa', 'california']) {
    await go(expected.presets[id].box);
    assert.equal(await page.locator('[data-hour]').count(), 0);
    assert.doesNotMatch(await page.locator('.satellite-timeline').innerText(), /India time|96\.2%|was 11:18 am/);
    assert.match(await page.locator('.satellite-timeline').innerText(), /no hourly fire data matched to this area/);
    const actual = await page.locator('.timeline-chart [data-platform]').evaluateAll(els => els.map(el => ({platform: el.dataset.platform, hour: +el.dataset.current})));
    const source = expected.presets[id].clock.find(c => c.year === 2025);
    const offset = id === 'africa' ? 1 : -8, lon = (expected.presets[id].box[1] + expected.presets[id].box[3]) / 2;
    for (const pass of actual) assert.ok(Math.abs(pass.hour - ((source.look[pass.platform] - lon / 15 + offset + 24) % 24)) < 1e-9);
  }
  checks.push('Africa and California use their own pass times and civil zones, without Punjab bars');

  for (const width of [1360, 768, 375, 320]) {
    await page.setViewportSize({width, height: 1000});
    for (const id of ['punjab', 'africa']) {
      await go(expected.presets[id].box, 2025, id === 'punjab' ? 'explorer' : 'clock');
      const component = page.locator('.satellite-timeline');await component.scrollIntoViewIfNeeded();
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
      await component.locator('.timeline-values').evaluate(el => el.open = true);
      const results = await new AxeBuilder({page}).include('.satellite-timeline').withTags(['wcag2a','wcag2aa','wcag21aa']).analyze();
      assert.deepEqual(results.violations.map(v => ({id: v.id, targets: v.nodes.map(n => n.target)})), []);
      scans.push({width, area: id, violations: 0});
      await component.locator('.timeline-values').evaluate(el => el.open = false);
      await page.evaluate(() => document.activeElement?.blur());
      await component.screenshot({path: `test-results/timeline/${id}-${width}.png`});
    }
  }
  checks.push('Timeline and accessible source tables fit four widths in both data-availability states');

  await go(expected.presets.punjab.box);
  await page.locator('.timeline-chart').focus();await page.keyboard.press('Enter');
  await page.getByRole('dialog').waitFor();
  assert.match(await page.getByRole('dialog').innerText(), /pixel_hours_2025/);
  assert.match(await page.getByRole('dialog').innerText(), /Full configuration fingerprint/);
  await page.getByRole('button', {name: 'Close', exact: true}).click();
  await page.locator('.timeline-values').evaluate(el => el.open = true);
  await page.locator('.timeline-pass-row').first().locator('.evidence-number').first().click();
  assert.match(await page.getByRole('dialog').innerText(), /look\.T/);
  checks.push('Keyboard chart sources and individual pass-time provenance are usable');
  assert.deepEqual(errors, []);
  console.log(JSON.stringify({status: 'passed', checks, accessibilityScans: scans.length}));
} catch (error) { errors.push(String(error.stack)); process.exitCode = 1; console.error(error); }
finally {
  await browser.close();
  writeFileSync('timeline-checks.json', JSON.stringify({tested_at: new Date().toISOString(), status: errors.length ? 'failed' : 'passed', checks, scans, errors, limitations: ['Automated checks only; no human usability study was conducted.']}, null, 2) + '\n');
}
