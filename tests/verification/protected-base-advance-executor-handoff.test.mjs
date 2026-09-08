import assert from 'node:assert/strict';
import test from 'node:test';
import {assertCandidateReadback,classifyProductEvent,assertExecutionWindow} from '../../tools/verification/verification-execution-contract.mjs';
const snapshot=()=>({repository:'Oteryn/Oteryn-Atlas',prNumber:7,headSha:'a'.repeat(40),baseSha:'b'.repeat(40),treeSha:'c'.repeat(40),changedFiles:[{path:'src/browser/example.mjs',status:'modified'}]});
const source=()=>({sourceRepository:'Oteryn/Oteryn-Atlas',sourceRef:'refs/heads/main',sourceRevision:'b'.repeat(40)});

test('base advance handoff rejects stale planning or controller source before exact candidate reuse',()=>{
 const planned=snapshot(),advanced={...planned,baseSha:'d'.repeat(40)};
 assert.throws(()=>assertCandidateReadback({planned,current:advanced,...source()}),/readback/);
 assert.throws(()=>assertCandidateReadback({planned:advanced,current:advanced,...source()}),/source/);
 assert.equal(assertCandidateReadback({planned:advanced,current:advanced,...source(),sourceRevision:advanced.baseSha}),true);
});
test('base advance cannot use a controller output branch or change synthetic candidate tree',()=>{
 const planned={...snapshot(),prNumber:null};
 assert.equal(assertCandidateReadback({planned,current:planned,...source()}),true);
 assert.throws(()=>assertCandidateReadback({planned,current:planned,...source(),sourceRef:'refs/heads/controller-output'}),/source/);
 assert.throws(()=>assertCandidateReadback({planned,current:{...planned,treeSha:'d'.repeat(40)},...source()}),/readback/);
 assert.equal(classifyProductEvent({eventName:'merge_group',action:'checks_requested'}),'product');
 assert.throws(()=>classifyProductEvent({eventName:'workflow_run',action:'completed'}),/event/);
});
