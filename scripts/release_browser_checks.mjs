import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
const base=process.env.BURN_CLOCK_URL||'http://127.0.0.1:4173',manifest=JSON.parse(readFileSync('public/data/releases.json','utf8')),releases=[];
const browser=await chromium.launch({headless:true});
try{const page=await browser.newPage({acceptDownloads:true});await page.goto(base+'/#methods');await page.getByRole('heading',{name:'Download the full supplied data and source'}).waitFor();mkdirSync('tmp/release-downloads',{recursive:true});
 for(const release of manifest.releases){
  const event=page.waitForEvent('download',{timeout:120000});await page.getByRole('button',{name:'Download '+release.label.toLowerCase(),exact:true}).click();const download=await event;assert.equal(download.suggestedFilename(),release.filename);const file='tmp/release-downloads/'+release.filename;await download.saveAs(file);const bytes=readFileSync(file),sha=createHash('sha256').update(bytes).digest('hex');assert.equal(bytes.length,release.bytes);assert.equal(sha,release.sha256);releases.push({filename:release.filename,bytes:bytes.length,sha256:sha,parts:release.parts.length});console.log('Verified original archive',release.filename,bytes.length);
 }
 writeFileSync('release-checks.json',JSON.stringify({status:'passed',generatedAt:new Date().toISOString(),base,releases,scope:'Actual browser downloads reconstructed by the application from served parts, then independently SHA-256 checked. Upstream pipeline reproducibility is not established.'},null,2)+'\n');
}finally{await browser.close()}
