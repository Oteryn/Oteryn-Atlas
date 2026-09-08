import assert from 'node:assert/strict';
import test from 'node:test';
import {assertCandidateReadback,classifyProductEvent,assertExecutionWindow} from '../../tools/verification/verification-execution-contract.mjs';
const snapshot=()=>({repository:'Oteryn/Oteryn-Atlas',prNumber:7,headSha:'a'.repeat(40),baseSha:'b'.repeat(40),treeSha:'c'.repeat(40),changedFiles:[{path:'src/browser/example.mjs',status:'modified'}]});
const source=()=>({sourceRepository:'Oteryn/Oteryn-Atlas',sourceRef:'refs/heads/main',sourceRevision:'b'.repeat(40)});

test('depth evidence requires exact candidate identity before and after bounded read-only execution',()=>{
 const before=snapshot(),input={before,after:structuredClone(before),startedAt:'2026-09-07T00:00:00Z',completedAt:'2026-09-07T00:01:00Z',timeoutSeconds:60,retries:0};
 assert.equal(assertExecutionWindow(input),true);
 for(const key of ['headSha','baseSha','treeSha'])assert.throws(()=>assertExecutionWindow({...input,after:{...before,[key]:'f'.repeat(40)}}),/identity/);
 assert.throws(()=>assertExecutionWindow({...input,completedAt:'2026-09-07T00:01:01Z'}),/budget/);
 assert.throws(()=>assertExecutionWindow({...input,retries:1}),/retries/);
});
test('nightly events do not acquire ordinary product execution authority',()=>{
 for(const eventName of ['schedule','workflow_dispatch','push'])assert.throws(()=>classifyProductEvent({eventName,action:''}),/event/);
});
