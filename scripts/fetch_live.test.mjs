import test from 'node:test';
import assert from 'node:assert/strict';
import {solarHour,summarizeCSV,FEEDS,fetchWithRetry,buildSnapshot,parseLine} from './fetch_live.mjs';
const presets=[{id:'sample',name:'Sample',box:[0,0,10,30]}];
const header='latitude,longitude,acq_date,acq_time,satellite,daynight';
test('CSV parsing, UTC rollover, even median and day/night distinction',()=>{
  assert.deepEqual(parseLine('"a,b","c""d"'),['a,b','c"d']);assert.equal(solarHour('2330',30),1.5);
  const r=summarizeCSV(header+'\n1,15,2026-11-14,1100,T,D\n2,15,2026-11-14,2300,Terra,N\n1,15,2026-11-14,1300,A,D',FEEDS[0],presets);
  assert.equal(r.platforms.T.presets.sample.detections,2);assert.equal(r.platforms.T.median_local_solar_hour,6);assert.equal(r.platforms.T.median_daytime_local_solar_hour,12);assert.equal(r.platforms.A.detections,1);
});
test('Header-only means no returned data; malformed responses are rejected',()=>{
  assert.equal(summarizeCSV(header,FEEDS[1],presets).rows,0);
  assert.throws(()=>summarizeCSV('<html>server error</html>',FEEDS[1],presets));
  assert.throws(()=>summarizeCSV(header+'\n,15,2026-11-14,1100,N,D',FEEDS[1],presets));
});
test('Five failed attempts use backoff and reject',async()=>{
  let n=0;const delays=[];await assert.rejects(fetchWithRetry('unused',{fetchImpl:async()=>{n++;throw Error('offline');},sleep:async n=>delays.push(n)}));
  assert.equal(n,5);assert.deepEqual(delays,[1000,2000,4000,8000]);
});
test('Feed failure retains original snapshot date/count and marks stale; first failure stays unavailable',async()=>{
  const previous={feeds:{N:{url:'old',rows:3,fetched_at:'2026-11-10T00:00:00Z',platforms:{N:{detections:3}}}}};
  const r=await buildSnapshot({presets,previous,now:'2026-11-15T00:00:00Z',fetchText:async()=>{throw Error('offline');}});
  assert.equal(r.feeds.N.rows,3);assert.equal(r.feeds.N.status,'stale');assert.equal(r.feeds.N.fetched_at,'2026-11-10T00:00:00Z');assert.equal(r.feeds.J1.rows,null);assert.equal(r.feeds.J1.status,'unavailable');assert.equal(r.archive_mixed,false);
});
