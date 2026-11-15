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
import type {FeatureCollection,Geometry} from 'geojson';
maplibregl.setWorkerUrl(mapWorkerUrl);

function polygon(box:BBox):FeatureCollection<Geometry>{const [s,w,n,e]=box;const parts=w>e?[[s,w,n,180],[s,-180,n,e]]:[box];return {type:'FeatureCollection',features:parts.map(([s,w,n,e])=>({type:'Feature',properties:{},geometry:{type:'Polygon',coordinates:[[[w,s],[e,s],[e,n],[w,n],[w,s]]]}}))};}
export default function AreaMap({box,name,onBox,manifest,initialYear=2025}:{box:BBox;name:string;onBox:(b:BBox)=>void;manifest?:Manifest;initialYear?:number}){
  const container=useRef<HTMLDivElement>(null),map=useRef<maplibregl.Map|null>(null),callback=useRef(onBox),currentBox=useRef(box);
  const drawing=useRef(false),start=useRef<[number,number]|null>(null),hoverTimer=useRef<ReturnType<typeof setTimeout>|null>(null),hoverAbort=useRef<AbortController|null>(null);
  const [draw,setDraw]=useState(false),[first,setFirst]=useState(false),[ready,setReady]=useState(false),[error,setError]=useState(''),[layerLoading,setLayerLoading]=useState(true);
  const [year,setYear]=useState(Math.max(2001,Math.min(2025,initialYear))),[meta,setMeta]=useState<ContourMeta|null>(null),[dataManifest,setDataManifest]=useState<Manifest|undefined>(manifest);
  const [pointText,setPointText]=useState('Hover over the map for an original, unsmoothed annual cell value.'),[pointStatus,setPointStatus]=useState('');
  const [latitude,setLatitude]=useState(String((box[0]+box[2])/2)),[longitude,setLongitude]=useState(String((box[1]+box[3])/2));
  const tileCache=useRef(new Map<string,CalendarTile>()),inspectRef=useRef<(lat:number,lon:number,announce?:boolean)=>void>(()=>{});
  callback.current=onBox;currentBox.current=box;
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
      m.addSource('aoi',{type:'geojson',data:polygon(currentBox.current)});
      m.addLayer({id:'aoi-line',type:'line',source:'aoi',paint:{'line-color':'#273b32','line-width':2,'line-dasharray':[3,2]}});
      m.getCanvas().setAttribute('aria-label','Map: arrow keys pan; plus and minus zoom. Use coordinate inspection below for values.');fit(currentBox.current);setReady(true);
    });
    const norm=(lon:number)=>((lon+180)%360+360)%360-180;
    m.on('click',e=>{
      if(!drawing.current){inspectRef.current(e.lngLat.lat,e.lngLat.lng,true);return;}
      const pt:[number,number]=[Math.max(-90,Math.min(90,e.lngLat.lat)),norm(e.lngLat.lng)];
      if(!start.current){start.current=pt;setFirst(true);return;}
      const b:BBox=[Math.min(start.current[0],pt[0]),Math.min(start.current[1],pt[1]),Math.max(start.current[0],pt[0]),Math.max(start.current[1],pt[1])];
      if(validBox(b)){callback.current(b);drawing.current=false;setDraw(false);setFirst(false);start.current=null;m.getCanvas().style.cursor='';}
    });
    m.on('mousemove',e=>{
      if(hoverTimer.current)clearTimeout(hoverTimer.current);
      if(drawing.current){if(!start.current)return;const p=start.current;const b:BBox=[Math.min(p[0],e.lngLat.lat),Math.min(p[1],norm(e.lngLat.lng)),Math.max(p[0],e.lngLat.lat),Math.max(p[1],norm(e.lngLat.lng))];(m.getSource('aoi') as GeoJSONSource)?.setData(polygon(b));return;}
      hoverTimer.current=setTimeout(()=>inspectRef.current(e.lngLat.lat,e.lngLat.lng),300);
    });
    const resize=new ResizeObserver(()=>m.resize());resize.observe(container.current);
    return()=>{if(hoverTimer.current)clearTimeout(hoverTimer.current);hoverAbort.current?.abort();resize.disconnect();m.remove();map.current=null;};
  },[]);
  useEffect(()=>{if(!ready)return;(map.current?.getSource('aoi') as GeoJSONSource)?.setData(polygon(box));fit(box);},[box,ready]);
  useEffect(()=>{
    if(!ready||!meta)return;const abort=new AbortController();setLayerLoading(true);setError('');setPointText('Hover over the map for an original, unsmoothed annual cell value.');setPointStatus('');hoverAbort.current?.abort();
    (map.current?.getSource('activity-contours') as GeoJSONSource)?.setData(EMPTY_CONTOURS);
    fetchData<FeatureCollection>(`contours/world_${year}.geojson.gz`,abort.signal).then(data=>{if(abort.signal.aborted)return;(map.current?.getSource('activity-contours') as GeoJSONSource)?.setData(data);setLayerLoading(false);}).catch(e=>{if(e.name!=='AbortError'){setLayerLoading(false);setError(`The ${year} contour layer is unavailable. Area selection still works.`);}});
    return()=>abort.abort();
  },[year,ready,meta]);
  const toggleDraw=()=>{drawing.current=!drawing.current;setDraw(drawing.current);setFirst(false);start.current=null;if(map.current)map.current.getCanvas().style.cursor=drawing.current?'crosshair':'';if(!drawing.current)(map.current?.getSource('aoi') as GeoJSONSource)?.setData(polygon(box));};
  return <section className="contour-map-section" aria-label={`Fire activity map for ${name}`}>
    <div className="contour-year-controls"><label>Map year <input aria-label="World map year" type="range" min={meta?.world.years[0]??2001} max={meta?.world.years.at(-1)??2025} step="1" value={year} onChange={e=>setYear(Number(e.target.value))}/><output>{year}</output></label></div>
    <div className="area-map"><div ref={container} className="map-canvas"/>
      <div className="map-toolbar"><div className="map-tools"><button className={draw?'map-btn active':'map-btn'} aria-pressed={draw} onClick={toggleDraw}>{draw?'Cancel drawing':'Draw area'}</button><button className="map-btn" onClick={()=>map.current?.jumpTo({center:[20,15],zoom:1.2})}>Show world</button><button className="map-btn" onClick={()=>fit(box)}>Fit area</button><button className="map-btn" onClick={()=>map.current?.zoomIn({duration:0})}>Zoom in</button><button className="map-btn" onClick={()=>map.current?.zoomOut({duration:0})}>Zoom out</button></div></div>
      {draw&&<div className="draw-hint" role="status">{first?'Choose the opposite corner.':'Choose the first corner.'} Use the page’s area coordinate fields for keyboard selection.</div>}
      {(!ready||layerLoading)&&!error&&<div className="map-loading" role="status">Loading {year} fire activity…</div>}{error&&<div className="map-error" role="status">{error}</div>}
    </div>
    {meta?<ContourLegend series={meta.world} palette={meta.palette}/>:<div className="contour-legend" role="status">Loading fixed contour legend. Smoothed for display; blank means no fire nearby or no data.</div>}
    <div className="contour-inspector"><p data-testid="original-cell-value">{pointText}</p><details><summary>Inspect an original cell by coordinates</summary><form className="contour-point-form" onSubmit={e=>{e.preventDefault();const lat=Number(latitude),lon=Number(longitude);if(latitude.trim()===''||longitude.trim()===''||!Number.isFinite(lat)||!Number.isFinite(lon)||lat< -90||lat>90||lon< -180||lon>180){setPointStatus('Enter latitude −90 to 90 and longitude −180 to 180.');return;}inspectRef.current(lat,lon,true);}}><label>Latitude<input type="number" min="-90" max="90" step="any" value={latitude} onChange={e=>setLatitude(e.target.value)} required/></label><label>Longitude<input type="number" min="-180" max="180" step="any" value={longitude} onChange={e=>setLongitude(e.target.value)} required/></label><button type="submit">Inspect point</button><p role="status">{pointStatus}</p></form></details></div>
  </section>;
}
