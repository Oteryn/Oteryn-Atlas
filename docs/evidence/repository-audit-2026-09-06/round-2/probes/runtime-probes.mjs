// Read-only behavioural audit of hash-verified upstream modules. Synthetic inputs, no network.
import fs from 'node:fs';
import crypto from 'node:crypto';
import {SemanticRangeStore, safeRelativePath, parseFullWorldViewState, serializeFullWorldViewState, loadRuntimeWorld, rootedContentId, RUNTIME_WORLD_DOMAIN, RUNTIME_WORLD_PROFILE, loadFullWorldPublication, PUBLICATION_DOMAIN, PUBLICATION_PROFILE} from '../sources/src/browser/fullworld.mjs';
import {VerifiedContentCache} from '../sources/src/browser/verified-content-cache.mjs';
import {canonicalJsonBytes, sha256ContentId, sha256HexPortable, loadManifest, computeRootContentId} from '../sources/src/browser/loader.mjs';
import {decodeCompactTile, parseViewState, serializeViewState, PROOF_BOUNDS, PROOF_PROFILE, SOURCE_ARTIFACT} from '../sources/src/browser/semantic.mjs';
import {compareCreatureAnchors, analyzeGeometryEventLog} from '../sources/e2e/support/geometry-oracle.mjs';
const results=[];
async function probe(id, expected, fn){
  try{const value=await fn();results.push({id,expected,...value});}
  catch(e){results.push({id,expected,probeError:e.stack});}
}
const verdict=(condition,details)=>({satisfied:condition,details});
const digest=x=>'sha256:'+crypto.createHash('sha256').update(x).digest('hex');
const world={regionSpan:256,visualBounds:{maxWidthUnits:32,maxHeightUnits:32,minDxUnits:0,maxDxUnits:0,minDyUnits:0,maxDyUnits:0,overscanTiles:{left:0,right:0,top:0,bottom:0}},floors:[{floor:-7,bounds:{x_min:0,x_max_exclusive:10,y_min:0,y_max_exclusive:10}}]};
const raw={record_type:'tile',position:{x:1,y:1,floor:-7},source_position:{legacy_x:1,legacy_y:1,legacy_z:7},tile_record_id:'tile:synthetic-audit',presentation:[]};
const bytes=canonicalJsonBytes(raw);
const chunk={path:'chunks/a.jsonl',bytes:bytes.length,contentId:digest(bytes),logicalAddress:{floor:-7,region_x:0,region_y:0}};
const group={offset:0,bytes:bytes.length,contentId:digest(bytes),yMin:0,yMaxExclusive:8,tiles:1,resolvedPrimitives:0};
const response=()=>new Response(bytes,{status:206,headers:{'content-range':`bytes 0-${bytes.length-1}/${bytes.length}`,'content-length':String(bytes.length)}});
function makeStore(options={}){return new SemanticRangeStore('https://audit.invalid/semantic/',world,{fetcher:async()=>response(),...options});}
for(const [name,input] of [['ordinary','chunks/floor.json'],['parent','../outside.json'],['encoded-parent','%2e%2e/outside.json'],['encoded-double','chunks/%2e%2e/%2e%2e/outside.json'],['scheme','https:other.invalid/file'],['control-prefix','\t/outside.json']]){
  await probe('path-'+name, name==='ordinary'?'same publication prefix':'reject or retain publication prefix',async()=>{
    let target,error;
    try{target=new URL(safeRelativePath(input),'https://audit.invalid/semantic/').href;}catch(e){error=e.message;}
    const confined=target?.startsWith('https://audit.invalid/semantic/');
    return verdict(name==='ordinary'?confined:!!error||confined,{input,target,error});
  });
}
await probe('cache-quota-load','valid authenticated response still usable when optional disk cache quota is exhausted',async()=>{
  const persistentCache=new VerifiedContentCache({cacheStorage:{open:async()=>({match:async()=>undefined,put:async()=>{throw new DOMException('Synthetic quota exhaustion','QuotaExceededError');}})}});
  const s=makeStore({persistentCache});let error,tiles;
  try{tiles=await s.loadGroup(-7,chunk,group);}catch(e){error=e.name+': '+e.message;}
  return verdict(tiles?.length===1,{error,stats:s.stats(),networkDigest:digest(bytes),expectedDigest:group.contentId});
});
await probe('cache-unavailable-load','optional cache unavailable does not prevent network load',async()=>{
  let calls=0;
  const s=makeStore({fetcher:async()=>{calls++;return response();},persistentCache:new VerifiedContentCache({cacheStorage:{open:async()=>{throw new DOMException('Synthetic denied storage','SecurityError');}}})});
  let error;try{await s.loadGroup(-7,chunk,group);}catch(e){error=e.name+': '+e.message;}
  return verdict(!error,{calls,error});
});
await probe('cache-parallel-same-group','resident byte count equals unique resident content after concurrent same-key loads',async()=>{
  let calls=0;const s=makeStore({fetcher:async()=>{calls++;await new Promise(r=>setTimeout(r,2));return response();}});
  await Promise.all([s.loadGroup(-7,chunk,group),s.loadGroup(-7,chunk,group)]);
  return verdict(s.stats().cacheBytes===bytes.length,{calls,actualResidentPayloadBytes:bytes.length,stats:s.stats()});
});
await probe('cache-floor-clear-inflight','cleared range store is not repopulated by an earlier in-flight request',async()=>{
  let release;const barrier=new Promise(r=>release=r);
  const s=makeStore({fetcher:async()=>{await barrier;return response();}});
  const pending=s.loadGroup(-7,chunk,group);await new Promise(r=>setTimeout(r,0));s.clearForFloorChange();release();await pending;
  return verdict(s.stats().cachedGroups===0,{stats:s.stats(),note:'API-level test; integration may suppress stale scene commits independently'});
});
await probe('cache-content-corruption','tampered range bytes rejected',async()=>{
  const changed=bytes.slice();changed[0]=123===changed[0]?32:123;
  const s=makeStore({fetcher:async()=>new Response(changed,{status:206,headers:{'content-range':`bytes 0-${bytes.length-1}/${bytes.length}`}})});
  let error;try{await s.loadGroup(-7,chunk,group);}catch(e){error=e.message;}
  return verdict(/identity mismatch/.test(error),{error});
});
await probe('range-header-corruption','incorrect Content-Range rejected',async()=>{
  const s=makeStore({fetcher:async()=>new Response(bytes,{status:206,headers:{'content-range':'bytes 1-2/3'}})});
  let error;try{await s.loadGroup(-7,chunk,group);}catch(e){error=e.message;}
  return verdict(/Content-Range mismatch/.test(error),{error});
});
await probe('near-boundary-url-roundtrip','accepted normalized view serializes and remains within exported bounds',async()=>{
  const v=parseFullWorldViewState('x=9.99999&y=5&floor=-7&zoom=2',world);let error,url;
  try{url=serializeFullWorldViewState(v,world);}catch(e){error=e.message;}
  return verdict(!error&&v.x<10,{view:v,error,url});
});
await probe('ordinary-url-roundtrip','ordinary view survives roundtrip',async()=>{
  const v=parseFullWorldViewState('x=5.1234&y=4.4321&floor=-7&zoom=2',world);
  const v2=parseFullWorldViewState(serializeFullWorldViewState(v,world),world);
  return verdict(JSON.stringify(v)===JSON.stringify(v2),{v,v2});
});
await probe('proof-near-boundary-url-roundtrip','proof view normalizes within bounds',async()=>{
  const v=parseViewState('x=32440.99999&y=32230');let error;
  try{serializeViewState(v);}catch(e){error=e.message;}
  return verdict(!error&&v.x<PROOF_BOUNDS.xMaxExclusive,{view:v,error});
});
await probe('proof-fractional-tile','tile data coordinates are integral, unlike camera coordinates',async()=>{
  let value,error;try{value=decodeCompactTile([32360.5,32230.5,-7,32360.5,32230.5,7,'tile:audit',[]]);}catch(e){error=e.message;}
  return verdict(!!error,{value,error});
});
await probe('bounded-manifest-stream','response reader stops before buffering all bytes of an oversized stream',async()=>{
  let pulls=0,cancelled=false;
  const stream=new ReadableStream({pull(controller){pulls++;controller.enqueue(new Uint8Array(128*1024));if(pulls===8)controller.close();},cancel(){cancelled=true;}});
  let error;try{await loadManifest('https://audit.invalid/manifest',async()=>new Response(stream));}catch(e){error=e.message;}
  return verdict(pulls<8,{pulls,cancelled,consumedBytes:pulls*128*1024,declaredLimit:256*1024,error});
});
const renderer={generation:1,transform:{floor:-7,dpr:1,scaleDevicePixelsPerWorldUnit:1,framebufferWidth:800,framebufferHeight:600,centerTileX:1,centerTileY:1,zoom:1}};
const baseCreature={generation:2,baseGenerationAtStart:1,baseGenerationAtCommit:1,view:{floor:-7,x:1,y:1,zoom:1}};
for(const [name,x,y,shouldPass] of [['valid',400,300,true],['drift',420,300,false],['nan',NaN,300,false],['missing',undefined,300,false],['infinity',Infinity,300,false]]){
  await probe('geometry-'+name,shouldPass?'accept valid geometry':'reject invalid geometry',async()=>{
    const creature={...baseCreature,anchors:[{id:'npc:audit',kind:'npc',floor:-7,x:1,y:1,screenX:x,screenY:y}]};
    const r=compareCreatureAnchors(renderer,creature);let error;try{r.assertWithin(.25);}catch(e){error=e.message;}
    const log=analyzeGeometryEventLog([{kind:'base',value:renderer},{kind:'creature',value:creature}]);
    return verdict(shouldPass?!error:!!error,{maxDriftPx:String(r.maxDriftPx),accepted:!error,error,log});
  });
}
await probe('geometry-nan-hides-real-drift','one invalid measurement cannot hide another anchor with definite large drift',async()=>{
  const creature={...baseCreature,anchors:[{id:'npc:invalid',floor:-7,x:1,y:1,screenX:NaN,screenY:300},{id:'npc:drift',floor:-7,x:1,y:1,screenX:500,screenY:300}]};
  const r=compareCreatureAnchors(renderer,creature);let error;try{r.assertWithin(.25);}catch(e){error=e.message;}
  return verdict(!!error,{maxDriftPx:String(r.maxDriftPx),perAnchor:r.samples.map(s=>String(s.driftPx)),accepted:!error,error});
});
await probe('runtime-world-duplicate-floors','runtime index validates a unique 16-floor census',async()=>{
  const trust={publicationRoot:'sha256:'+'1'.repeat(64),semanticRoot:'sha256:'+'2'.repeat(64),pixelRoot:'sha256:'+'3'.repeat(64),sourceFingerprint:'sha256:'+'4'.repeat(64)};
  const w={profile:RUNTIME_WORLD_PROFILE,source:{...trust,authority:'Oteryn/Oteryn-Game'},regionSpan:256,rowGroupSpan:8,visualBounds:world.visualBounds,floors:Array.from({length:16},()=>({floor:-7,path:'floor.json',rootContentId:'sha256:'+'5'.repeat(64)})),counts:{floors:16,groups:0,resolvedPrimitives:0,shards:0,sourceBytes:0,tiles:0}};
  w.rootContentId=await rootedContentId(RUNTIME_WORLD_DOMAIN,w);trust.runtimeIndexRoot=w.rootContentId;
  let accepted,error;try{accepted=await loadRuntimeWorld('https://audit.invalid/',trust,async()=>new Response(canonicalJsonBytes(w)));}catch(e){error=e.message;}
  return verdict(!!error,{accepted:!!accepted,uniqueFloors:accepted?new Set(accepted.floors.map(f=>f.floor)).size:null,error,note:'trust pin intentionally matches test input; this probes schema, not ability to forge production trust'});
});
await probe('fullworld-root-mismatch','mismatching publication root is rejected',async()=>{
  const p={profile:PUBLICATION_PROFILE,source:{authority:'Oteryn/Oteryn-Game'},semantic:{rootContentId:'sha256:'+'2'.repeat(64),path:'semantic/world.json'},pixels:{rootContentId:'sha256:'+'3'.repeat(64),path:'pixels/manifest.json'}};
  p.rootContentId=await rootedContentId(PUBLICATION_DOMAIN,p);
  let error;try{await loadFullWorldPublication('https://audit.invalid/',{publicationRoot:'sha256:'+'0'.repeat(64),semanticRoot:p.semantic.rootContentId,pixelRoot:p.pixels.rootContentId},async()=>new Response(canonicalJsonBytes(p)));}catch(e){error=e.message;}
  return verdict(/trusted root mismatch/.test(error),{error});
});
await probe('portable-sha-vectors','portable SHA agrees with independent node:crypto including padding boundaries',async()=>{
  const lengths=[0,1,31,55,56,57,63,64,65,119,120,127,128,129,1024,65536];let failures=[];
  for(const n of lengths){const b=Uint8Array.from({length:n},(_,i)=>(i*131+17)&255);if(sha256HexPortable(b)!==digest(b).slice(7))failures.push(n);}
  return verdict(failures.length===0,{vectorCount:lengths.length,failures});
});
await probe('canonical-prototype-key','canonical representation does not silently drop an own JSON __proto__ key',async()=>{
  const input=JSON.parse('{"a":1,"__proto__":{"hidden":2}}');
  const output=new TextDecoder().decode(canonicalJsonBytes(input));
  return verdict(output.includes('__proto__'),{inputKeys:Object.keys(input),output,note:'fullworld canonical-byte equality can reject this; legacy loader canonicalizes without exact-byte comparison'});
});
fs.writeFileSync(new URL('../results/runtime-probes.json',import.meta.url),JSON.stringify({runtime:process.version,commit:'51623c7dab2346cee39cd51e3caa845bf4b65426',total:results.length,satisfied:results.filter(r=>r.satisfied).length,violations:results.filter(r=>r.satisfied===false).length,probeErrors:results.filter(r=>r.probeError).length,results},null,2)+'\n');
for(const r of results)console.log(`${r.probeError?'PROBE_ERROR':r.satisfied?'SATISFIED':'VIOLATION'} ${r.id}: ${JSON.stringify(r.details)}`);
if(results.some(r=>r.probeError))process.exitCode=2;
