export interface ReleasePart {path:string;bytes:number;sha256:string}
export interface Release {id:string;label:string;filename:string;bytes:number;sha256:string;origin:string;parts:ReleasePart[]}
export interface ReleaseManifest {schema_version:number;prepared_at:string;note:string;releases:Release[]}
const hashPattern=/^[a-f0-9]{64}$/;
export function validateRelease(release:Release):void {
 if(!release||!Number.isSafeInteger(release.bytes)||release.bytes<=0||!hashPattern.test(release.sha256)||!Array.isArray(release.parts)||!release.parts.length)throw Error('The release manifest is invalid.');
 if(!/^[a-zA-Z0-9_.-]+\.tar\.gz$/.test(release.filename))throw Error('The release filename is invalid.');
 if(new Set(release.parts.map(p=>p.path)).size!==release.parts.length)throw Error('The manifest repeats a part.');
 let bytes=0;
 for(const p of release.parts){
  if(!/^\/releases\/parts\/[a-zA-Z0-9_.-]+\.part\d+$/.test(p.path)||!Number.isSafeInteger(p.bytes)||p.bytes<=0||!hashPattern.test(p.sha256))throw Error('A release part is invalid.');
  bytes+=p.bytes;
 }
 if(bytes!==release.bytes)throw Error('Release part sizes do not match the complete archive.');
}
export async function sha256(bytes:ArrayBuffer):Promise<string>{
 const hash=await crypto.subtle.digest('SHA-256',bytes);return [...new Uint8Array(hash)].map(v=>v.toString(16).padStart(2,'0')).join('');
}
export async function assembleRelease(release:Release,{signal,fetchPart=fetch,onProgress=()=>{}}:{signal:AbortSignal;fetchPart?:typeof fetch;onProgress?:(verifiedBytes:number,phase:'fetching'|'verifying')=>void}):Promise<Blob>{
 validateRelease(release);signal.throwIfAborted();
 // One final-sized allocation plus one fetched part bounds memory while verifying.
 const complete=new Uint8Array(release.bytes);let offset=0;
 for(const part of release.parts){
  signal.throwIfAborted();const response=await fetchPart(part.path,{signal});
  if(!response.ok)throw Error(`Download failed (HTTP ${response.status}). Retry the archive.`);
  const bytes=await response.arrayBuffer();signal.throwIfAborted();
  if(bytes.byteLength!==part.bytes||await sha256(bytes)!==part.sha256)throw Error('A downloaded part failed its checksum. Retry the archive; no file was saved.');
  signal.throwIfAborted();complete.set(new Uint8Array(bytes),offset);offset+=bytes.byteLength;onProgress(offset,'fetching');
 }
 onProgress(offset,'verifying');
 if(await sha256(complete.buffer)!==release.sha256)throw Error('The complete archive failed its checksum. No file was saved.');
 signal.throwIfAborted();return new Blob([complete],{type:'application/gzip'});
}
