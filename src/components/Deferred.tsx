import {useEffect,useRef,useState,type ReactNode} from 'react';
export default function Deferred({children,label}:{children:ReactNode;label:string}){
 const ref=useRef<HTMLDivElement>(null),[show,setShow]=useState(false);
 useEffect(()=>{if(!ref.current)return;const o=new IntersectionObserver(es=>{if(es.some(e=>e.isIntersecting)){setShow(true);o.disconnect();}},{rootMargin:'100px'});o.observe(ref.current);return()=>o.disconnect();},[]);
 return <div ref={ref} className="deferred">{show?children:<button className="button secondary" onClick={()=>setShow(true)}>Load {label}</button>}</div>;
}
