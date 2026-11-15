import {Evidence} from './Provenance';
import GisDownload from './GisDownload';
import {useURLState,numeric} from '../urlState';
import {useEffect,useRef,useState} from 'react';
import * as maplibregl from 'maplibre-gl';
import type {GeoJSONSource} from 'maplibre-gl';
import mapWorkerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?url';
import 'maplibre-gl/dist/maplibre-gl.css';
import '../contours.css';
import type {BBox,Manifest,CalendarTile} from '../types';
import {fetchData,validBox,number} from '../data';
import {annualPoint,calendarPoint,EMPTY_CONTOURS,lightContourStyle,type ContourMeta} from '../contours';
import ContourLegend from './ContourLegend';
import {circlePolys,encodeCircle,encodePoly,encodeProvince,geometryPolys,inPolys,shapeBox,simplify,type Polys} from '../shape';
import type {FeatureCollection,Geometry} from 'geojson';
maplibregl.setWorkerUrl(mapWorkerUrl);

function polygon(box:BBox):FeatureCollection<Geometry>{const [s,w,n,e]=box;const parts=w>e?[[s,w,n,180],[s,-180,n,e]]:[box];return {type:'FeatureCollection',features:parts.map(([s,w,n,e])=>({type:'Feature',properties:{},geometry:{type:'Polygon',coordinates:[[[w,s],[e,s],[e,n],[w,n],[w,s]]]}}))};}
function polysFC(polys:Polys):FeatureCollection<Geometry>{return {type:'FeatureCollection',features:polys.map(p=>({type:'Feature',properties:{},geometry:{type:'Polygon',coordinates:p}}))};}
type Mode='rect'|'circle'|'free'|'province';
const MODES:[Mode,string,string][]=[['rect','Rectangle','Click two opposite corners.'],['circle','Circle','Click the centre, then click again to set the radius.'],['free','Draw by hand','Press and drag around the area, then let go.'],['province','Province','Click any state or province.']];
const km=(a:number[],b:number[])=>{const R=6371,t=Math.PI/180,dl=(b[1]-a[1])*t,dp=(b[0]-a[0])*t,x=Math.sin(dp/2)**2+Math.cos(a[0]*t)*Math.cos(b[0]*t)*Math.sin(dl/2)**2;return 2*R*Math.asin(Math.sqrt(x));};
export default function AreaMap({box,name,onBox,onShape,polys,manifest,initialYear=2025}:{box:BBox;name:string;onBox:(b:BBox)=>void;onShape?:(b:BBox,shape:string,label:string)=>void;polys?:Polys|null;manifest?:Manifest;initialYear?:number}){
  const container=useRef<HTMLDivElement>(null),map=useRef<maplibregl.Map|null>(null),callback=useRef(onBox),currentBox=useRef(box);
  const modeRef=useRef<Mode>('rect'),[mode,setModeState]=useState<Mode>('rect'),path=useRef<number[][]|null>(null),shapeCb=useRef(onShape),currentPolys=useRef(polys),countries=useRef<any>(null),[provStatus,setProvStatus]=useState('');
  const drawing=useRef(false),start=useRef<[number,number]|null>(null),hoverTimer=useRef<ReturnType<typeof setTimeout>|null>(null),hoverAbort=useRef<AbortController|null>(null);
  const [draw,setDraw]=useState(false),[first,setFirst]=useState(false),[ready,setReady]=useState(false),[error,setError]=useState(''),[layerLoading,setLayerLoading]=useState(true);
  const [year,setYear]=useURLState('mapYear',Math.max(2001,Math.min(2025,initialYear)),numeric(2001,2025)),[meta,setMeta]=useState<ContourMeta|null>(null),[dataManifest,setDataManifest]=useState<Manifest|undefined>(manifest);
  const [pointText,setPointText]=useState('Hover over the map for an original, unsmoothed annual cell value.'),[pointStatus,setPointStatus]=useState('');
  const [latitude,setLatitude]=useState(String((box[0]+box[2])/2)),[longitude,setLongitude]=useState(String((box[1]+box[3])/2));
  const tileCache=useRef(new Map<string,CalendarTile>()),inspectRef=useRef<(lat:number,lon:number,announce?:boolean)=>void>(()=>{});
  callback.current=onBox;currentBox.current=box;shapeCb.current=onShape;currentPolys.current=polys;
  const aoiData=()=>currentPolys.current?polysFC(currentPolys.current):polygon(currentBox.current);
  const finish=()=>{drawing.current=false;setDraw(false);setFirst(false);start.current=null;path.current=null;if(map.current){map.current.getCanvas().style.cursor='';map.current.dragPan.enable();}};
  const pickProvince=async(lat:number,lon:number)=>{try{setProvStatus('Finding the province…');if(!countries.current)countries.current=await fetch('/maps/countries.geojson').then(r=>r.json());const c=countries.current.features.find((f:any)=>inPolys(lat,lon,geometryPolys(f.geometry)));if(!c){setProvStatus('No country there. Click on land.');return;}const a3=c.properties.ADM0_A3,fc=await fetch(`/maps/adm1/${a3}.json`).then(r=>{if(!r.ok)throw Error();return r.json();});const f=fc.features.find((x:any)=>inPolys(lat,lon,geometryPolys(x.geometry)));if(!f){setProvStatus('No province found at that point. Try clicking inside its border.');return;}const ps=geometryPolys(f.geometry);setProvStatus('');finish();shapeCb.current?.(shapeBox(ps),encodeProvince(a3,f.properties.id),`${f.properties.name}, ${f.properties.country}`);}catch{setProvStatus('Province boundaries could not be loaded.');}};
  const fit=(b:BBox,duration=0)=>map.current?.fitBounds([[b[1],Math.max(-84,Math.min(83.5,b[0]))],[b[3]<b[1]?b[3]+360:b[3],Math.max(-83.5,Math.min(84,b[2]))]],{padding:{top:95,bottom:25,left:30,right:30},maxZoom:6,duration});
  useEffect(()=>{const abort=new AbortController();fetch('/data/contours/contours_meta.json',{signal:abort.signal}).then(r=>{if(!r.ok)throw Error('Metadata unavailable');return r.json();}).then(setMeta).catch(e=>{if(e.name!=='AbortError')setError('Map legend could not be loaded. Please reload.');});if(manifest)setDataManifest(manifest);else fetchData<Manifest>('manifest.json',abort.signal).then(setDataManifest).catch(()=>{});return()=>abort.abort();},[manifest]);
  inspectRef.current=async(lat,lon,announce=false)=>{
    hoverAbort.current?.abort();const abort=new AbortController();hoverAbort.current=abort;
    if(!dataManifest){setPointText('The original cell index is still loading.');return;}
    const point=calendarPoint(lat,lon),prefix=`${year} · cell latitude ${point.lat.toFixed(2)}° to ${(point.lat+.25).toFixed(2)}°, longitude ${point.lon.toFixed(2)}° to ${(point.lon+.25).toFixed(2)}°`;
    const show=(text:string)=>{setPointText(text);if(announce)setPointStatus(text);};
    if(!dataManifest.tiles.includes(point.tile)){show(`${prefix}: no stored cell. No fire nearby or no data; this is not a zero.`);return;}
    show(`${prefix}: loading original cell…`);
    try{
      let tile=tileCache.current.get(point.tile);
      if(!tile){tile=await fetchData<CalendarTile>(`tiles/${point.tile}.json`,abort.signal);if(abort.signal.aborted)return;tileCache.current.set(point.tile,tile);if(tileCache.current.size>2)tileCache.current.delete(tileCache.current.keys().next().value!);}
      const result=annualPoint(tile,dataManifest,point.lat,point.lon,year);
      const details=result.value==null?result.status==='absent'?'No stored cell: no activity or no data; this is not a zero.':`Annual value unavailable (${result.months} of 12 months available); missing is not zero.`:`${number(result.value,2)} ${meta?.world.unit??'harmonized fire-days per year per 0.25° cell'}. ${result.source}.`;
      show(`${prefix}: ${details} Original unsmoothed data: tiles/${point.tile}.json.`);
    }catch(e){if((e as Error).name!=='AbortError')show('The original cell could not be loaded. Move over the map or inspect the point again to retry.');}
  };
  useEffect(()=>{
    if(!container.current)return;
    let m:maplibregl.Map;
    try{m=new maplibregl.Map({container:container.current,center:[75.7,30],zoom:4,attributionControl:false,style:lightContourStyle()});map.current=m;}
    catch{setError('The map needs WebGL. Choose a preset, search for a place or enter coordinates instead.');return;}
    m.addControl(new maplibregl.AttributionControl({compact:false}),'bottom-right');
    m.on('load',()=>{
      m.addSource('activity-contours',{type:'geojson',data:EMPTY_CONTOURS});
      m.addLayer({id:'activity-contours',type:'fill',source:'activity-contours',paint:{'fill-color':['get','color'],'fill-opacity':1}},'provinces');
      m.addSource('aoi',{type:'geojson',data:aoiData()});
      m.addLayer({id:'aoi-fill',type:'fill',source:'aoi',paint:{'fill-color':'#273b32','fill-opacity':0.08}});
      m.addLayer({id:'aoi-line',type:'line',source:'aoi',paint:{'line-color':'#273b32','line-width':2,'line-dasharray':[3,2]}});
      m.getCanvas().setAttribute('aria-label','Map: arrow keys pan; plus and minus zoom. Use coordinate inspection below for values.');fit(currentBox.current);setReady(true);
    });
    const norm=(lon:number)=>((lon+180)%360+360)%360-180;
    m.on('click',e=>{
      if(!drawing.current){inspectRef.current(e.lngLat.lat,e.lngLat.lng,true);return;}
      const pt:[number,number]=[Math.max(-90,Math.min(90,e.lngLat.lat)),norm(e.lngLat.lng)];
      if(modeRef.current==='province'){pickProvince(pt[0],pt[1]);return;}
      if(modeRef.current==='free')return;
      if(modeRef.current==='circle'){if(!start.current){start.current=pt;setFirst(true);return;}const r=Math.max(5,Math.min(2000,km(start.current,pt))),ps=circlePolys(start.current[0],start.current[1],r);const c=start.current;finish();shapeCb.current?.(shapeBox(ps),encodeCircle(c[0],c[1],r),`Circle, ${Math.round(r)} km around ${c[0].toFixed(2)}°, ${c[1].toFixed(2)}°`);return;}
      if(!start.current){start.current=pt;setFirst(true);return;}
      const b:BBox=[Math.min(start.current[0],pt[0]),Math.min(start.current[1],pt[1]),Math.max(start.current[0],pt[0]),Math.max(start.current[1],pt[1])];
      if(validBox(b)){callback.current(b);drawing.current=false;setDraw(false);setFirst(false);start.current=null;m.getCanvas().style.cursor='';}
    });
    m.on('mousemove',e=>{
      if(hoverTimer.current)clearTimeout(hoverTimer.current);
      if(drawing.current&&modeRef.current==='circle'){if(!start.current)return;(m.getSource('aoi') as GeoJSONSource)?.setData(polysFC(circlePolys(start.current[0],start.current[1],Math.max(5,Math.min(2000,km(start.current,[e.lngLat.lat,norm(e.lngLat.lng)]))))));return;}
      if(drawing.current&&modeRef.current==='free'){if(!path.current)return;const last=path.current[path.current.length-1],pt=[norm(e.lngLat.lng),e.lngLat.lat];if(Math.hypot(pt[0]-last[0],pt[1]-last[1])>0.002*Math.pow(2,7-m.getZoom())){path.current.push(pt);(m.getSource('aoi') as GeoJSONSource)?.setData({type:'FeatureCollection',features:[{type:'Feature',properties:{},geometry:{type:'LineString',coordinates:path.current}}]});}return;}
      if(drawing.current&&modeRef.current==='province')return;
      if(drawing.current){if(!start.current)return;const p=start.current;const b:BBox=[Math.min(p[0],e.lngLat.lat),Math.min(p[1],norm(e.lngLat.lng)),Math.max(p[0],e.lngLat.lat),Math.max(p[1],norm(e.lngLat.lng))];(m.getSource('aoi') as GeoJSONSource)?.setData(polygon(b));return;}
      hoverTimer.current=setTimeout(()=>inspectRef.current(e.lngLat.lat,e.lngLat.lng),300);
    });
    const down=(e:maplibregl.MapMouseEvent|maplibregl.MapTouchEvent)=>{if(!drawing.current||modeRef.current!=='free')return;e.preventDefault();m.dragPan.disable();path.current=[[norm(e.lngLat.lng),e.lngLat.lat]];};
    const up=()=>{if(!drawing.current||modeRef.current!=='free'||!path.current)return;const pts=path.current;if(pts.length<4){path.current=null;m.dragPan.enable();return;}const ring=simplify(pts);if(ring.length<3){path.current=null;m.dragPan.enable();return;}const ps:Polys=[[[...ring,ring[0]]]];finish();shapeCb.current?.(shapeBox(ps),encodePoly(ring),'Hand-drawn area');};
    m.on('mousedown',down);m.on('touchstart',down);m.on('mouseup',up);m.on('touchend',up);
    m.on('touchmove',e=>{if(drawing.current&&modeRef.current==='free'&&path.current){path.current.push([norm(e.lngLat.lng),e.lngLat.lat]);(m.getSource('aoi') as GeoJSONSource)?.setData({type:'FeatureCollection',features:[{type:'Feature',properties:{},geometry:{type:'LineString',coordinates:path.current}}]});}});
    const resize=new ResizeObserver(()=>m.resize());resize.observe(container.current);
    return()=>{if(hoverTimer.current)clearTimeout(hoverTimer.current);hoverAbort.current?.abort();resize.disconnect();m.remove();map.current=null;};
  },[]);
  useEffect(()=>{if(!ready)return;(map.current?.getSource('aoi') as GeoJSONSource)?.setData(aoiData());fit(box);},[box,ready,polys]);
  useEffect(()=>{
    if(!ready||!meta)return;const abort=new AbortController();setLayerLoading(true);setError('');setPointText('Hover over the map for an original, unsmoothed annual cell value.');setPointStatus('');hoverAbort.current?.abort();
    (map.current?.getSource('activity-contours') as GeoJSONSource)?.setData(EMPTY_CONTOURS);
    fetchData<FeatureCollection>(`contours/world_${year}.geojson.gz`,abort.signal).then(data=>{if(abort.signal.aborted)return;(map.current?.getSource('activity-contours') as GeoJSONSource)?.setData(data);setLayerLoading(false);}).catch(e=>{if(e.name!=='AbortError'){setLayerLoading(false);setError(`The ${year} contour layer is unavailable. Area selection still works.`);}});
    return()=>abort.abort();
  },[year,ready,meta]);
  const startMode=(md:Mode)=>{modeRef.current=md;setModeState(md);setProvStatus('');path.current=null;start.current=null;setFirst(false);const on=!(drawing.current&&mode===md);drawing.current=on;setDraw(on);if(map.current){map.current.getCanvas().style.cursor=on?(md==='province'?'pointer':'crosshair'):'';if(on&&md==='free')map.current.dragPan.disable();else map.current.dragPan.enable();if(!on){map.current.dragPan.enable();(map.current.getSource('aoi') as GeoJSONSource)?.setData(aoiData());}}};
  const toggleDraw=()=>startMode('rect');
  return <section className="contour-map-section" aria-label={`Fire activity map for ${name}`}>
    <GisDownload file={`world_${year}`} label={`${year} world level curves`}/><div className="contour-year-controls"><label>Map year <input aria-label="World map year" type="range" min={meta?.world.years[0]??2001} max={meta?.world.years.at(-1)??2025} step="1" value={year} onChange={e=>setYear(Number(e.target.value))}/><output>{year}</output></label></div>
    <div className="shape-tools" role="group" aria-label="Choose the area by"><span className="shape-label">Choose the area by:</span>{MODES.filter(([md])=>md==='rect'||onShape).map(([md,label])=><button key={md} className={draw&&mode===md?'map-btn active':'map-btn'} aria-pressed={draw&&mode===md} onClick={()=>startMode(md)} data-testid={'shape-'+md}>{draw&&mode===md?'Cancel':label}</button>)}</div>
    <div className="area-map"><div ref={container} className="map-canvas"/>
      <div className="map-toolbar"><div className="map-tools"><button className="map-btn" onClick={()=>map.current?.jumpTo({center:[20,15],zoom:1.2})}>Show world</button><button className="map-btn" onClick={()=>fit(box)}>Fit area</button><button className="map-btn" onClick={()=>map.current?.zoomIn({duration:0})}>Zoom in</button><button className="map-btn" onClick={()=>map.current?.zoomOut({duration:0})}>Zoom out</button></div></div>
      {draw&&<div className="draw-hint" role="status">{mode==='rect'?(first?'Choose the opposite corner.':'Choose the first corner.'):mode==='circle'?(first?'Move to set the radius, then click.':'Click the centre of the circle.'):MODES.find(x=>x[0]===mode)![2]} {provStatus} Use the page’s area coordinate fields for keyboard selection.</div>}
      {(!ready||layerLoading)&&!error&&<div className="map-loading" role="status">Loading {year} fire activity…</div>}{error&&<div className="map-error" role="status">{error}</div>}
    </div>
    {meta?<ContourLegend series={meta.world} palette={meta.palette}/>:<div className="contour-legend" role="status">Loading fixed contour legend. Smoothed for display; blank means no fire nearby or no data.</div>}
    <div className="contour-inspector"><p data-testid="original-cell-value"><Evidence value={pointText} expression={`annualPoint; sum of harm for ${year}`} source="tiles/*.json → harm; exact cell/tile identified in readout" producer="src/contours.ts"/></p><details><summary>Inspect an original cell by coordinates</summary><form className="contour-point-form" onSubmit={e=>{e.preventDefault();const lat=Number(latitude),lon=Number(longitude);if(latitude.trim()===''||longitude.trim()===''||!Number.isFinite(lat)||!Number.isFinite(lon)||lat< -90||lat>90||lon< -180||lon>180){setPointStatus('Enter latitude −90 to 90 and longitude −180 to 180.');return;}inspectRef.current(lat,lon,true);}}><label>Latitude<input type="number" min="-90" max="90" step="any" value={latitude} onChange={e=>setLatitude(e.target.value)} required/></label><label>Longitude<input type="number" min="-180" max="180" step="any" value={longitude} onChange={e=>setLongitude(e.target.value)} required/></label><button type="submit">Inspect point</button><p role="status">{pointStatus}</p></form></details></div>
  </section>;
}
