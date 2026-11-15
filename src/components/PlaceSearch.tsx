import {useEffect,useState} from 'react';
import type {BBox} from '../types';
type Place={name:string;kind:string;box:BBox};
export default function PlaceSearch({onSelect}:{onSelect:(box:BBox)=>void}){
 const [query,setQuery]=useState(''),[places,setPlaces]=useState<Place[]>([]),[error,setError]=useState('');
 useEffect(()=>{fetch('/maps/search.json').then(r=>{if(!r.ok)throw Error();return r.json();}).then(d=>setPlaces(d.places)).catch(()=>setError('Place search is unavailable. Choose a preset or enter coordinates.'));},[]);
 const results=query.trim().length>1?places.filter(p=>p.name.toLocaleLowerCase().includes(query.toLocaleLowerCase())).slice(0,12):[];
 return <div className="place-search"><label htmlFor="place-search">Search for a country or state</label><input id="place-search" type="search" value={query} placeholder="For example: California, Punjab or Brazil" onChange={e=>setQuery(e.target.value)}/>{results.length>0&&<ul aria-label="Matching places">{results.map(p=><li key={p.name}><button onClick={()=>{onSelect(p.box);setQuery('');}}>{p.name} <small>{p.kind}</small></button></li>)}</ul>}{query.length>1&&!results.length&&<p role="status">{error||'No matching place in the local map index. Try a country, preset or coordinates.'}</p>}<small>Search selects a rectangular area, not an administrative boundary.</small></div>;
}
