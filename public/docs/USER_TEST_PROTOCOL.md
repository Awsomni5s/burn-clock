# Burn Clock: real-person test protocol

**Status: prepared, not run. No testers, quotes, scores, bookings or before/after results are recorded here.** Automated checks and AI reviews do not count as participant evidence. The team runs these tests Sunday afternoon, 15 November 2026, in US Eastern time; record actual session times and build. This file replaces the earlier task set with addendum section 8.

The hosted site is owner-private. Use an owner-supervised signed-in device, or have the owner arrange participant access. Do not share credentials. No invitations or calendar events have been sent.

## Setup and sequence

Recruit 5–8 real people for the first round, ideally at least one air-quality/emissions modeller, policy/enforcement analyst, journalist/fact-checker and fire researcher. Record relevant experience and label proxies. Builders and team rehearsals do not count as target users. Use new people for the retest. Everyone attempts T1–T4; always run T1 first. Do not include answers in recruitment material.

Obtain consent for notes, optional recordings and separately for publishing anonymous verbatim quotes. Use participant IDs, not names, in the results CSV. Explain: “We are testing the website, not you. Please think aloud. I will observe rather than explain the interface.” Allow about 10 minutes for the four tasks, plus setup, recall and debrief. Record actual overruns.

Run in order:

1. Automated integrity against supplied files and the independent Python reference: every enumerated assertion must pass. Preserve actual coverage and denominator; no blanket claim about untested rectangles or scientific causation.
2. Automated edge cases: empty box, one cell, equator and antimeridian, 2012 sensor transition, S-NPP 3–6 November 2024 outage, Terra-only 2000–02, live-feed failure. Missing is never zero.
3. Five-second home-page test.
4. T1–T4 with 5–8 people thinking aloud.
5. Two-team-member misuse test, separate from spontaneous participant interpretations.
6. Keyboard, colour-blind simulation, screen-reader checks, 375-pixel phone and throttled-4G speed checks.

A proposed afternoon schedule is first round 13:00–15:00, rank the three main confusions and implement fixes, then retest with new people before 19:00 where feasible. These are planning windows, not sessions that happened. If a new-participant retest cannot happen, report it pending.

## Five-second test

Expose the fully loaded home page for exactly five seconds, then hide it. Ask **“What is this site telling you?”** Record the first answer verbatim before reopening it or prompting. Pass if the participant independently explains that the measured decline depends on when satellites look. At least four of five must pass; if more are tested, report the actual numerator and denominator and require at least 80%. Do not select the most favourable five afterwards.

No science explanation or navigation hints before scoring. Neutral “What would you do next?” prompts are allowed during tasks but must be logged. If assistance is given, record an assisted attempt; never convert it into an unaided pass. Correct misconceptions only after scoring all tasks.

## Four tasks

| Task | Read verbatim | Unaided success |
|---|---|---|
| T1 — Punjab | “Did Punjab's stubble burning fall 93% between 2021 and 2025? Use the website to write the sentence you would report.” | Describes a real sharp decline in reported polar-satellite counts, a much smaller decline across GK2A afternoon observations, a rise at 17:00, and a baseline or uncertainty qualification. Apply the rubric below. |
| T2 — California claim card | “Make a claim card for California, August–September, 2019 versus 2024, and share it.” | Selects the correct place, two months and years; makes a context-complete card and a matching permalink without help. Record time until saved/copied and ready to share. Use a test destination or show the artifact to the facilitator; no real publication is needed. |
| T3 — Cerrado inventory | “You're building an emissions inventory for the Cerrado. Which years can you use as they are?” | Uses the timing check and source mix, identifies converted MODIS versus the VIIRS era, keeps the displayed uncertainty, and does not treat fire detections as direct emissions or a timing badge as proof that a trend is real. |
| T4 — Paraná | “Is the Paraná Delta's trend real?” | Reads the selected years, approximate range and timing check correctly, finds the regional validation weakness, and avoids certifying a true trend from the badge. An uncertain answer is successful when the displayed evidence warrants it. |

For every task record outcome (`pass`, `partial`, `fail`, `not_attempted`), elapsed seconds, help, wrong conclusions, confidence from 1–5, evidence found and the sentence the person would write. Capture the exact selections and exported artifacts. A task timer starts after the instruction and includes navigation and interface delays. Keep timeouts in the denominator.

### T1 facilitator rubric

A pass needs all four elements: (1) the official 71,304 → 5,114 decline is real and about 93%; (2) it does not measure all afternoon burning; (3) afternoon GK2A observations fell substantially less while the 17:00 observations rose; (4) the baseline or measurement uncertainty is acknowledged. Numbers need not be recalled verbatim if the interpretation is correct.

Scientific key: official counts combine Terra/Aqua MODIS and S-NPP VIIRS, with a 15 September–30 November window; they are not literally one 13:30 pass. The receipt covers Punjab state, October–November. Unmasked GK2A confidence ≥2 observations at 12–18 IST have unique pixel-days 24,447 (2021), 16,096 (2025), and 7,527 (2019): about 34% lower than 2021 but 2.14× 2019. The separately masked fan is about 36% lower than 2021 and 1.73× 2019. At 17:00 the 2025/2021 ratio is 1.40×. Late-hour pixel-hour shares are about 96% versus 52%, including 16:00–18:00 in a 12:00–18:00 denominator. These units do not estimate true fire counts or emissions. GK2A can detect hot smoke and is not ground truth.

**Hard failure:** the participant independently concludes “burning didn't fall” or “the data is fake,” or equivalent. A quote that they explicitly reject is not a hard failure. A spontaneous hard failure blocks the round even if they later self-correct; record both statements. Do not lead participants into those phrases. Prompted misuse statements belong in the misuse log, not the comprehension denominator.

### T2 timing and submission gates

Score correctness and speed separately. Each T2 attempt under 120 seconds, without help and with the correct complete artifact, passes that individual task. The submission gate uses the **median T2 time under 120 seconds**, as the addendum specifies, rather than requiring every participant to be under two minutes. Report all attempted-task times and successes, failures, non-starts and timeouts. If a timeout has no completed-card time, do not exclude it to claim a passing median: report the median as censored or the gate unmet unless the recorded lower bound already resolves it. Exactly 120 seconds does not meet “under.”

Required gates: numeric integrity 100% of the enumerated checks; T1 at least 80% (4/5, 5/6, 6/7 or 7/8) with zero hard failures; T2 median under 120 seconds. Five-second recall has its separate four-of-five gate. Do not change thresholds after seeing results.

## Misuse: two team members

One person creates misleading crops of the Punjab and California cards and their share text; the other interprets each crop without seeing the original. Try normal social previews, square crops and tight crops around a number. Record original/crop, scenario, interpretation and whether the unit, area, base year, time/window, source and qualification survive. Include the base-year caveat inside the image and share text. Also try an unavailable or sparse area: it must not invent an answer.

A successful misleading crop is a failed case; fix and rerun it. No static image is immune to deliberate cropping or editing. Report actual cases and remaining weaknesses, not “crop-proof.” Do not publish misleading test artifacts publicly.

## Accessibility and speed

A human checks keyboard-only navigation with visible focus/no traps, explicit labels and selected states, and a real screen reader (record versions). Test colour-blind simulations, non-colour cues, 200% zoom and 400% reflow, reduced motion and a 375-pixel-wide phone. Record what was actually tested and what remains. Automated accessibility scans do not establish screen-reader usability.

Measure the first useful Punjab answer on a cold build with specified throttled-4G bandwidth, latency and CPU conditions; the required target is **under three seconds**. Record device/browser/network, cache state, timing definition, run count and actual observations. Desktop local-server measurements are lab results, not field performance. Also record card-generation time, map failures and responsive controls.

## Before/after reporting

Use `USER_TEST_RESULTS_TEMPLATE.csv` as an empty event log, one row per participant/task and per manual check. Keep unpublished quotes private unless permission is explicit. `five_second` and `T1`–`T4` are task IDs; manual checks use `crop`, `keyboard`, `screen_reader`, `colour_blind`, `phone_375`, `speed_4g`.

Preserve all starters in task denominators. Record access failures separately. Two team members should independently score T1, resolve disagreements from the original response and retain notes. Rank the top three confusions by harm, recurrence and delay; record affected participants, exact anonymous evidence, screen, change, build and result with new people. Do not manufacture three problems if fewer were observed; state the actual count.

Write actual results in `TESTING.md`, then summarise on Methods:

| Evidence | Round 1 | Retest with new people |
|---|---|---|
| Date/time zone, URL, build | Not run | Not run |
| Participants / roles / proxies / devices | Not recorded | Not recorded |
| Five-second passes / starters | Not recorded | Not recorded |
| T1 passes / starters; hard failures | Not recorded | Not recorded |
| T2 successes / starters; median / range / timeouts | Not recorded | Not recorded |
| T3 and T4 successes / starters | Not recorded | Not recorded |
| Crops attempted / misleading crops | Not recorded | Not recorded |
| Manual accessibility and speed | Not run | Not run |
| Top-three observed confusions and changes | No observations yet | No observations yet |

Only after real sessions, use “Tested with N people; X of N read the Punjab result correctly.” Before then, keep **Human testing pending**. Never invent participants, quotes, scores or improvement.
