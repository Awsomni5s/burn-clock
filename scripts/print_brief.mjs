import {chromium} from 'playwright';
import {readFileSync} from 'node:fs';
const base=process.env.BURN_CLOCK_URL||'http://127.0.0.1:4173',browser=await chromium.launch({headless:true});
try{const page=await browser.newPage();await page.goto(base+'/#brief');await page.locator('.policy-brief').waitFor();await page.evaluate(()=>document.fonts.ready);await page.pdf({path:'public/docs/Burn_Clock_Policy_Brief.pdf',format:'A4',preferCSSPageSize:true,printBackground:true});const count=[...readFileSync('public/docs/Burn_Clock_Policy_Brief.pdf').toString('latin1').matchAll(/\/Type\s*\/Page\b/g)].length;if(count!==1)throw Error(`Expected one policy-brief page; got ${count}`);console.log('Policy brief: one A4 page.');}finally{await browser.close();}
