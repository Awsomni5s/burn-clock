import {fetchData,areaTiles,createAccumulator,computeClock} from './data';
import type {BBox,Manifest,Catalog,CalendarTile,ClockTile} from './types';
self.onmessage=async(event:MessageEvent<{box:BBox;manifest:Manifest;catalog:Catalog}>)=>{
  try{
    const {box,manifest,catalog}=event.data;
    const names=areaTiles(manifest.tiles,box),acc=createAccumulator(manifest);
    let done=0;
    const queue=[...names];
    await Promise.all(Array.from({length:Math.min(4,queue.length)},async()=>{while(queue.length){const name=queue.shift()!;const tile=await fetchData<CalendarTile>(`tiles/${name}.json`);acc.add(tile,box);done++;self.postMessage({type:'progress',done,total:names.length});}}));
    const clocks:ClockTile[]=[];
    const cq=areaTiles(catalog.clock_tiles,box);
    await Promise.all(Array.from({length:Math.min(4,cq.length)},async()=>{while(cq.length){const name=cq.shift()!;clocks.push(await fetchData<ClockTile>(`clock/${name}.json`));}}));
    self.postMessage({type:'result',result:{box,...acc.finish(),clock:computeClock(clocks,box),tileCount:names.length}});
  }catch(error){self.postMessage({type:'error',message:error instanceof Error?error.message:String(error)});}
};
