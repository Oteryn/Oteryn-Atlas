import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import {protectedHostedWorkerPolicy,protectedCandidateCensusSandboxPolicy} from '../../tools/verification/protected-hosted-plan.mjs';
import {validateExecutionPlan,selectProtectedBrowserCensus} from '../../tools/verification/run-protected-admission.mjs';
const compose=fs.readFileSync(new URL('../../e2e/compose.protected-hosted-executor.yml',import.meta.url),'utf8');
test('candidate browser execution and hosted publication share one internal default network with no host IPC', () => {
  assert.match(compose, /networks:\n\s+default:\n\s+internal:\s*true/);
  assert.doesNotMatch(compose, /atlas-e2e-internal/);
  assert.match(compose, /--test-list=\/run\/atlas-protected-test-list\.txt/);
  assert.match(compose, /--retries=0/);
  assert.doesNotMatch(compose, /ipc:\s*host|network_mode:\s*host/);
});


test('hosted worker and candidate census policies remain bounded and isolated',()=>{
 assert.equal(protectedHostedWorkerPolicy.hostedShards,1);
 assert.deepEqual(protectedCandidateCensusSandboxPolicy,{id:protectedCandidateCensusSandboxPolicy.id,network:'none',repositoryMount:'read-only',secrets:false,lan:false});
 assert.equal(Object.isFrozen(protectedCandidateCensusSandboxPolicy),true);
});
test('capability scoped hosted execution conserves exact independent partitions',()=>{
 const plan={workers:1,retries:0,scenarioIds:['qualification','bounded'],capabilities:['bounded_real_world','qualification_fixture'],hostedPartitions:[{dataCapability:'qualification_fixture',scenarioIds:['qualification']},{dataCapability:'bounded_real_world',scenarioIds:['bounded']}],specialist:[],review:[]};
 assert.doesNotThrow(()=>validateExecutionPlan(plan));
 for(const partitions of [[plan.hostedPartitions[0]],[...plan.hostedPartitions,plan.hostedPartitions[0]]])assert.throws(()=>validateExecutionPlan({...plan,hostedPartitions:partitions}),/partition/);
 assert.throws(()=>validateExecutionPlan({...plan,workers:2}),/execution/);
 const census={scenarioIds:plan.scenarioIds,testList:'qualification test\nbounded test\n'};
 assert.deepEqual(selectProtectedBrowserCensus(census,['bounded']),{scenarioIds:['bounded'],testList:'bounded test\n'});
 assert.throws(()=>selectProtectedBrowserCensus(census,['unproven']),/selection/);
});
