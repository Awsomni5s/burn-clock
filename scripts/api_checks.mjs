/** Exercise the deployed-function code (api/*.js → api/_lib/server.mjs) against the preview server's /data files,
 * and the Telegram bot with a fake Telegram API and a fake Redis store. No network beyond BURN_CLOCK_URL. */
import assert from 'node:assert/strict';
import {readFileSync, writeFileSync} from 'node:fs';
import {GET as check} from '../api/check.js';
import {GET as punjab} from '../api/punjab.js';
import {handleTelegram, handleDigest, handleSetup, handleAsk} from '../api/_lib/server.mjs';
const base = process.env.BURN_CLOCK_URL || 'http://127.0.0.1:4173';
const checks = [], errors = [];
const t = async (name, fn) => { try { await fn(); checks.push({name, ok: true}); console.log('PASS', name); } catch (e) { errors.push(name + ': ' + e.stack); console.log('FAIL', name, e.message); } };
const doc = JSON.parse(readFileSync('public/data/punjab_districts.json'));
try {
  await t('bundle is built from the current source', async () => { const {execFileSync} = await import('node:child_process'); execFileSync(process.execPath, ['scripts/build_api.mjs', '--check'], {stdio: 'pipe'}); });
  await t('/api/check gives the same verdict as the app for Punjab + Haryana', async () => {
    const r = await check(new Request(`${base}/api/check?box=27.6,73.8,32.6,77.6&months=10,11&a=2021&b=2025`)); assert.equal(r.status, 200);
    const j = await r.json(); assert.equal(j.verdict.label, 'Timing matters here'); assert.equal(j.checks.burning_moved_later, 'Yes, likely');
    assert.ok(j.link.includes('box=27.6%2C73.8%2C32.6%2C77.6')); assert.ok(['signal', 'within', 'below', 'unknown'].includes(j.live.status)); assert.ok(['record', 'above', 'below', 'lowest', 'quiet', 'unknown'].includes(j.this_week_vs_usual.status)); assert.equal(r.headers.get('access-control-allow-origin'), '*');
  });
  await t('/api/check accepts lat/lon and the wheat season control', async () => {
    const j = await (await check(new Request(`${base}/api/check?box=27.6,73.8,32.6,77.6&months=4,5&a=2019&b=2025`))).json(); assert.equal(j.verdict.label, 'Satellite timing doesn’t explain this');
    const k = await (await check(new Request(`${base}/api/check?lat=30.9&lon=75.85`))).json(); assert.equal(k.status, 'ok'); assert.deepEqual(k.box, [29.9, 74.85, 31.9, 76.85]);
  });
  await t('/api/check rejects bad input with a usable message', async () => {
    for (const q of ['box=1,2', 'box=0,0,30,30', 'box=27,73,32,77&months=13', 'box=27,73,32,77&a=2025&b=2021']) { const r = await check(new Request(`${base}/api/check?${q}`)); assert.equal(r.status, 400, q); assert.ok((await r.json()).message); }
  });
  await t('/api/punjab matches the planner file and resolves aliases', async () => {
    const j = await (await punjab(new Request(`${base}/api/punjab?district=fazilka`))).json(); assert.equal(j.district, 'Fazilka'); assert.equal(j.check_window.label, '4 pm to 6 pm');
    const v = doc.districts.find(d => d.name === 'Fazilka').gk2a_pixel_hours['2025'], s = v.reduce((a, b) => a + b, 0);
    assert.ok(Math.abs(j.check_window.share_pct - 100 * (v[4] + v[5] + v[6]) / s) < 1e-9);
    assert.equal((await (await punjab(new Request(`${base}/api/punjab?district=Mohali`))).json()).district, 'Sahibzada Ajit Singh Nagar');
    assert.equal((await punjab(new Request(`${base}/api/punjab?district=Atlantis`))).status, 404);
    const text = await (await punjab(new Request(`${base}/api/punjab?district=Sangrur&format=text`))).text(); assert.match(text, /Check fields 3 pm to 5 pm/);
  });
  // Telegram: fake Telegram API + fake Upstash.
  const sent = [], redis = {}; const env = {TELEGRAM_BOT_TOKEN: 'TEST', TELEGRAM_WEBHOOK_SECRET: 's3cret', UPSTASH_REDIS_REST_URL: 'https://redis.test', UPSTASH_REDIS_REST_TOKEN: 'x', CRON_SECRET: 'cron', PUBLIC_SITE_URL: 'https://burn-clock.vercel.app'};
  const fake = async (url, init = {}) => {
    const u = String(url);
    if (u.startsWith('https://api.telegram.org/')) { sent.push({url: u, body: JSON.parse(init.body)}); return new Response(JSON.stringify({ok: true, result: true}), {status: 200}); }
    if (u === 'https://redis.test') { const [cmd, key, a, b] = JSON.parse(init.body); redis[key] ??= {}; let result = null; if (cmd === 'HSET') redis[key][a] = b; if (cmd === 'HDEL') delete redis[key][a]; if (cmd === 'HGETALL') result = Object.entries(redis[key]).flat(); return new Response(JSON.stringify({result}), {status: 200}); }
    return fetch(url, init);
  };
  const tg = (text, extra = {}) => handleTelegram(new Request(`${base}/api/telegram`, {method: 'POST', headers: {'x-telegram-bot-api-secret-token': 's3cret', 'content-type': 'application/json'}, body: JSON.stringify({message: {chat: {id: 42}, ...(text ? {text} : {}), ...extra}})}), env, undefined, fake);
  await t('Telegram webhook rejects a wrong secret', async () => { const r = await handleTelegram(new Request(`${base}/api/telegram`, {method: 'POST', headers: {'x-telegram-bot-api-secret-token': 'no'}, body: '{}'}), env, undefined, fake); assert.equal(r.status, 403); });
  await t('Telegram /district, /week, /check, location and deep link answer from the data', async () => {
    await tg('/district Sangrur'); assert.match(sent.at(-1).body.text, /Check fields 3 pm to 5 pm/); assert.equal(sent.at(-1).body.chat_id, 42);
    await tg('/week'); assert.match(sent.at(-1).body.text, /fire detections per NOAA-20 detection/);
    await tg('/check 30.9 75.85'); assert.match(sent.at(-1).body.text, /^Verdict: /);
    await tg(null, {location: {latitude: 30.9, longitude: 75.85}}); assert.match(sent.at(-1).body.text, /Ludhiana/);
    await tg('/start d_Fazilka'); assert.match(sent.at(-1).body.text, /Fazilka/);
  });
  await t('Telegram subscriptions and the weekly digest', async () => {
    await tg('/subscribe Barnala'); assert.deepEqual(redis['burnclock:subs'], {'42': 'Barnala'});
    const d = await handleDigest(new Request(`${base}/api/digest`, {headers: {authorization: 'Bearer cron'}}), env, undefined, fake); assert.deepEqual(await d.json(), {status: 'ok', subscribers: 1, sent: 1}); assert.match(sent.at(-1).body.text, /^Weekly update\n.*Barnala/);
    assert.equal((await handleDigest(new Request(`${base}/api/digest`), env, undefined, fake)).status, 403);
    await tg('/unsubscribe'); assert.deepEqual(redis['burnclock:subs'], {});
  });
  await t('Unconfigured bot and setup are explicit', async () => {
    assert.equal((await handleTelegram(new Request(`${base}/api/telegram`, {method: 'POST'}), {}, undefined, fake)).status, 503);
    const s = await handleSetup(new Request(`${base}/api/telegram-setup?key=s3cret`), env, fake); assert.equal(s.status, 200); assert.equal(sent.find(x => x.url.endsWith('/setWebhook')).body.url, 'https://burn-clock.vercel.app/api/telegram');
    assert.equal((await handleSetup(new Request(`${base}/api/telegram-setup?key=wrong`), env, fake)).status, 403);
  });
  // Assistant: a fake Claude API that asks for a tool, then answers. The server runs the real tool and checks the numbers.
  const claudeCalls = [];
  const fakeClaude = (script) => async (url, init = {}) => {
    if (String(url) === 'https://api.anthropic.com/v1/messages') {
      const body = JSON.parse(init.body); claudeCalls.push(body); assert.equal(init.headers['x-api-key'], 'sk-test');
      const step = script[Math.min(claudeCalls.length - 1, script.length - 1)];
      return new Response(JSON.stringify(typeof step === 'function' ? step(body) : step), {status: 200});
    }
    return fake(url, init);
  };
  const aenv = {...env, ANTHROPIC_API_KEY: 'sk-test'};
  const askReq = (question, ip = '1.2.3.4') => new Request(`${base}/api/ask`, {method: 'POST', headers: {'content-type': 'application/json', 'x-forwarded-for': ip}, body: JSON.stringify({question})});
  await t('Assistant answers from a real tool result and passes the number check', async () => {
    claudeCalls.length = 0;
    const script = [
      {stop_reason: 'tool_use', content: [{type: 'tool_use', id: 'tu1', name: 'check_place', input: {box: [27.6, 73.8, 32.6, 77.6], months: [10, 11], a: 2021, b: 2025}}]},
      (body) => { const result = JSON.parse(body.messages.at(-1).content[0].content); return {stop_reason: 'end_turn', content: [{type: 'text', text: `${result.verdict.label}: activity fell about ${Math.round(-result.combined_record.change_pct)}% from 2021 to 2025. ${result.link}`}]}; },
    ];
    const r = await handleAsk(askReq('Can I trust the Punjab fire drop?'), aenv, undefined, fakeClaude(script)); const j = await r.json();
    assert.equal(j.status, 'ok', JSON.stringify(j)); assert.match(j.answer, /^Timing matters here: activity fell about 80%/); assert.deepEqual(j.tools.map(x => x.name), ['check_place']);
    assert.equal(claudeCalls[0].tools.length, 3); assert.match(JSON.stringify(claudeCalls[0].system), /Every number must come from the briefing/); assert.match(JSON.stringify(claudeCalls[0].system), /burn_clock_briefing.*official_claim/); assert.equal(claudeCalls[0].model, 'claude-sonnet-5-5');
  });
  await t('Assistant flags a number that is not in the data, after one retry', async () => {
    claudeCalls.length = 0;
    const script = [
      {stop_reason: 'tool_use', content: [{type: 'tool_use', id: 'tu1', name: 'punjab_district', input: {district: 'Sangrur'}}]},
      {stop_reason: 'end_turn', content: [{type: 'text', text: 'Burning in Sangrur fell 61.7% thanks to enforcement.'}]},
      {stop_reason: 'end_turn', content: [{type: 'text', text: 'Burning in Sangrur fell 61.7%.'}]},
    ];
    const j = await (await handleAsk(askReq('Did burning fall in Sangrur?', '5.6.7.8'), aenv, undefined, fakeClaude(script))).json();
    assert.equal(j.status, 'unverified'); assert.deepEqual(j.unverified, [61.7]); assert.equal(claudeCalls.length, 3); assert.match(claudeCalls[2].messages.at(-1).content, /do not appear in the briefing or any tool result: 61.7/);
  });
  await t('Assistant uses the role and the conversation so far, and allows numbers from the briefing', async () => {
    claudeCalls.length = 0;
    const script = [(body) => ({stop_reason: 'end_turn', content: [{type: 'text', text: 'The official claim is a 93% fall from 2021 to 2025. What to do: 1. Say counts fell, not burning.'}]})];
    const r = await handleAsk(new Request(`${base}/api/ask`, {method: 'POST', headers: {'content-type': 'application/json', 'x-forwarded-for': '7.7.7.7'}, body: JSON.stringify({question: 'And what should I write?', role: 'journalist', history: [{role: 'user', content: 'Punjab fires fell?'}, {role: 'assistant', content: 'Counts fell; burning moved later.'}]})}), aenv, undefined, fakeClaude(script));
    const j = await r.json(); assert.equal(j.status, 'ok', JSON.stringify(j));
    const msgs = claudeCalls[0].messages; assert.equal(msgs.length, 3); assert.equal(msgs[0].content, 'Punjab fires fell?'); assert.match(msgs[2].content, /^\(My role: someone who reports news or checks claims\.\) And what should I write\?/);
  });
  await t('Assistant is off without a key, validates input and rate-limits', async () => {
    assert.deepEqual(await (await handleAsk(new Request(`${base}/api/ask`), {}, undefined, fake)).json(), {configured: false, model: null});
    assert.equal((await handleAsk(askReq('x'), {}, undefined, fake)).status, 503);
    assert.equal((await handleAsk(askReq(''), aenv, undefined, fake)).status, 400);
    const one = {stop_reason: 'end_turn', content: [{type: 'text', text: 'I can only answer from Burn Clock data.'}]};
    let last; for (let i = 0; i < 21; i++) last = await handleAsk(askReq('hi', '9.9.9.9'), aenv, undefined, fakeClaude([one]));
    assert.equal(last.status, 429);
  });
  await t('Telegram free text goes to the assistant when it is on', async () => {
    claudeCalls.length = 0; const before = sent.length;
    const script = [{stop_reason: 'tool_use', content: [{type: 'tool_use', id: 'w', name: 'punjab_week', input: {}}]}, (body) => { const r = JSON.parse(body.messages.at(-1).content[0].content); return {stop_reason: 'end_turn', content: [{type: 'text', text: `This week Aqua saw ${r.aqua_per_noaa20.toFixed(1)} detections per NOAA-20 detection.`}]}; }];
    await handleTelegram(new Request(`${base}/api/telegram`, {method: 'POST', headers: {'x-telegram-bot-api-secret-token': 's3cret'}, body: JSON.stringify({message: {chat: {id: 77}, text: 'what is happening in punjab this week'}})}), aenv, undefined, fakeClaude(script));
    assert.equal(sent.length, before + 1); assert.match(sent.at(-1).body.text, /This week Aqua saw \d+\.\d detections[\s\S]*✓ Numbers checked/);
  });
} finally {
  writeFileSync('api-checks.json', JSON.stringify({tested_at: new Date().toISOString(), status: errors.length ? 'failed' : 'passed', checks, errors, limitations: ['Telegram and Redis are faked; no message was sent to a real chat.']}, null, 2) + '\n');
  if (errors.length) process.exitCode = 1; console.log(errors.length ? 'API checks failed' : `API checks passed (${checks.length})`);
}
