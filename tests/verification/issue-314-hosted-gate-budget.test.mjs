import assert from 'node:assert/strict';
import test from 'node:test';
import {assertCandidateReadback,classifyProductEvent,assertExecutionWindow} from '../../tools/verification/verification-execution-contract.mjs';
const snapshot=()=>({repository:'Oteryn/Oteryn-Atlas',prNumber:7,headSha:'a'.repeat(40),baseSha:'b'.repeat(40),treeSha:'c'.repeat(40),changedFiles:[{path:'src/browser/example.mjs',status:'modified'}]});
const source=()=>({sourceRepository:'Oteryn/Oteryn-Atlas',sourceRef:'refs/heads/main',sourceRevision:'b'.repeat(40)});

test('hosted proof accepts the exact deadline and fails immediately beyond its protected budget',()=>{
 const input={before:snapshot(),after:snapshot(),startedAt:'2026-09-07T00:00:00Z',completedAt:'2026-09-07T00:02:00Z',timeoutSeconds:120,retries:0};
 assert.equal(assertExecutionWindow(input),true);
 for(const completedAt of ['2026-09-07T00:02:00.001Z','2026-09-06T23:59:59Z','invalid'])assert.throws(()=>assertExecutionWindow({...input,completedAt}),/budget/);
 for(const timeoutSeconds of [0,-1,1.5,Infinity,86401])assert.throws(()=>assertExecutionWindow({...input,timeoutSeconds}),/budget/);
 assert.throws(()=>assertExecutionWindow({...input,retries:1}),/retries/);
});
test('a waiting consumer cannot accept success after candidate or changed-file movement',()=>{
 const planned=snapshot(),current={...planned,changedFiles:[{path:'src/browser/unproven.mjs',status:'modified'}]};
 assert.throws(()=>assertCandidateReadback({planned,current,...source()}),/readback/);
 assert.throws(()=>assertExecutionWindow({before:planned,after:current,startedAt:'2026-09-07T00:00:00Z',completedAt:'2026-09-07T00:00:01Z',timeoutSeconds:120,retries:0}),/identity/);
});
