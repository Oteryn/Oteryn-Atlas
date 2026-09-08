import assert from 'node:assert/strict';
import test from 'node:test';
import {assertCandidateReadback,classifyProductEvent,assertExecutionWindow} from '../../tools/verification/verification-execution-contract.mjs';
const snapshot=()=>({repository:'Oteryn/Oteryn-Atlas',prNumber:7,headSha:'a'.repeat(40),baseSha:'b'.repeat(40),treeSha:'c'.repeat(40),changedFiles:[{path:'src/browser/example.mjs',status:'modified'}]});
const source=()=>({sourceRepository:'Oteryn/Oteryn-Atlas',sourceRef:'refs/heads/main',sourceRevision:'b'.repeat(40)});

test('admission resolves one exact candidate transaction only from protected main source',()=>{
 const planned=snapshot();assert.equal(assertCandidateReadback({planned,current:structuredClone(planned),...source()}),true);
 for(const [key,value] of Object.entries({sourceRepository:'Other/Atlas',sourceRef:'refs/heads/candidate',sourceRevision:'d'.repeat(40)}))
   assert.throws(()=>assertCandidateReadback({planned,current:planned,...source(),[key]:value}),/source/);
});
test('admission rejects every candidate association drift before authorizing proof',()=>{
 const planned=snapshot();
 for(const [key,value] of Object.entries({repository:'Other/Atlas',prNumber:8,headSha:'d'.repeat(40),baseSha:'e'.repeat(40),treeSha:'f'.repeat(40),changedFiles:[]}))
  assert.throws(()=>assertCandidateReadback({planned,current:{...planned,[key]:value},...source()}),key);
});
test('metadata and review dispatch cannot duplicate a product execution',()=>{
 for(const eventName of ['pull_request','pull_request_target']){
  assert.equal(classifyProductEvent({eventName,action:'synchronize'}),'product');
  assert.equal(classifyProductEvent({eventName,action:'labeled'}),'authority-only');
 }
 assert.throws(()=>classifyProductEvent({eventName:'workflow_dispatch',action:''}),/event/);
});
