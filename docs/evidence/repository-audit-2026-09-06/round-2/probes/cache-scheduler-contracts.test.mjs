// Additional audit contracts; source module root can be an isolated mutant copy.
import assert from 'node:assert/strict';
import test from 'node:test';
import {pathToFileURL} from 'node:url';
const root=process.env.AUDIT_SOURCE_ROOT?pathToFileURL(process.env.AUDIT_SOURCE_ROOT+'/'):new URL('../sources/',import.meta.url);
const {VerifiedContentCache}=await import(new URL('src/browser/verified-content-cache.mjs',root));
const {createFrameScheduler}=await import(new URL('src/browser/frame-scheduler.mjs',root));
const {sha256ContentId}=await import(new URL('src/browser/loader.mjs',root));
test('put rejects bytes bound to wrong content digest',async()=>{
 const cache=new VerifiedContentCache({cacheStorage:{open:async()=>({put:async()=>{}})}});
 await assert.rejects(()=>cache.put('sha256:'+'0'.repeat(64),new Uint8Array([1,2,3,4])),/mismatched/);
});
test('put refuses oversize entry without writing to storage',async()=>{
 let writes=0;const bytes=new Uint8Array([1,2,3,4]);
 const cache=new VerifiedContentCache({maxEntryBytes:3,cacheStorage:{open:async()=>({put:async()=>{writes++;}})}});
 assert.equal(await cache.put(await sha256ContentId(bytes),bytes),false);assert.equal(writes,0);
});
test('cancel clears pending dirty render and invokes cancellation',()=>{
 let callback,cancelled=false,rendered=0;
 const scheduler=createFrameScheduler(()=>{rendered++;},{requestFrame:fn=>{callback=fn;return 123;},cancelFrame:id=>{assert.equal(id,123);cancelled=true;}});
 scheduler.schedule();scheduler.cancel();callback(1);
 assert.equal(rendered,0);assert.equal(cancelled,true);assert.equal(scheduler.stats().pending,false);
});
