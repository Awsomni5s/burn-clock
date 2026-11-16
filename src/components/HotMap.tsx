import {useEffect,useRef,useState} from 'react';
import * as maplibregl from 'maplibre-gl';
import mapWorkerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?url';
import 'maplibre-gl/dist/maplibre-gl.css';
import type {FeatureCollection,Geometry} from 'geojson';
import type {BBox} from '../types';
import type {Polys} from '../shape';
import {lightContourStyle} from '../contours';
maplibregl.setWorkerUrl(mapWorkerUrl);

export type Hot={lat:number;lon:number;n:number};

/** This week's busiest 0.25° squares on a real basemap (countries, provinces, cities), with the area outlined.
 * Numbered pins match the table; a pin that would cover a higher-ranked one stays hidden until you zoom in.
 * Click a square or pin for its count; `focus` (from the table) flies to a square. Falls back to a plain SVG without WebGL. */
export default function HotMap({box,hot,bin,name,focus,unit='fire detection',period='this week',outline=null}:{box:BBox;hot:Hot[];bin:number;name:string;focus?:{i:number;t:number}|null;unit?:string;period?:string;outline?:Polys|null}){
  const el=useRef<HTMLDivElement>(null),map=useRef<maplibregl.Map|null>(null),popup=useRef<maplibregl.Popup|null>(null);
  const [noGL,setNoGL]=useState(false),[ready,setReady]=useState(false);
  const show=(i:number)=>{const m=map.current,h=hot[i];if(!m||!h)return;
    popup.current?.remove();
    const d=document.createElement('div');d.className='pb-pop';
    const t=document.createElement('strong');const n=Math.round(h.n);t.textContent=`#${i+1}: ${n} ${unit}${n===1?'':'s'} ${period}`;
    const c=document.createElement('span');c.textContent=`Square centred on ${h.lat.toFixed(2)}°, ${h.lon.toFixed(2)}° (0.25°, about 28 km)`;
    const a=document.createElement('a');a.href=`https://www.google.com/maps/@${h.lat},${h.lon},11z`;a.target='_blank';a.rel='noopener noreferrer';a.textContent='Open in Google Maps';
    d.append(t,c,a);popup.current=new maplibregl.Popup({closeButton:true,maxWidth:'260px',offset:12}).setLngLat([h.lon,h.lat]).setDOMContent(d).addTo(m);};
  useEffect(()=>{
    if(!el.current)return;
    let m:maplibregl.Map;
    const pad=Math.max(0.15,0.04*Math.max(box[2]-box[0],box[3]-box[1]));
    try{m=new maplibregl.Map({container:el.current,style:lightContourStyle(),bounds:[[box[1]-pad,box[0]-pad],[box[3]+pad,box[2]+pad]],fitBoundsOptions:{padding:16},attributionControl:false,cooperativeGestures:true,dragRotate:false,pitchWithRotate:false,maxZoom:11});}
    catch{setNoGL(true);return;}
    map.current=m;m.touchZoomRotate.disableRotation();m.keyboard.disableRotation();
    m.addControl(new maplibregl.NavigationControl({showCompass:false}),'top-right');
    m.addControl(new maplibregl.AttributionControl({compact:true}),'bottom-right');
    const max=Math.max(1,...hot.map(h=>h.n)),h2=bin/2;
    const pts:FeatureCollection<Geometry>={type:'FeatureCollection',features:hot.map((h,i)=>({type:'Feature',properties:{i,rank:i+1,n:h.n,w:Math.sqrt(h.n/max),top:i<8},geometry:{type:'Point',coordinates:[h.lon,h.lat]}}))};
    const sq:FeatureCollection<Geometry>={type:'FeatureCollection',features:hot.map((h,i)=>({type:'Feature',properties:{i,w:Math.sqrt(h.n/max)},geometry:{type:'Polygon',coordinates:[[[h.lon-h2,h.lat-h2],[h.lon+h2,h.lat-h2],[h.lon+h2,h.lat+h2],[h.lon-h2,h.lat+h2],[h.lon-h2,h.lat-h2]]]}}))};
    const [s,w,n,e]=box,aoi:FeatureCollection<Geometry>={type:'FeatureCollection',features:outline&&outline.length?outline.map(p=>({type:'Feature' as const,properties:{},geometry:{type:'Polygon' as const,coordinates:p}})):[{type:'Feature',properties:{},geometry:{type:'Polygon',coordinates:[[[w,s],[e,s],[e,n],[w,n],[w,s]]]}}]};
    m.on('load',()=>{
      // A round black pin with a white ring, drawn once at 2× for sharp numbers.
      const R=22,c=document.createElement('canvas');c.width=c.height=R*2;const x=c.getContext('2d');
      if(x){x.beginPath();x.arc(R,R,R-3,0,Math.PI*2);x.fillStyle='#0b0c0c';x.fill();x.lineWidth=3;x.strokeStyle='#ffffff';x.stroke();m.addImage('pb-pin',x.getImageData(0,0,R*2,R*2),{pixelRatio:2});}
      m.addSource('pb-aoi',{type:'geojson',data:aoi});
      m.addLayer({id:'pb-aoi-line',type:'line',source:'pb-aoi',paint:{'line-color':'#273b32','line-width':1.5,'line-dasharray':[3,2]}});
      m.addSource('pb-sq',{type:'geojson',data:sq});
      m.addLayer({id:'pb-sq',type:'fill',source:'pb-sq',minzoom:6.5,paint:{'fill-color':'#b33a0b','fill-opacity':['+',0.2,['*',0.6,['get','w']]],'fill-outline-color':'#7a2606'}});
      m.addSource('pb-pts',{type:'geojson',data:pts});
      m.addLayer({id:'pb-dot',type:'circle',source:'pb-pts',maxzoom:6.5,paint:{'circle-radius':['interpolate',['linear'],['zoom'],3,['+',2,['*',6,['get','w']]],6.5,['+',4,['*',10,['get','w']]]],'circle-color':'#b33a0b','circle-opacity':0.5,'circle-stroke-color':'#8a2c07','circle-stroke-width':1}});
      m.addLayer({id:'pb-pins',type:'symbol',source:'pb-pts',filter:['==',['get','top'],true],layout:{'icon-image':'pb-pin','icon-size':1,'text-field':['to-string',['get','rank']],'text-font':['Open Sans Semibold'],'text-size':12,'symbol-sort-key':['get','rank'],'icon-allow-overlap':false,'text-allow-overlap':false,'icon-padding':1},paint:{'text-color':'#ffffff'}});
      for(const id of ['pb-pins','pb-dot','pb-sq']){
        m.on('click',id,ev=>{const f=ev.features?.[0];if(f)show(Number(f.properties?.i));});
        m.on('mouseenter',id,()=>{m.getCanvas().style.cursor='pointer';});m.on('mouseleave',id,()=>{m.getCanvas().style.cursor='';});
      }
      m.getCanvas().setAttribute('aria-label',`Map of the busiest fire squares in ${name}, ${period}. Plus and minus buttons zoom; click a square for its count.`);
      setReady(true);
    });
    return()=>{popup.current?.remove();m.remove();map.current=null;setReady(false);};
  },[box,hot,bin,name,unit,period,outline]);
  useEffect(()=>{if(!focus||!ready||!map.current)return;const h=hot[focus.i];if(!h)return;map.current.flyTo({center:[h.lon,h.lat],zoom:Math.max(map.current.getZoom(),8.5),duration:700});show(focus.i);},[focus,ready]);
  if(noGL)return <SvgHotMap box={box} hot={hot}/>;
  return <div className="pb-livemap" ref={el} data-testid="pb-livemap" data-ready={ready?'1':'0'}/>;
}

/** Without WebGL: the same squares, padded so edge squares are not cut off, with the area outlined. */
function SvgHotMap({box,hot}:{box:BBox;hot:Hot[]}){
  const pad=Math.max(0.15,0.04*Math.max(box[2]-box[0],box[3]-box[1])),[s,wl,n,e]=[box[0]-pad,box[1]-pad,box[2]+pad,box[3]+pad],W=320,H=260;
  const k=Math.min(W/(e-wl),H/(n-s)),ox=(W-(e-wl)*k)/2,oy=(H-(n-s)*k)/2,P=(lon:number,lat:number)=>[ox+(lon-wl)*k,oy+(n-lat)*k];
  const max=Math.max(1,...hot.map(h=>h.n)),[ax,ay]=P(box[1],box[2]),[bx,by]=P(box[3],box[0]);
  return <svg className="pb-map" viewBox={`0 0 ${W} ${H}`} role="img" aria-label="This week’s busiest squares inside the area"><rect x="0" y="0" width={W} height={H} fill="#f8f8f6"/>
    <rect x={ax} y={ay} width={bx-ax} height={by-ay} fill="none" stroke="#273b32" strokeDasharray="4 3"/>
    {hot.map((h,i)=>{const [x,y]=P(h.lon,h.lat);return <circle key={i} cx={x} cy={y} r={3+9*Math.sqrt(h.n/max)} fill="rgba(179,58,11,.5)"><title>{`#${i+1}: ${h.n} detections`}</title></circle>;})}
    {hot.slice(0,8).map((h,i)=>({h,i})).reverse().map(({h,i})=>{const [x,y]=P(h.lon,h.lat);return <g key={'p'+i}><circle cx={x} cy={y} r="7" fill="#0b0c0c" stroke="#fff" strokeWidth="1.2"/><text x={x} y={y+3} textAnchor="middle" fontSize="9" fontWeight="700" fill="#fff">{i+1}</text></g>;})}
  </svg>;
}
