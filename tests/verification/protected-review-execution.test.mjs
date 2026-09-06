import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {evaluateProtectedRouting} from '../../tools/verification/protected-semantic-routing.mjs';
import {validateExecutionPlan} from '../../tools/verification/run-protected-admission.mjs';
const read=n=>JSON.parse(fs.readFileSync(new URL(`../../tools/verification/${n}.json`,import.meta.url)));
function plan(){return evaluateProtectedRouting({candidate:{repository:'Example/Atlas',prNumber:5,headSha:'a'.repeat(40),baseSha:'b'.repeat(40),treeSha:'c'.repeat(40),changedFiles:[{path:'src/browser/creature-model.mjs',status:'modified'}]},manifest:read('impact-manifest'),catalog:read('verification-catalog'),census:read('full-safety-net-stable-ids'),inventory:read('protected-scenario-inventory'),routing:read('protected-routing'),forceFull:true});}
test('protected producer executes complete hosted capture plan without claiming review approval',()=>{const p=plan();assert.equal(p.requiredFrames.length,17);assert.ok(p.review.length);assert.doesNotThrow(()=>validateExecutionPlan(p));});
for(const [name,change]of Object.entries({
 'missing frame contract':p=>delete p.requiredFrames,
 'duplicate frame':p=>p.requiredFrames.push(p.requiredFrames[0]),
 'uncaptured scenario':p=>p.requiredFrames[0].stableTestId='unknown::unknown::unknown',
 'missing review census':p=>p.review[0].scenarioIds=[],
 'wrong review capability':p=>p.review[0].dataCapability='real_fullworld',
 'missing review execution':p=>p.hostedPartitions[0].scenarioIds=[],
 'unsupported specialist':p=>p.specialist=[{dataCapability:'real_fullworld'}],
 'relaxed worker count':p=>p.workers=2,
 'retries':p=>p.retries=1,
}))test(`protected review execution rejects ${name}`,()=>{const p=plan();change(p);assert.throws(()=>validateExecutionPlan(p));});
