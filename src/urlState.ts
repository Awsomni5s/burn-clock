import {useSyncExternalStore,useMemo} from 'react';
const CHANGE='burn-clock-view';
function subscribe(fn:()=>void){window.addEventListener(CHANGE,fn);window.addEventListener('popstate',fn);window.addEventListener('hashchange',fn);return()=>{window.removeEventListener(CHANGE,fn);window.removeEventListener('popstate',fn);window.removeEventListener('hashchange',fn);};}
export function useViewURL(){return useSyncExternalStore(subscribe,()=>location.href);}
export function updateView(values:Record<string,unknown>,hash?:string,replace=false){const u=new URL(location.href);for(const [key,value] of Object.entries(values)){if(value===undefined||value===null)u.searchParams.delete(key);else u.searchParams.set(key,Array.isArray(value)?value.join(','):String(value));}if(hash)u.hash=hash;if(u.href===location.href)return;history[replace?'replaceState':'pushState'](null,'',u.href);window.dispatchEvent(new Event(CHANGE));}
export function useURLState<T>(key:string,fallback:T,parse:(raw:string)=>T|null,format:(v:T)=>string=String):[T,(v:T|((old:T)=>T))=>void]{
 const url=useViewURL(),raw=new URL(url).searchParams.get(key);
 const value=useMemo(()=>raw===null?fallback:parse(raw)??fallback,[raw,JSON.stringify(fallback)]);
 return [value,(next)=>{const current=new URL(location.href).searchParams.get(key),old=current===null?fallback:parse(current)??fallback;updateView({[key]:format(typeof next==='function'?(next as (v:T)=>T)(old):next)});}];
}
export const numeric=(min:number,max:number,step=1)=>(s:string)=>{const n=Number(s);return s.trim()&&Number.isFinite(n)&&n>=min&&n<=max&&Math.abs(n/step-Math.round(n/step))<1e-8?n:null;};
export const choice=<T extends string>(items:readonly T[])=>(s:string):T|null=>items.includes(s as T)?s as T:null;
export const bool=(s:string)=>s==='true'?true:s==='false'?false:null;
export const monthValue=(s:string)=>/^\d{4}-(0[1-9]|1[0-2])$/.test(s)&&s>='2000-11'&&s<='2025-12'?s:null;
