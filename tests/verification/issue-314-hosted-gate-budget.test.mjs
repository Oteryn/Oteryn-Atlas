import assert from 'node:assert/strict';
import test from 'node:test';
import {assertCandidateReadback} from '../../tools/verification/verification-execution-contract.mjs';
const snapshot=()=>({repository:'Oteryn/Oteryn-Atlas',prNumber:7,headSha:'a'.repeat(40),baseSha:'b'.repeat(40),treeSha:'c'.repeat(40),changedFiles:[{path:'src/browser/example.mjs',status:'modified'}]});
const source=()=>({sourceRepository:'Oteryn/Oteryn-Atlas',sourceRef:'refs/heads/main',sourceRevision:'b'.repeat(40)});

test('candidate readback rejects changed-file movement',()=>{
 const planned=snapshot(),current={...planned,changedFiles:[{path:'src/browser/unproven.mjs',status:'modified'}]};
 assert.throws(()=>assertCandidateReadback({planned,current,...source()}),/readback/);
});
