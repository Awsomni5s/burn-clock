import {useEffect,useRef,useState} from 'react';
import {assembleRelease,validateRelease,type Release,type ReleaseManifest} from '../releases';
import styles from './Releases.module.css';
const size=(bytes:number)=>`${(bytes/1024/1024).toLocaleString('en-US',{maximumFractionDigits:1})} MiB`;
export default function Releases(){
 const [manifest,setManifest]=useState<ReleaseManifest|null>(null),[error,setError]=useState(''),[reload,setReload]=useState(0),[active,setActive]=useState<string|null>(null),[progress,setProgress]=useState(0),[status,setStatus]=useState('');
 const controller=useRef<AbortController|null>(null);
 useEffect(()=>{const request=new AbortController();setError('');fetch('/data/releases.json',{signal:request.signal}).then(r=>{if(!r.ok)throw Error('Release information could not be loaded.');return r.json();}).then((data:ReleaseManifest)=>{if(data.schema_version!==1||!Array.isArray(data.releases)||!data.releases.length)throw Error('Release information is invalid.');data.releases.forEach(validateRelease);setManifest(data);}).catch(e=>{if(e.name!=='AbortError')setError(e.message);});return()=>request.abort();},[reload]);
 useEffect(()=>()=>controller.current?.abort(),[]);
 const download=async(release:Release)=>{
  const request=new AbortController();controller.current=request;setActive(release.id);setProgress(0);setError('');setStatus(`Downloading ${release.label.toLowerCase()}…`);
  try{
   const blob=await assembleRelease(release,{signal:request.signal,onProgress:(done,phase)=>{setProgress(done);setStatus(phase==='verifying'?'Checking the complete archive checksum…':`Verified ${size(done)} of ${size(release.bytes)}.`);}});
   const url=URL.createObjectURL(blob),anchor=document.createElement('a');anchor.href=url;anchor.download=release.filename;anchor.click();setTimeout(()=>URL.revokeObjectURL(url),60000);
   setStatus(`${release.filename} verified and saved.`);
  }catch(e){if(request.signal.aborted)setStatus('Download cancelled. No file was saved.');else{setError(e instanceof Error?e.message:'Download failed. Retry the archive.');setStatus('No file was saved.');}}
  finally{if(controller.current===request){controller.current=null;setActive(null);}}
 };
 return <section className={styles.releases} aria-labelledby="release-title"><h2 id="release-title">Download the full supplied data and source</h2><p>Original release archives, with their original filenames and verified SHA-256 checksums. Files download only when you choose one. Large archives are fetched in parts, checked and joined in your browser.</p>
  {error&&<p role="alert">{error} {!manifest&&<button type="button" onClick={()=>setReload(v=>v+1)}>Retry release information</button>}</p>}
  {!manifest&&!error&&<p role="status">Loading release information…</p>}
  {manifest&&<><ul>{manifest.releases.map(release=><li key={release.id}><h3>{release.label}</h3><p><span data-testid={`release-size-${release.id}`} data-source={`releases.json → releases[id=${release.id}].bytes`}>{size(release.bytes)} ({release.bytes.toLocaleString('en-US')} bytes)</span></p><p className={styles.filename}>{release.filename}</p><button type="button" disabled={active!==null} onClick={()=>download(release)}>Download {release.label.toLowerCase()}</button>{active===release.id&&<div className={styles.progress}><progress value={progress} max={release.bytes} aria-label={`${release.label} verified download progress`}/><button type="button" onClick={()=>controller.current?.abort()}>Cancel download</button></div>}<details><summary>SHA-256 and individual parts</summary><p className={styles.checksum} data-testid={`release-sha-${release.id}`} data-source={`releases.json → releases[id=${release.id}].sha256`}>{release.sha256}</p><p>{release.origin}</p><ol>{release.parts.map((part,i)=><li key={part.path}><a href={part.path} download>Part {i+1}</a> — {size(part.bytes)}<code className={styles.checksum}>{part.sha256}</code></li>)}</ol></details></li>)}</ul><p><a href="/data/releases.json" download>Download the checksum manifest</a></p></>}
  <p role="status" aria-live="polite">{status}</p><p>The browser checks each part and the complete file before saving. It may temporarily need about twice the selected file’s size in memory. These source archives are downloads; opening this page does not run their contents.</p>
 </section>;
}
