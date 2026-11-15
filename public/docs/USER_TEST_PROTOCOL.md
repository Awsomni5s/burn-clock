# Burn Clock: human test protocol

**Status: prepared; no participant sessions or human results are recorded by this document.** The team must run the study with real people. Automated tests, AI reviews and team rehearsals are not participant evidence.

Run on **Sunday afternoon, 15 November 2026**, using the deployed build. Record the actual time zone, URL and build/commit for each round. This is a facilitator kit, not a scheduled event or a claim that recruitment has happened.

The hosted site is currently owner-private. Use a supervised device already signed in as the owner, or have the owner explicitly arrange participant access. Do not circulate account credentials.

## 1. Participants, setup and sequence

Recruit **5–8 people for round 1**, spanning the four roles below, then **5–8 different people for the retest**. Aim for at least one person with relevant experience in each role per round. Record actual experience; label convenience participants as proxies. Do not count the builders as target users. If fewer people or roles are available, report that limitation and leave the corresponding gate unmet.

Everyone attempts all four tasks. The Punjab task comes first, before any explanation of the science. Alternate the order of the remaining three tasks between sessions. Keep task wording, home-page starting state, device class and scoring consistent between rounds. Avoid showing people the headline in recruitment material. Do not share answers between participants.

Use one facilitator and a separate observer when possible. Obtain consent for notes, optional screen/audio recording, and separately for publishing anonymized quotes. Use IDs such as P01; keep names and contact details out of the results file. Verify that each participant can access the deployed URL before the timed session, without exposing the home page or teaching the navigation.

Suggested working plan with two facilitators: baseline sessions 13:00–14:40; identify and fix the top three confusions 14:40–15:30; new-participant sessions 15:30–17:10; scoring and Methods update 17:10–17:45. These are proposed local times, not bookings. Allow about 25 minutes per session. If the team cannot complete a retest, publish “retest not yet run”; do not present the same people's second attempts as independent confirmation.

Complete checks in this order:

1. **Automated number audit:** reconcile every displayed numeric claim and export field with its source or documented calculation, including units, baseline, rounding, mask state and unavailable values. Require 100% of the enumerated assertions to pass; publish the assertion count and tested coverage. A passing set of selected assertions does not prove every possible area has been independently checked.
2. **Edge cases:** empty/tiny boxes; the 2012 MODIS-to-VIIRS transition; pre-coverage platforms; outage months, including S-NPP 3–6 November 2024; failed tile loads; low-count clock diagnostics; date-line boxes. Missing observations must not become zero. Save the actual run report.
3. **Five-second home-page test**, before any task explanation.
4. **Four decision tasks** with 5–8 real people, including the timed claim card.
5. **Cropping/misuse test**, after the main comprehension answer is locked.
6. **Accessibility and speed checks**, recorded separately from task comprehension.

## 2. Neutral session script and five-second test

Read: “We are testing this website, not you. Please use it as you normally would. You may say what you are thinking. I will mostly observe and will not explain the interface. You can stop at any time.”

Load the same home page at the top, with Punjab + Haryana and November 2025 selected. Wait for the content to render before exposing it. Show it for **exactly five seconds**, then cover the entire page with a blank screen. Ask only: **“What was this page saying, and what do you think you could use it to do?”** Record the response verbatim before reopening the page. Do not ask whether they noticed satellites, timing or a percentage.

Score recall separately: 2 = remembers both comparison of burning activity over time/areas and satellite observation timing; 1 = remembers one; 0 = neither or materially incorrect. Record wrong interpretations as well as the score. There is no invented recall pass bar; report the distribution and use it to identify confusion.

During tasks, neutral prompts such as “What would you do next?” are allowed after a pause. Do not suggest a navigation label, interpretation, baseline or unit. Log all help. If rescue is needed, mark the task assisted or failed before helping; do not turn it into an unassisted pass. A clarification of what the participant meant is allowed only after capturing their original answer, without supplying facts. Correct misconceptions in the debrief after all scoring is complete.

## 3. Four users and decisions

The plan describes calendar, clock, world map, receipt and methods/validation experiences. In this build the world atlas is within **Satellite clock**; **Validation** and **Methods & sources** have separate destinations. Judge completion by the evidence found, not by following a prescribed click path.

| Task / user | Read this prompt verbatim | Decision the app should change | Required handoff / success evidence |
|---|---|---|---|
| T1 — Journalist or fact-checker; always first | “Your editor asks: ‘Did Punjab burning fall 93% from 2021 to 2025?’ Use this website to write a two-sentence answer you would be willing to publish, and show the evidence.” | Qualify a real satellite-count decline rather than call it fake, or claim it measures the entire afternoon. | Written answer with its source, the role of observation time, qualified afternoon comparison and baseline caveat. Apply the Punjab rubric below. Then run the timed card instruction. |
| T2 — Air-quality/emissions modeller | “A colleague proposes reducing Punjab's afternoon fire-emissions input by 93%, using the reported 2021–2025 change. Decide whether this website supports that change and write a short note describing your next step.” | Check time-of-day coverage before scaling smoke or emissions from a single satellite-count trend. | Does not treat hotspots, pixel-hours or pixel-days as measured emissions; identifies late-afternoon coverage and proposes obtaining or evaluating time-resolved emissions/observations. Uses the area’s ‘So what?’ guidance without treating a badge alone as a quantitative emissions correction. |
| T3 — Policy or enforcement analyst | “You are updating Punjab's seasonal monitoring brief. Recommend one change, or explain why no change is needed. Include the evidence and one limitation.” | Review monitoring hours and retain satellite-specific reporting before declaring a whole-afternoon reduction. | Actionable monitoring proposal tied to the hourly evidence; retains the real official decline; acknowledges the comparison window or baseline. Does not infer farmer motive, evasion, or individual responsibility from the satellite signal. |
| T4 — Fire researcher | “Prepare a comparison of Paraná's November burning activity in 2011 and 2013. Export what another researcher would need, and decide whether the two raw counts can be compared directly.” | Account for the sensor transition and regional uncertainty before accepting a raw trend. | Selects the same area/month across years; exports raw and harmonized series with units, bounds, source satellites and badge; explains the 2012 transition and finds Paraná’s documented validation weakness. Missing VIIRS values in 2011 remain missing. |

For T2–T4, record **pass** only when the decision and required handoff are both correct without coaching; otherwise use **partial**, **fail**, or **not attempted** with the reason. Record time, errors, assistance and a verbatim decision. These tasks diagnose usefulness; report their actual rates without inventing extra acceptance thresholds.

### Punjab rubric: facilitator-only answer key

Do not show this section before the participant answers. Score the submitted T1 answer and evidence explanation, not whether they repeat our wording.

A pass requires all of the following:

- Treats **71,304 → 5,114, about 93%**, as a real reported satellite-count decline. Does not say 94%.
- Explains that the reported decline does not measure the entire afternoon. Does not reduce the official protocol to one sensor at exactly 13:30; observation timing is a limitation of the comparison, not a single-clock definition of the official statistic. The official protocol combines MODIS and VIIRS and uses 15 September–30 November; the receipt uses Punjab state, October–November.
- Describes a qualified decline of about one third in GK2A unique afternoon pixel-days versus 2021, while recognizing stronger late-afternoon activity. Does not turn this into the true number of fires or a measured emissions total.
- Notices that 2021 is the busiest GK2A year in this supplied record and that the comparison with 2019 changes the story. Understands that unit, mask and baseline must travel with the claim.

Evidence for scoring: the unmasked 12:00–18:00 IST, confidence ≥2 pixel-day series is 24,447 in 2021 and 16,096 in 2025 (about a 34% decline), and 7,527 in 2019 (2025 is about 2.14× 2019). The matched-calendar-day fan gives about a 36% decline versus 2021 and 1.73× 2019; either is acceptable when correctly labeled. The 17:00 ratio is about 1.40× 2021. Summing the 16:00–18:00 pixel-hours and dividing by all 12:00–18:00 pixel-hours gives about 96% in 2025 versus 52% in 2021. Pixel-hours measure repeated hourly observations, not unique fires. GK2A is a preliminary, coarse-pixel product that can detect hot smoke; it is not ground truth. Exact memorization of all these numbers is not required.

**Automatic fail:** any participant concludes, in their own interpretation, that “burning did not fall” or “the data is fake,” including equivalent wording. Quoting and rejecting one of those claims is not an automatic fail. An automatic failure at any point in the unaided session blocks the round even if the participant later self-corrects; record both statements. Do not prompt these phrases during the main test.

### Timed claim-card instruction

After locking the T1 answer, read: **“Make a shareable claim card that answers your editor's question and keeps the context needed to interpret it.”** Start timing after the instruction; stop when the exported card is saved and the participant says it is ready. Include navigation, selections, generation and download time. Save the exact artifact and elapsed seconds. Do not subtract delays caused by the interface.

Card success requires **less than 120 seconds**, unassisted, with the claim, place, comparison years, units/window, source and nearby qualification intact. Keep the official decline, whole-afternoon comparison and 2021-baseline caveat together. At exactly 120 seconds the speed criterion fails. Record every participant's result, the success numerator/denominator, median, range and timeouts. The round meets the card gate only if every participant who starts the card task produces an acceptable card in under 120 seconds; report non-starts and reasons separately. This explicit operational rule prevents a single fastest demonstration from standing in for user performance.

## 4. Cropping and misuse

After the main answer is recorded, ask: “Using an ordinary screenshot or crop, can you make this card support a misleading claim? Show what you changed and explain the new impression.” Do not publish the misleading version. Keep both original and attempted crop as research artifacts.

Try a normal social preview crop, square crop and tight crop around each large statistic. Check whether a visible claim can lose its denominator, years, observation time, unit, mask, source, the real-decline qualification or the 2021 baseline caveat. Ask another observer to read the crop without seeing the original; record their interpretation verbatim. Test a card for an empty or not-identifiable area too: it must not manufacture a definitive finding.

Log each successful misleading crop as a failure and fix the layout or wording. Rerun the same crop cases after the fix and add any new attack the team finds. Repeating context near each large number helps, but **no static card is immune to deliberate cropping or editing**. Report the actual crops tried and remaining weaknesses; do not claim “misuse-proof.” Keep these prompted adversarial statements separate from spontaneous comprehension failures.

## 5. Accessibility and speed: separate evidence

Automated accessibility scans and browser assertions support the audit; they do not demonstrate screen-reader usability or comprehension. Record tool/version, build, tested pages and actual failures. A test not run is “not tested,” never a pass.

Manual checks, on all five navigation destinations:

- Keyboard only: visible focus, logical order, no traps, region selection without drawing, calendar navigation, mode changes, clock year, receipt controls, exports and navigation menu. Confirm dialogs or expanded controls return focus sensibly.
- With a real screen reader, record browser, OS and assistive-technology versions. Check page/region names, selected values, missingness, loading/error announcements, calendar cell labels and chart/table alternatives. Have a person who uses the technology attempt a task when possible; distinguish their session from a developer's technical check.
- Check 200% zoom, 400% reflow and a narrow phone viewport; text and controls must remain usable. Check actual contrast and that color is not the only badge or data signal. Test reduced-motion preferences.
- Measure cold and warm loads on named device/network settings: time until the home page is readable, default area is usable, a large area completes, and a claim card downloads. Record data-transfer size, errors and whether navigation remains responsive. Record the observed timings; do not substitute a desktop cache result for a phone or constrained-network result.

The under-120-second card requirement is the explicit task-speed gate. Report other performance measurements and any blocking delay with their test conditions; do not quietly invent or change a target after observing the result.

## 6. Scoring, fixes and honest reporting

Use `USER_TEST_RESULTS_TEMPLATE.csv` as an event log: one row per participant for `five_second`, `T1`, `T1_card`, `T2`, `T3`, `T4` and each crop attempt; separate rows for manual accessibility/performance checks. `outcome` is `pass`, `partial`, `fail`, `not_attempted` or `not_tested`; five-second score uses `recall_score`. Leave unobserved fields blank. `help_given` records the actual intervention or `none`. The Punjab rubric columns accept `yes`/`no` only after review. Do not put participant contact information in the CSV.

Lock the denominator before scoring: all eligible participants who start T1 in that round. A timeout, abandonment or technical interruption after starting does not disappear from the denominator; mark the reason and count it as not passed. Report accessibility problems or access failures that prevented a start separately. Two team members should score the recorded T1 answers independently using the rubric, resolve disagreements against the original evidence and preserve the initial scores in notes.

The Punjab gate is **at least 80% pass AND zero automatic failures**. Minimum passing counts are 4/5, 5/6, 6/7 and 7/8, with zero automatic failures in every case. Report counts alongside percentages. A small convenience sample provides usability evidence, not a population-level validation claim.

Rank confusions by harm to the decision, then recurrence, then delay. Automatic failures outrank cosmetic friction. For the **top three**, record: observed confusion and anonymous quote; participants affected/total; affected screen; change made; commit/build; new-participant retest result. Preserve a genuine “no change” or “not fixed” status if that is what happened. Rerun the numeric and edge-case checks after changing logic or displayed evidence.

Publish this reporting block on Methods using actual results only:

| Field | Round 1 | Retest with new people |
|---|---|---|
| Actual date/time zone, build, URL | | |
| Participants, role mix, proxies and devices | | |
| Five-second recall: score 0 / 1 / 2 counts | | |
| Punjab passes / T1 starters (%) | | |
| Automatic failures / T1 starters | | |
| Acceptable cards under 120 s / card starters; non-starts | | |
| Card time median / range / timeouts | | |
| T2, T3, T4 passes / task starters | | |
| Misleading crops / crops attempted; remaining weaknesses | | |
| Human accessibility checks actually completed | | |
| Automated numeric assertions passed / total; coverage | | |

Follow the table with the three confusion→change→retest records, anonymized quotes with permission, and limitations. Before sessions, the Methods status must remain **“Human testing pending.”** After an incomplete round, state exactly what was done and what remains. Do not invent participants, quotes, before/after improvement, scientific validation or a passed gate.
