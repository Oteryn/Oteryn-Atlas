import assert from 'node:assert/strict';
import test from 'node:test';
import {decideProtectedWorkflowLifecycle,buildProtectedWorkflowSuccessState,buildProtectedWorkflowFailureState} from '../../tools/verification/protected-verification-workflow.mjs';
const sha=c=>c.repeat(40),digest=c=>`sha256:${c.repeat(64)}`;
const producer={repository:'Oteryn/Oteryn-Atlas',runId:1,runAttempt:1,workflowPath:'.github/workflows/protected-hosted-executor.yml',event:'pull_request'};
function fixture(ids=[]){
 const currentPlan={schemaVersion:3,repository:'Oteryn/Oteryn-Atlas',prNumber:7,protectedBaseSha:sha('a'),candidateHeadSha:sha('b'),planSemanticDigest:digest('1'),planInstanceDigest:digest('2'),authorityDigest:digest('3'),environmentDigest:digest('4'),executionPolicyDigest:digest('5'),productIdentities:{qualification_fixture:{id:'fixture',digest:digest('6')}},workerPolicy:{hostedShards:1},stableTestIds:ids,profile:ids.length?'full':'none'};
 const currentExecution={schemaVersion:2,candidateHeadSha:sha('b'),hosted:{stableTestIds:ids,partitions:ids.length?[{dataCapability:'qualification_fixture',stableTestIds:ids}]:[]},specialist:{stableTestIds:[]},review:{groupIds:[]}};
 const lifecycle=decideProtectedWorkflowLifecycle({currentPlan,currentExecution,previousState:null,baseAdvance:{changedPaths:[],mergeStatus:'clean'},now:'2026-09-07T00:00:00Z'});
 return {currentPlan,currentExecution,lifecycle,previousState:null,currentHeadSha:sha('b'),producer};
}
test('zero-work lifecycle admits exact empty evidence without requiring an environment run',()=>{
 const f=fixture(),result=buildProtectedWorkflowSuccessState({...f,evidenceManifests:[],environmentQualification:null});
 assert.equal(result.state.progress.status,'MERGE_READY');assert.equal(result.state.environmentQualification,null);assert.deepEqual(result.state.evidenceManifests,[]);
 assert.throws(()=>buildProtectedWorkflowSuccessState({...f,currentHeadSha:sha('c'),evidenceManifests:[],environmentQualification:null}),/head|candidate/);
});
test('required browser lifecycle cannot publish success with missing machine evidence',()=>{
 const f=fixture(['desktop-chromium::e2e/tests/desktop.spec.mjs::loads Atlas']);
 assert.ok(f.lifecycle.expectedEvidence.length>0);
 assert.throws(()=>buildProtectedWorkflowSuccessState({...f,evidenceManifests:[],environmentQualification:null}),/evidence|qualification|missing/);
});
test('environment failure remains owned by environment and repeated identical failure stops progress',()=>{
 const f=fixture(['desktop-chromium::e2e/tests/desktop.spec.mjs::loads Atlas']);
 const failure={...f,stage:'ENVIRONMENT_QUALIFICATION',code:'PYTHON_SHIM_MISSING',sourceOwnership:'environment',currentCandidateHeadSha:sha('b')};
 const first=buildProtectedWorkflowFailureState(failure);assert.equal(first.progress.status,'BLOCKED_ENVIRONMENT');
 const lifecycle=decideProtectedWorkflowLifecycle({...f,previousState:first,baseAdvance:{changedPaths:[],mergeStatus:'clean'},now:'2026-09-07T00:00:00Z'});
 const second=buildProtectedWorkflowFailureState({...failure,lifecycle,previousState:first,producer:{...producer,runId:2}});
 assert.equal(second.progress.status,'STALLED');
 const blocked=decideProtectedWorkflowLifecycle({...f,previousState:second,baseAdvance:{changedPaths:[],mergeStatus:'clean'},now:'2026-09-07T00:00:00Z'});
 assert.equal(blocked.disposition,'BLOCKED');assert.equal(blocked.heavyExecutionsRequired,0);
});
