# Burn Clock: two-minute demonstration

Open the deployed app and choose **Start here**. The five-step tour follows the order below. The archive is historical through 2025. The live panel on a place report shows NASA's dated near-real-time feed separately.

## 0:00–0:20 — The verdict (Check a place → Punjab + Haryana)

"Fire satellites look at each place a few fixed times a day, and two of them have drifted. Burn Clock joins MODIS and VIIRS into one record and gives every place a verdict."

- Punjab + Haryana, Oct–Nov, 2021 vs 2025: **Timing matters here**.
- Read the one-sentence answer and the two checks: "Has burning moved to hours the satellites miss?" and "Is the older MODIS record off here?".
- Pick a role and point out that the actions change with both the verdict and the job.
- Show **Download one-page brief**: verdict, then actions, then evidence, then limits, ready to print.

## 0:20–0:50 — Act on it: Punjab, district by district

"For Punjab we have hourly geostationary data, so we turn the verdict into a plan."

- The districts are ranked by burning at 4 pm or later.
- Click the darkest district on the map (Fazilka in 2025):
  - **Field teams:** 4–6 pm covered almost all of the afternoon fire signal, while the 1–2 pm satellite-pass images held almost none. The busiest two weeks are named. Copy or WhatsApp the plan.
  - **Forecasters:** the 1:40 pm count fell far more than the whole-afternoon record. The factor appears for every base year as a sensitivity range, not a correction. Download the hourly profiles.
  - **Reporters:** "You can say / Don't say / Why", generated per district and withheld where the data are thin.

## 0:50–1:10 — Same check, different answers (Case studies)

There are six places with four different verdicts.
- **Punjab's wheat season** is the built-in control: same place, no timing problem.
- **Kalimantan** shows the error running the other way, because MODIS exaggerates the decline.

## 1:10–1:35 — The hourly evidence (Case studies → Punjab → hourly evidence)

Move the India-time slider from 1 pm to 5 pm. At 5 pm, 2025 had more fire detections than 2021, even though the 1:40 pm count fell sharply. GK2A is a preliminary product with ~4 km pixels. It is not ground truth.

## 1:35–2:00 — How reliable is it?

- Held-out errors, the removed 2012 jump, and where the method fails (Paraná, transfer between continents).
- Click any underlined number to see its file, field and producing script.
- `node scripts/reproduce.mjs` recomputes the checked numbers in a browser.
