import {useEffect,useRef,useState} from 'react';
import * as maplibregl from 'maplibre-gl';
import type {GeoJSONSource} from 'maplibre-gl';
import mapWorkerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?url';
import type {FeatureCollection} from 'geojson';
import 'maplibre-gl/dist/maplibre-gl.css';
import '../contours.css';
import {fetchData,number} from '../data';
import {EMPTY_CONTOURS,lightContourStyle,receiptHourRatio,type ContourMeta} from '../contours';
import ContourLegend from './ContourLegend';
maplibregl.setWorkerUrl(mapWorkerUrl);

function FireMap({file,year,label}:{file:string;year:number;label:string}){
  const container=useRef<HTMLDivElement>(null),map=useRef<maplibregl.Map|null>(null);
  const [ready,setReady]=useState(false),[status,setStatus]=useState('Loading map…');
  useEffect(()=>{
    if(!container.current)return;
    let m:maplibregl.Map;
    try{m=new maplibregl.Map({container:container.current,interactive:false,attributionControl:false,style:lightContourStyle(),center:[75.7,30.1],zoom:5});map.current=m;}
    catch{setStatus('WebGL is unavailable. Use the numerical comparison below.');return;}
    const fit=()=>m.fitBounds([[73.8,27.6],[77.6,32.6]],{padding:8,duration:0});
    m.on('load',()=>{m.addSource('fire',{type:'geojson',data:EMPTY_CONTOURS});m.addLayer({id:'fire',type:'fill',source:'fire',paint:{'fill-color':['get','color'],'fill-opacity':1}},'provinces');m.getCanvas().tabIndex=-1;m.getCanvas().setAttribute('aria-hidden','true');fit();setReady(true);});
    const resize=new ResizeObserver(()=>{m.resize();fit();});resize.observe(container.current);
    return()=>{resize.disconnect();m.remove();map.current=null;};
  },[]);
  useEffect(()=>{
    if(!ready)return;const abort=new AbortController();setStatus(`Loading ${year}…`);(map.current?.getSource('fire') as GeoJSONSource)?.setData(EMPTY_CONTOURS);
    fetchData<FeatureCollection>(`contours/${file}.geojson.gz`,abort.signal).then(data=>{if(abort.signal.aborted)return;(map.current?.getSource('fire') as GeoJSONSource)?.setData(data);setStatus('');}).catch(e=>{if(e.name!=='AbortError')setStatus('This map could not be loaded. Change the year or hour to retry.');});
    return()=>abort.abort();
  },[file,year,ready]);
  return <figure className="burning-mini" aria-label={`${label}, ${year}. Fixed view of Punjab and Haryana; smoothed contours.`}><figcaption>{year}</figcaption><div ref={container} className="burning-mini-canvas"/>{status&&<div className="burning-mini-status" role="status">{status}</div>}</figure>;
}

export default function BurningTimePanel({data}:{data:Record<string,any>}){
  const container=useRef<HTMLElement>(null);
  const [visible,setVisible]=useState(false),[meta,setMeta]=useState<ContourMeta|null>(null),[base,setBase]=useState(2021),[hour,setHour]=useState(17),[error,setError]=useState('');
  useEffect(()=>{if(!container.current)return;if(!('IntersectionObserver' in window)){setVisible(true);return;}const observer=new IntersectionObserver(entries=>{if(entries.some(e=>e.isIntersecting)){setVisible(true);observer.disconnect();}},{rootMargin:'250px'});observer.observe(container.current);return()=>observer.disconnect();},[]);
  useEffect(()=>{if(!visible)return;const abort=new AbortController();fetch('/data/contours/contours_meta.json',{signal:abort.signal}).then(r=>{if(!r.ok)throw Error('Metadata unavailable');return r.json();}).then(setMeta).catch(e=>{if(e.name!=='AbortError')setError('The map metadata could not be loaded. The Punjab receipt remains available below.');});return()=>abort.abort();},[visible]);
  const ratio=receiptHourRatio(data,base,hour),hours=meta?.punjab_gk2a.hours_ist??data.gk2a_by_hour?.hours??[];
  return <section ref={container} className="burning-panel" aria-labelledby="burning-panel-title">
    <div className="burning-panel-heading"><h2 id="burning-panel-title">When do they burn?</h2><p>Compare the same area and satellite across two years. The lower maps move together through the afternoon.</p></div>
    {meta&&visible?<>
      <div className="burning-controls"><label>Compare 2025 with <select aria-label="Burning maps base year" value={base} onChange={e=>setBase(Number(e.target.value))}>{[2019,2021,2023].filter(y=>meta.punjab_gk2a.years.includes(y)&&meta.punjab_viirs.years.includes(y)).map(y=><option key={y} value={y}>{y}</option>)}</select></label></div>
      <h3>What the ~1:40 pm satellite saw</h3><div className="burning-pair"><FireMap file={`punjab_viirs_${base}`} year={base} label="S-NPP VIIRS"/><FireMap file="punjab_viirs_2025" year={2025} label="S-NPP VIIRS"/></div>
      <ContourLegend series={meta.punjab_viirs} palette={meta.palette}/>
      <h3>What a satellite watching every hour saw</h3><div className="burning-controls"><label>India time <input type="range" aria-label="GK2A map hour in India time" min={hours[0]} max={hours.at(-1)} step="1" value={hour} onChange={e=>setHour(Number(e.target.value))}/><output>{hour}:00 IST</output></label></div>
      <div className="burning-pair"><FireMap file={`punjab_gk2a_${base}_${hour}`} year={base} label={`GK2A at ${hour}:00 IST`}/><FireMap file={`punjab_gk2a_2025_${hour}`} year={2025} label={`GK2A at ${hour}:00 IST`}/></div>
      <p className="burning-hour-caption" data-testid="burning-hour-ratio" role="status">{ratio==null?`The supplied receipt has no ${hour}:00 numerical ratio for 2025 versus ${base}. Compare the maps; no aggregate ratio is inferred from contour colours.`:`At ${hour}:00 IST, 2025 had ${number(ratio,2)}× the 2021 fire pixel-hours in Punjab.`}</p>
      <ContourLegend series={meta.punjab_gk2a} palette={meta.palette} hour={hour}/>
      <div className="burning-map-notes"><p><strong>Compare years within each row, not colours between rows.</strong> Top and bottom use different satellites and units. Both rows show Punjab and Haryana; the numerical hourly caption uses the receipt’s Punjab-only counts. The view and colour levels stay fixed. GK2A coverage: {meta.punjab_gk2a.coverage}.</p><p>GK2A is preliminary, uses coarse pixels and can flag hot smoke. The {hours.at(-1)}:00 result is near sunset and uses different thresholds. The maps do not establish why burning moved later or measure total smoke.</p><p>Source: supplied <a href="/data/contours/contours_meta.json">contour metadata</a>; <a href="/data/punjab_receipt.json.gz" download>Punjab receipt</a> → gk2a_by_hour. GK2A: {meta.punjab_gk2a.source}. Basemap: Natural Earth, public domain.</p></div>
    </>:<div className="burning-deferred" role="status">{error||'The four comparison maps load when this panel comes into view.'}</div>}
  </section>;
}
