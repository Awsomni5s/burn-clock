/** Area shapes beyond rectangles: circles, hand-drawn outlines, provinces (Natural Earth admin-1) and countries.
 * URL form (param `shape`): c:lat,lon,km · p:lon,lat;lon,lat;… · a:<country A3>:<province id> · n:<country A3>
 * Polygons are [lon,lat] rings, GeoJSON order; a shape is a list of polygons, each [outer, ...holes]. */
import type {BBox} from './types';
export type Polys=number[][][][];

export function circlePolys(lat:number,lon:number,km:number,n=72):Polys{
  const ring:number[][]=[];const dLat=km/111.32,dLon=km/(111.32*Math.max(0.05,Math.cos(lat*Math.PI/180)));
  for(let i=0;i<=n;i++){const t=2*Math.PI*i/n;ring.push([+(lon+dLon*Math.cos(t)).toFixed(4),+(lat+dLat*Math.sin(t)).toFixed(4)]);}
  return [[ring]];
}
/** Ramer–Douglas–Peucker in degrees, then capped at `max` points so the URL stays short. */
export function simplify(points:number[][],tol=0.01,max=160):number[][]{
  const rdp=(pts:number[][],t:number):number[][]=>{if(pts.length<3)return pts;const [a,b]=[pts[0],pts[pts.length-1]];let idx=0,dmax=0;
    for(let i=1;i<pts.length-1;i++){const p=pts[i],dx=b[0]-a[0],dy=b[1]-a[1],len=Math.hypot(dx,dy),d=len<1e-12?Math.hypot(p[0]-a[0],p[1]-a[1]):Math.abs(dy*p[0]-dx*p[1]+b[0]*a[1]-b[1]*a[0])/len;if(d>dmax){dmax=d;idx=i;}}
    return dmax>t?[...rdp(pts.slice(0,idx+1),t).slice(0,-1),...rdp(pts.slice(idx),t)]:[a,b];};
  let out=rdp(points,tol),t=tol;while(out.length>max){t*=1.6;out=rdp(points,t);}return out;
}
export function encodeCircle(lat:number,lon:number,km:number){return `c:${lat.toFixed(3)},${lon.toFixed(3)},${Math.round(km)}`;}
export function encodePoly(ring:number[][]){const r=ring.map(p=>`${p[0].toFixed(3)},${p[1].toFixed(3)}`);return 'p:'+r.join(';');}
export function encodeProvince(a3:string,id:string){return `a:${a3}:${id}`;}

export type ShapeSpec={kind:'circle';lat:number;lon:number;km:number}|{kind:'poly';ring:number[][]}|{kind:'province';a3:string;id:string}|{kind:'country';a3:string};
export function parseShape(s:string):ShapeSpec|null{
  if(!s)return null;
  if(s.startsWith('c:')){const [lat,lon,km]=s.slice(2).split(',').map(Number);return [lat,lon,km].every(Number.isFinite)&&Math.abs(lat)<=90&&Math.abs(lon)<=180&&km>=5&&km<=2000?{kind:'circle',lat,lon,km}:null;}
  if(s.startsWith('p:')){const ring=s.slice(2).split(';').map(p=>p.split(',').map(Number));return ring.length>=3&&ring.length<=400&&ring.every(p=>p.length===2&&p.every(Number.isFinite)&&Math.abs(p[0])<=180&&Math.abs(p[1])<=90)?{kind:'poly',ring}:null;}
  if(s.startsWith('n:')){const a3=s.slice(2);return /^[A-Z0-9-]{3}$/.test(a3)?{kind:'country',a3}:null;}
  if(s.startsWith('a:')){const [a3,...id]=s.slice(2).split(':');return /^[A-Z0-9-]{3}$/.test(a3)&&id.join(':')?{kind:'province',a3,id:id.join(':')}:null;}
  return null;
}
export function geometryPolys(g:{type:string;coordinates:any}):Polys{return g.type==='Polygon'?[g.coordinates]:g.type==='MultiPolygon'?g.coordinates:[];}
export function shapeBox(polys:Polys):BBox{
  let s=90,w=180,n=-90,e=-180;for(const poly of polys)for(const [x,y] of poly[0]){s=Math.min(s,y);n=Math.max(n,y);w=Math.min(w,x);e=Math.max(e,x);}
  return [+s.toFixed(3),+w.toFixed(3),+n.toFixed(3),+e.toFixed(3)];
}
function inRing(x:number,y:number,r:number[][]){let ins=false;for(let i=0,j=r.length-1;i<r.length;j=i++){const [xi,yi]=r[i],[xj,yj]=r[j];if((yi>y)!==(yj>y)&&x<(xj-xi)*(y-yi)/(yj-yi)+xi)ins=!ins;}return ins;}
export function inPolys(lat:number,lon:number,polys:Polys){for(const p of polys)if(inRing(lon,lat,p[0])&&!p.slice(1).some(h=>inRing(lon,lat,h)))return true;return false;}
/** Resolve a URL shape into polygons + label (provinces are fetched from /maps/adm1/<A3>.json). */
export async function resolveShape(spec:ShapeSpec,fetcher:(url:string)=>Promise<any>=u=>fetch(u).then(r=>{if(!r.ok)throw Error('Province boundaries could not be loaded.');return r.json();})):Promise<{polys:Polys;label:string}>{
  if(spec.kind==='circle')return {polys:circlePolys(spec.lat,spec.lon,spec.km),label:`Circle, ${spec.km} km around ${spec.lat.toFixed(2)}°, ${spec.lon.toFixed(2)}°`};
  if(spec.kind==='poly')return {polys:[[[...spec.ring,spec.ring[0]]]],label:'Hand-drawn area'};
  if(spec.kind==='country'){const cf=await fetcher('/maps/countries.geojson'),c=cf.features.find((x:any)=>x.properties.ADM0_A3===spec.a3);if(!c)throw Error('That country was not found.');return {polys:geometryPolys(c.geometry),label:c.properties.ADMIN};}
  const fc=await fetcher(`/maps/adm1/${spec.a3}.json`),f=fc.features.find((x:any)=>x.properties.id===spec.id);
  if(!f)throw Error('That province was not found.');
  return {polys:geometryPolys(f.geometry),label:`${f.properties.name}, ${f.properties.country}`};
}
