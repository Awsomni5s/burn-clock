import {number} from './data';
import {receiptFacts,type ReceiptData} from './insights';
export interface ClaimCard {title:string;context:string;lines:string[];source:string;url:string}
export function punjabCard(data:ReceiptData,url:string):ClaimCard {
 const f=receiptFacts(data);
 return {title:'Punjab: fewer reported counts; a later afternoon pattern',context:'2025 versus 2021 · observations are not unique fires or emissions',lines:[
  `Reported fire counts fell ${number(f.officialDecline)}%: ${number(data.claim_source.value_2021)} to ${number(data.claim_source.value_2025)}. Mixed MODIS + VIIRS; 15 Sep–30 Nov.`,
  `GK2A unique pixel-days fell ${number(f.afternoonDecline)}% across 12–18 IST. Punjab, Oct–Nov; confidence ≥2; unmasked.`,
  `Baseline matters: 2021 is the peak year in this supplied GK2A series. 2025 is ${number(f.versus2019,2)}× 2019 by the same unmasked unique pixel-day measure.`,
  `At 17:00 IST, GK2A pixel-hours in 2025 were ${number(f.at17,2)}× 2021. Punjab, Oct–Nov; confidence ≥2; unmasked.`,
  `${number(f.late2025)}% of 2025 GK2A afternoon pixel-hours occurred at 16–18 IST, versus ${number(f.late2021)}% in 2021. Denominator: 12–18 IST; confidence ≥2; unmasked.`,
  'These observations support a decline alongside a later daily pattern. Different units and windows cannot yield a corrected true fire count. GK2A can detect hot smoke and miss small fires.'
 ],source:'Sources: supplied punjab_receipt.json · NASA FIRMS · CAQM/PIB · Jethva GK2A, CC BY 4.0',url};
}
const escape=(s:string)=>s.replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;');
function wrap(s:string,max=88){const lines:string[]=[];let line='';for(const word of s.split(/\s+/)){if((line+' '+word).trim().length>max&&line){lines.push(line);line=word}else line=(line+' '+word).trim();}if(line)lines.push(line);return lines;}
export function claimSVG(card:ClaimCard):string {
 let y=58;const items:string[]=[];
 const text=(s:string,size:number,color:string,max:number)=>{for(const line of wrap(s,max)){items.push(`<text x="48" y="${y}" fill="${color}" font-family="Arial, sans-serif" font-size="${size}">${escape(line)}</text>`);y+=size*1.45;}};
 text('BURN CLOCK · OBSERVATION RECEIPT',16,'#a55335',95);y+=12;text(card.title,28,'#26363c',67);y+=10;text(card.context,19,'#4d6069',92);y+=28;
 for(const line of card.lines){text(line,22,'#26363c',86);y+=25;}
 text(card.source,16,'#4d6069',115);y+=10;text(card.url,14,'#4d6069',125);
 return `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="${Math.ceil(y+30)}" role="img" aria-label="${escape(card.title)}"><title>${escape(card.title)}</title><desc>${escape(card.lines.join(' '))}</desc><rect width="100%" height="100%" fill="#fffaf4"/><rect width="8" height="100%" fill="#b65c3b"/>${items.join('')}</svg>`;
}
export async function saveClaimCard(card:ClaimCard,filename:string){
 const url=URL.createObjectURL(new Blob([claimSVG(card)],{type:'image/svg+xml;charset=utf-8'}));
 try{
  const image=new Image();await new Promise<void>((resolve,reject)=>{image.onload=()=>resolve();image.onerror=()=>reject(Error('Could not render the claim card.'));image.src=url;});
  const canvas=document.createElement('canvas');canvas.width=image.width;canvas.height=image.height;const ctx=canvas.getContext('2d');if(!ctx)throw Error('Image export is unavailable in this browser.');ctx.drawImage(image,0,0);
  const blob=await new Promise<Blob>((resolve,reject)=>canvas.toBlob(b=>b?resolve(b):reject(Error('Image export failed.')),'image/png'));
  const download=URL.createObjectURL(blob),a=document.createElement('a');a.href=download;a.download=filename+'.png';a.click();setTimeout(()=>URL.revokeObjectURL(download),1000);
 }finally{URL.revokeObjectURL(url);}
}
