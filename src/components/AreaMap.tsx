import {useEffect,useRef,useState} from 'react';
import * as maplibregl from 'maplibre-gl';
import type {GeoJSONSource} from 'maplibre-gl';
import mapWorkerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?url';
import 'maplibre-gl/dist/maplibre-gl.css';
import {Crosshair,Globe2,MousePointer2,SquareDashed,LoaderCircle} from 'lucide-react';
import type {BBox} from '../types';
import {fetchData,validBox} from '../data';
import type {FeatureCollection,Geometry} from 'geojson';
maplibregl.setWorkerUrl(mapWorkerUrl);

function polygon(box:BBox):FeatureCollection<Geometry>{const [s,w,n,e]=box;const parts=w>e?[[s,w,n,180],[s,-180,n,e]]:[box];return {type:'FeatureCollection',features:parts.map(([s,w,n,e])=>({type:'Feature',properties:{},geometry:{type:'Polygon',coordinates:[[[w,s],[e,s],[e,n],[w,n],[w,s]]]}}))};}
export default function AreaMap({box,name,onBox}:{box:BBox;name:string;onBox:(b:BBox)=>void}){
  const container=useRef<HTMLDivElement>(null),map=useRef<maplibregl.Map|null>(null),callback=useRef(onBox),currentBox=useRef(box);
  const drawing=useRef(false),start=useRef<[number,number]|null>(null);
  const [draw,setDraw]=useState(false),[first,setFirst]=useState(false),[ready,setReady]=useState(false),[error,setError]=useState('');
  callback.current=onBox;currentBox.current=box;
  const fit=(b:BBox,duration=800)=>map.current?.fitBounds([[b[1],Math.max(-84,Math.min(83.5,b[0]))],[b[3]<b[1]?b[3]+360:b[3],Math.max(-83.5,Math.min(84,b[2]))]],{padding:72,maxZoom:6,duration});
  useEffect(()=>{
    if(!container.current)return;
    let cancelled=false;
    let m:maplibregl.Map;
    try{
      m=new maplibregl.Map({container:container.current,center:[75.7,30],zoom:4,attributionControl:false,style:{version:8,glyphs:'/maps/fonts/{fontstack}/{range}.pbf',sources:{
        land:{type:'geojson',data:'/maps/countries.geojson',attribution:'Natural Earth · public domain'},
        provinces:{type:'geojson',data:'/maps/provinces.geojson'},
        countrylabels:{type:'geojson',data:'/maps/labels.geojson'},
        places:{type:'geojson',data:'/maps/places.geojson'}
      },layers:[
        {id:'background',type:'background',paint:{'background-color':'#19282e'}},
        {id:'land',type:'fill',source:'land',paint:{'fill-color':'#303b3b'}},
        {id:'provinces',type:'line',source:'provinces',minzoom:3,paint:{'line-color':'#4b5550','line-width':.55,'line-opacity':.6}},
        {id:'borders',type:'line',source:'land',paint:{'line-color':'#657169','line-width':.8,'line-opacity':.7}},
        {id:'country-labels',type:'symbol',source:'countrylabels',maxzoom:5,layout:{'text-field':['get','name'],'text-font':['Open Sans Semibold'],'text-size':10,'text-letter-spacing':.15,'text-max-width':10},paint:{'text-color':'#a7b1a5','text-opacity':.6}},
        {id:'city-points',type:'circle',source:'places',minzoom:4,filter:['>=',['get','pop'],300000],paint:{'circle-radius':1.8,'circle-color':'#a2aaa1','circle-opacity':.5}},
        {id:'city-labels',type:'symbol',source:'places',minzoom:4,filter:['>=',['get','pop'],300000],layout:{'text-field':['get','name'],'text-font':['Open Sans Semibold'],'text-size':10,'text-offset':[0,1.1],'text-anchor':'top'},paint:{'text-color':'#a9b0a9','text-halo-color':'#303b3b','text-halo-width':1}}
      ]}});
      map.current=m;
    }catch{setError('The interactive map needs WebGL. Choose a preset or enter coordinates below.');return;}
    m.addControl(new maplibregl.NavigationControl({showCompass:false}),'top-right');
    m.addControl(new maplibregl.AttributionControl({compact:true}),'bottom-right');
    m.on('load',()=>{
      m.addSource('aoi',{type:'geojson',data:polygon(currentBox.current)});
      m.addLayer({id:'aoi-fill',type:'fill',source:'aoi',paint:{'fill-color':'#fb9d5c','fill-opacity':.12}});
      m.addLayer({id:'aoi-line',type:'line',source:'aoi',paint:{'line-color':'#f7a66c','line-width':2,'line-dasharray':[3,2]}});
      fit(currentBox.current,0);setReady(true);
      fetchData<FeatureCollection>('activity.geojson.gz').then(data=>{
        if(cancelled)return;
        m.addSource('activity',{type:'geojson',data});
        m.addLayer({id:'activity-glow',type:'circle',source:'activity',paint:{'circle-color':'#e78a48','circle-radius':['interpolate',['linear'],['get','n'],0,1,50,3,500,7,3000,12],'circle-opacity':.12,'circle-blur':.7}},'aoi-line');
        m.addLayer({id:'activity-dots',type:'circle',source:'activity',paint:{'circle-color':'#f8ad65','circle-radius':['interpolate',['linear'],['get','n'],0,.6,50,1.2,500,2.6,3000,4.5],'circle-opacity':['interpolate',['linear'],['get','n'],0,.2,100,.6,1000,.95]}},'aoi-line');
      }).catch(()=>setError('Activity overlay unavailable. Area selection still works.'));
    });
    const norm=(lon:number)=>((lon+180)%360+360)%360-180;
    m.on('click',e=>{
      if(!drawing.current)return;
      const pt:[number,number]=[Math.max(-90,Math.min(90,e.lngLat.lat)),norm(e.lngLat.lng)];
      if(!start.current){start.current=pt;setFirst(true);return;}
      const b:BBox=[Math.min(start.current[0],pt[0]),Math.min(start.current[1],pt[1]),Math.max(start.current[0],pt[0]),Math.max(start.current[1],pt[1])];
      if(validBox(b)){callback.current(b);drawing.current=false;setDraw(false);setFirst(false);start.current=null;m.getCanvas().style.cursor='';}
    });
    m.on('mousemove',e=>{if(!drawing.current||!start.current)return;const p=start.current;const b:BBox=[Math.min(p[0],e.lngLat.lat),Math.min(p[1],norm(e.lngLat.lng)),Math.max(p[0],e.lngLat.lat),Math.max(p[1],norm(e.lngLat.lng))];(m.getSource('aoi') as GeoJSONSource)?.setData(polygon(b));});
    const resize=new ResizeObserver(()=>m.resize());resize.observe(container.current);
    return()=>{cancelled=true;resize.disconnect();m.remove();map.current=null;};
  },[]);
  useEffect(()=>{if(!ready)return;(map.current?.getSource('aoi') as GeoJSONSource)?.setData(polygon(box));fit(box);},[box,ready]);
  const toggleDraw=()=>{drawing.current=!drawing.current;setDraw(drawing.current);setFirst(false);start.current=null;if(map.current)map.current.getCanvas().style.cursor=drawing.current?'crosshair':'';if(!drawing.current)(map.current?.getSource('aoi') as GeoJSONSource)?.setData(polygon(box));};
  return <div className="area-map">
    <div ref={container} className="map-canvas" aria-label={`Map of ${name}. Use Draw area to select two corners.`}/>
    <div className="map-toolbar"><span className="map-live"><span/> SATELLITE VIEW</span><div className="map-tools"><button className={draw?'map-btn active':'map-btn'} onClick={toggleDraw}><SquareDashed size={14}/>{draw?'Cancel':'Draw area'}</button><button className="map-btn icon-only" aria-label="Show world" title="Show world" onClick={()=>map.current?.flyTo({center:[20,15],zoom:1.2})}><Globe2 size={15}/></button><button className="map-btn icon-only" aria-label="Fit selected area" title="Fit selected area" onClick={()=>fit(box)}><Crosshair size={15}/></button></div></div>
    {draw&&<div className="draw-hint"><MousePointer2 size={14}/>{first?'Choose the opposite corner':'Choose the first corner'}</div>}
    {!ready&&!error&&<div className="map-loading"><LoaderCircle className="spin"/> Preparing the map</div>}
    {error&&<div className="map-error" role="status">{error}</div>}
    <div className="map-caption"><span className="map-dot"/> S-NPP · 2025 fire-season cell-days <span className="map-caption-sub">1° grid · brighter = more activity</span></div>
  </div>;
}
