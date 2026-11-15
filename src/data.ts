import {PLATFORMS, type Platform,type BBox,type Manifest,type CalendarTile,type ClockTile,type Month,type ClockYear,type ClockTest} from './types';

export async function fetchData<T>(path:string, signal?:AbortSignal):Promise<T> {
  const url='/data/'+path+(path.endsWith('.json')?'.gz':'');
  const response=await fetch(url,{signal});
  if(!response.ok) throw new Error(`Data could not be loaded (${response.status}): ${path}`);
  if(!response.body) throw new Error('Empty data response');
  const buffer=await response.arrayBuffer();
  const bytes=new Uint8Array(buffer);
  // Hosts may decode Content-Encoding automatically. Check the actual bytes.
  if(bytes[0]===0x1f && bytes[1]===0x8b){
    const stream=new Blob([buffer]).stream().pipeThrough(new DecompressionStream('gzip'));
    return JSON.parse(await new Response(stream).text()) as T;
  }
  return JSON.parse(new TextDecoder().decode(bytes)) as T;
}
// Remove sub-display floating noise (for example, interpolated 580.9499999999999).
export const number=(n:unknown,digits=0):string=> typeof n==='number'&&Number.isFinite(n)?Number(n.toPrecision(14)).toLocaleString('en-US',{maximumFractionDigits:digits,minimumFractionDigits:digits}):'—';
export const signed=(n:unknown,digits=1):string=>typeof n==='number'&&Number.isFinite(n)?`${n>0?'+':''}${number(n,digits)}`:'—';
export function hour(h:number|null):string {if(h==null)return '—';const minutes=Math.round(h*60)%1440;return `${String(Math.floor(minutes/60)).padStart(2,'0')}:${String(minutes%60).padStart(2,'0')}`;}
export function quantile(values:number[],q:number):number|null {if(!values.length)return null;const a=[...values].sort((a,b)=>a-b);const i=(a.length-1)*q;return a[Math.floor(i)]+(a[Math.ceil(i)]-a[Math.floor(i)])*(i-Math.floor(i));}
const valid=(n:number|null|undefined):n is number=>n!=null&&Number.isFinite(n);
export function inside(lat:number,lon:number,b:BBox):boolean{return lat>=b[0]&&lat<b[2]&&(b[1]<=b[3]?(lon>=b[1]&&lon<b[3]):(lon>=b[1]||lon<b[3]));}
export function tileOrigin(name:string):[number,number]{const [a,b]=name.split('_');return [(a[0]==='m'?-1:1)*Number(a.slice(1)),(b[0]==='m'?-1:1)*Number(b.slice(1))];}
export function areaTiles(names:string[],box:BBox):string[]{return names.filter(name=>{const [lat,lon]=tileOrigin(name);return lat<box[2]&&lat+5>box[0]&&(box[1]<=box[3]?(lon<box[3]&&lon+5>box[1]):(lon+5>box[1]||lon<box[3]));});}
export function validBox(b:number[]):b is BBox{return b.length===4&&b.every(Number.isFinite)&&b[0]>=-90&&b[2]<=90&&b[0]<b[2]&&b[1]>=-180&&b[1]<=180&&b[3]>=-180&&b[3]<=180&&b[1]!==b[3];}

export function createAccumulator(manifest:Manifest){
  let cells=0;
  const rows=manifest.months.map(month=>({month,raw:Object.fromEntries(PLATFORMS.map(p=>[p,0])) as Record<Platform,number>,rawMissing:Object.fromEntries(PLATFORMS.map(p=>[p,0])) as Record<Platform,number>,harm:0,lo:0,hi:0,harmMissing:0,src:new Set<string>()}));
  function add(tile:CalendarTile,box:BBox){
    tile.cells.forEach(([lat,lon],ci)=>{
      // Tiles store SW coordinates; select by the cell center as the pipeline does.
      if(!inside(lat+.125,lon+.125,box))return;
      cells++;
      rows.forEach((r,mi)=>{
        for(const p of PLATFORMS){const v=tile.raw[p]?.[ci]?.[mi];if(valid(v))r.raw[p]+=v;else r.rawMissing[p]++;}
        const h=tile.harm[ci]?.[mi],lo=tile.harm_lo[ci]?.[mi],hi=tile.harm_hi[ci]?.[mi];
        // Supplied production precision is two decimals (pipeline/harmonize/CONFIG.yaml).
        // Sum integer hundredths so a 145.50 total cannot drift below the display tie.
        if(valid(h)&&valid(lo)&&valid(hi)){r.harm+=Math.round(h*100);r.lo+=Math.round(lo*100);r.hi+=Math.round(hi*100);}else r.harmMissing++;
        r.src.add(tile.src[ci]?.[mi]??'X');
      });
    });
  }
  function finish():{cellCount:number;months:Month[]}{
    const months:Month[]=rows.map(r=>{
      const raw=Object.fromEntries(PLATFORMS.map(p=>[p,!cells||r.rawMissing[p]>0?null:r.raw[p]])) as Record<Platform,number|null>;
      const usable=!!cells&&r.harmMissing===0;
      const mi=r.month;
      const satellites=PLATFORMS.filter(p=>{
        const period=manifest.platforms[p];if(!period||mi<period.first||mi>period.last)return false;
        const outage=manifest.outage_months.find(o=>o.platform===p&&o.month===mi);
        const days=new Date(Number(mi.slice(0,4)),Number(mi.slice(5,7)),0).getDate();
        return 1-(outage?.missing_days.length??0)/days>=.5;
      });
      const source=[...r.src].sort().join('');
      const used=source==='V'?satellites.filter(p=>['N','J1','J2'].includes(p)):source==='M'?satellites.filter(p=>['T','A'].includes(p)):[];
      return {month:r.month,raw,harm:usable?r.harm/100:null,lo:usable?r.lo/100:null,hi:usable?r.hi/100:null,src:cells?source:'X',satellites:used,anomaly:'missing',median:null,p25:null,p75:null};
    });
    for(const m of months){
      const base=months.filter(x=>x.month>='2003-01'&&x.month<='2022-12'&&x.month.slice(5)===m.month.slice(5)&&x.harm!=null).map(x=>x.harm!);
      m.median=quantile(base,.5);m.p25=quantile(base,.25);m.p75=quantile(base,.75);
      m.anomaly=m.harm==null||m.p25==null||m.p75==null?'missing':m.harm>m.p75?'above':m.harm<m.p25?'below':'normal';
    }
    return {cellCount:cells,months};
  }
  return {add,finish};
}

export function computeClock(tiles:ClockTile[],box:BBox):ClockYear[]{
  const records=tiles.flatMap(t=>t.cells.map(([lat,lon],i)=>({t,i,lat,lon}))).filter(c=>inside(c.lat+.5,c.lon+.5,box));
  const years=[...new Set(tiles.flatMap(t=>t.years))].sort((a,b)=>a-b);
  return years.map(year=>{
    const baseline=[2013,2014,2015,2016,2017,2018,2019];
    const tests:ClockTest[]=(['T','A'] as const).map(p=>{
      const support=records.filter(({t,i})=>[...baseline,year].every(y=>{const k=t.years.indexOf(y);return k>=0&&valid(t.day[p]?.[i]?.[k])&&valid(t.day.N?.[i]?.[k]);}));
      const totals=(y:number,plat:Platform)=>support.reduce((s,{t,i})=>s+(t.day[plat][i][t.years.indexOf(y)]??0),0);
      const count=totals(year,p),reference=totals(year,'N');
      const ratios=baseline.map(y=>{const P=totals(y,p),N=totals(y,'N');return P>0&&N>0?Math.log(P/N):null;}).filter(valid);
      const mean=ratios.length?ratios.reduce((a,b)=>a+b,0)/ratios.length:null;
      const sigma=mean!=null&&ratios.length===7?Math.sqrt(ratios.reduce((s,x)=>s+(x-mean)**2,0)/ratios.length):null;
      const delta=count>0&&reference>0&&mean!=null?Math.log(count/reference)-mean:null;
      const threshold=sigma!=null?Math.max(2*sigma,.15):null;
      const testable=reference>=200&&count>=50&&threshold!=null&&delta!=null;
      return {platform:p,testable,delta,sigma,threshold,count:support.length?count:null,reference:support.length?reference:null,cells:support.length,reason:!support.length?'No complete paired clock series':reference<200?'Fewer than 200 S-NPP cell-days':count<50?`Fewer than 50 ${p==='T'?'Terra':'Aqua'} cell-days`:ratios.length<7?'Incomplete pre-drift baseline':'Enough observations'};
    });
    const drivers=tests.filter(t=>t.testable&&Math.abs(t.delta!)>t.threshold!).map(t=>t.platform);
    const look={} as Record<Platform,number|null>,baselineLook={} as Record<Platform,number|null>;
    for(const p of PLATFORMS){
      look[p]=quantile(records.map(({t,i})=>t.look[p]?.[i]?.[t.years.indexOf(year)]).filter(valid),.5);
      baselineLook[p]=quantile(records.flatMap(({t,i})=>baseline.map(y=>t.look[p]?.[i]?.[t.years.indexOf(y)])).filter(valid),.5);
    }
    const common=records.filter(({t,i})=>[...baseline,year].every(y=>['T','A','N'].every(p=>valid(t.day[p as Platform]?.[i]?.[t.years.indexOf(y)]))));
    const ratio=(y:number)=>{const sum=(p:Platform)=>common.reduce((s,{t,i})=>s+(t.day[p][i][t.years.indexOf(y)]??0),0);return sum('N')>0?(sum('T')+sum('A'))/sum('N'):null;};
    const br=baseline.map(ratio).filter(valid),current=ratio(year);
    const base=br.length===7?br.reduce((a,b)=>a+b,0)/br.length:null;
    const bend=current!=null&&base!=null&&base>0?(current/base-1)*100:null;
    return {year,badge:year<2021?'not_evaluated':!tests.some(t=>t.testable)?'not_identifiable':drivers.length?'clock_sensitive':'robust',drivers,bend,tests,look,baselineLook,clockCells:records.length};
  });
}

export function csvForArea(months:Month[],clock:ClockYear[],box:BBox):string{
  const header=['month','south','west','north','east','raw_terra','raw_aqua','raw_snpp','raw_noaa20','raw_noaa21','harmonized','approx_lo','approx_hi','anomaly','baseline_median','clock_badge_annual','clock_drivers','signed_bend_pct','source_code','source_satellites','unit','interval_note'];
  const q=(v:unknown)=>{const s=v==null?'':String(v);return /[",\n]/.test(s)?`"${s.replaceAll('"','""')}"`:s;};
  return [header,...months.map(m=>{const c=clock.find(x=>x.year===Number(m.month.slice(0,4)));return [m.month,...box,...PLATFORMS.map(p=>m.raw[p]),m.harm,m.lo,m.hi,m.anomaly,m.median,c?.badge??'not_identifiable',c?.drivers.join('+')??'',c?.bend,m.src,m.satellites.join('+'),'daytime 0.05-degree active cell-days (harm: S-NPP scale)','approximate sum of cell bounds; not a calibrated AOI 90% interval'];})].map(row=>row.map(q).join(',')).join('\r\n');
}
// Source look times have two decimal places; medians can add one. Subtract
// integer millihours so an exact half-minute survives display rounding.
export function lookChangeMinutes(current:number,baseline:number):number{return (Math.round(current*1000)-Math.round(baseline*1000))*6/100;}
export function download(filename:string,content:string,type='text/csv;charset=utf-8'){const url=URL.createObjectURL(new Blob([content],{type}));const a=document.createElement('a');a.href=url;a.download=filename;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
