# Burn Clock: NASA Space Apps 2026 submission (copy-paste text)

**Challenge:** Harmonization of MODIS and VIIRS Hot Spots
**Team:** Blackout (Xavier Goff, Harshiv Puri, Otto Skibeli)

---

## Project name
Burn Clock: a fire calendar you can act on

## High-level summary
Burn Clock merges 548,501,203 NASA FIRMS fire detections from five satellites (MODIS on Terra and Aqua; VIIRS on S-NPP, NOAA-20 and NOAA-21) into one burning-activity calendar for any place on Earth, every month since 2001, on a single VIIRS-equivalent scale. The 2012 MODIS-to-VIIRS jump falls from ×2.48 to ×0.96, and the median error on years held out of the model is 1.1%.

The calendar also checks something most fire records miss: polar satellites only look at fixed times of day. In Punjab, India, the official fire count fell 93% from 2021 to 2025. An hourly geostationary satellite shows the afternoon burning fell only about 34%, because 96% of it now happens after 4 pm, after the satellites pass.

Burn Clock gives every place one of four verdicts on whether its trend can be trusted. It then turns that verdict into a plan for each user: district officers, air-quality forecasters, journalists and researchers.

## Link to project demo
- 7-slide deck: https://burn-clock.vercel.app/docs/Burn_Clock_Demo_7_Slides.pdf
- 30-second video: https://burn-clock.vercel.app/docs/Burn_Clock_Demo_30s.mp4

## Final project
- Live app: https://burn-clock.vercel.app
- Code (public): https://github.com/Awsomni5s/burn-clock

## Project details

**What it does.** The app asks two things, then shows two views and an advisor.
1. **What do you do?** District officer, air-quality forecaster, journalist or researcher.
2. **Which place?** Search 176 countries and about 4,600 states and provinces, or draw a rectangle, a circle or any shape on the map.
3. **Fire calendar.** A map of where it burns (fire level curves) next to the harmonized month-by-year calendar. The calendar shows the fire season (e.g. Punjab: Oct–Nov, 63% of a typical year) and each month against the 2003–2022 average. A "Clock check" marks every year since 2021 as trustworthy or distorted by satellite timing. For Punjab there is also a day-by-day view.
4. **What should I do?** Three answers, each ending with one concrete action for the chosen job:
   - when to act;
   - can you trust the trend;
   - this week compared with a normal week, from NASA's near-real-time data.

   For Punjab, a playbook ranks the districts by this week's detections and gives each one its field-check window (e.g. Fazilka: 4–6 pm covered 99% of its afternoon burning in 2025). A team planner splits the available teams across districts. The plan goes to WhatsApp in one tap, and the season goes into a phone calendar.
5. **AI Advisor.** Answers questions using only Burn Clock's data. It automatically knows the selected place, the months, the job and the local time. The server checks every number in its answer before the user sees it.

**How it works.**
- **Harmonization:** each MODIS satellite is converted to the VIIRS scale with factors fitted only on 2013–2019, before the orbit drift. Results are on a 0.25° grid, as monthly daytime active-cell counts with uncertainty ranges.
- **Two timing checks:**
  - **Has burning moved to hours the satellites miss?** The later-drifting Aqua against the fixed VIIRS satellites.
  - **Is the older MODIS record off?** Terra and Aqua against VIIRS.

  Both are compared with 2013–2019, and a change beyond twice the normal year-to-year swing counts.
- **Four verdicts:** timing matters here; the older MODIS record is off; satellite timing doesn't explain this; can't tell yet.
- **Six case studies give four different answers.** Punjab's wheat season and California come out clean, so the method does not cry wolf.
- **Live data:** NASA's 7-day FIRMS files are re-read every 6 hours by a GitHub Action.

**Benefits and intended impact.** Fire counts drive enforcement, penalties and smoke forecasts for hundreds of millions of people in North India. If burning moves out of the satellites' view, every one of these users reads progress that partly did not happen. Burn Clock lets each of them check the number for their own place, and tells them what to do this week.

**Tools.** TypeScript, React, Vite, MapLibre GL, Python (data pipeline), Node, Vercel (hosting and API), GitHub Actions (live refresh), Playwright and Vitest. An automated test gate recomputes the reference numbers and checks every page for accessibility and layout on each change.

**Honesty.** Every number on the site links to the file and the code that produced it. Known failures are published:
- conversion factors do not carry between continents;
- the Paraná Delta has about 21% held-out error;
- the hourly GK2A record covers noon–6 pm only and is preliminary.

The timing check is a diagnostic, not proof of why burning moved. NASA (Jethva 2026), ISRO's Space Applications Centre and iFOREST first reported the Punjab shift. Burn Clock makes the check possible anywhere, live, with actions.

## Use of artificial intelligence
We built the project with AI assistants: Anthropic Claude and OpenAI Codex, for code, data analysis and text. The team reviewed the results, and every number shown is produced by code in the public repository. The in-app AI Advisor uses Anthropic Claude. It can call only Burn Clock's own data tools, and the server rejects or flags any number in an answer that does not match those tools or the site's data. No AI-generated imagery is used.

## NASA data
- NASA FIRMS active fire archive: MODIS Collection 6.1 (Terra, Aqua) and VIIRS 375 m (S-NPP, NOAA-20), 2000–2025. https://firms.modaps.eosdis.nasa.gov/download/
- NASA FIRMS near-real-time 7-day feeds, including NOAA-21. https://firms.modaps.eosdis.nasa.gov/active_fire/
- NASA-led GK2A hourly fire dataset for Punjab and Haryana: Jethva et al. (2026), Zenodo 20084790, CC-BY-4.0. https://zenodo.org/records/20084790

## Space agency partner and other data
- GK2A-AMI geostationary satellite, Korea Meteorological Administration (KMA), via the dataset above.
- Natural Earth admin-0 and admin-1 boundaries (public domain). https://www.naturalearthdata.com/
- geoBoundaries district boundaries for Punjab. https://www.geoboundaries.org/

## References
- Jethva, H. et al. (2026). GK2A hourly fire observations over Punjab and Haryana. Zenodo 20084790.
- Schroeder, W. et al. (2014). The New VIIRS 375 m active fire detection data product. Remote Sensing of Environment 143.
- Giglio, L. et al. (2016). The Collection 6 MODIS active fire detection algorithm and fire products. Remote Sensing of Environment 178.
- iFOREST (2025) and ISRO Space Applications Centre (2025): reports on later burning in Punjab.
- Burn Clock methods and validation: https://burn-clock.vercel.app/#methods · https://burn-clock.vercel.app/#validation
