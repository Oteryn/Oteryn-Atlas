import assert from 'node:assert/strict';
import test from 'node:test';
import {consumeProtectedAdmission} from '../../tools/verification/consume-protected-admission.mjs';
function fixture(){
 const repository='Oteryn/Oteryn-Atlas',base='a'.repeat(40),head='b'.repeat(40);
 const pr={number:7,state:'open',merged:false,changed_files:1,head:{sha:head,repo:{full_name:repository}},base:{sha:base,ref:'main',repo:{full_name:repository}}};
 const calls=[];
 const options={repository,codeRevision:head,protectedBaseSha:base,prNumber:7,now:'2026-09-07T00:00:00Z',authority:{executionPlan:{semanticDigest:`sha256:${'f'.repeat(64)}`,requiredGroups:['deterministic.core'],scenarioIds:['geometry'],dataCapabilities:['qualification_fixture'],profile:'full',proofPurpose:'candidate',evidenceKind:'protected-candidate-v1',propertyObligations:[{stableId:'geometry',profile:'functional',properties:['geometry-preserved']}],hostedPartitions:[{dataCapability:'qualification_fixture',scenarioIds:['geometry']}],specialist:[],review:[]}},scopeAdmission(){return {eligible:true};},request:async endpoint=>{
  calls.push(endpoint);const route=endpoint.split('?')[0];
  if(route===`/repos/${repository}`)return {full_name:repository,default_branch:'main'};
  if(route.includes('/git/ref/'))return {object:{sha:base}};
  if(route.endsWith('/pulls/7'))return pr;
  if(route.endsWith('/pulls/7/files'))return [{filename:'tools/verification/example.mjs',status:'modified'}];
  if(route===`/repos/${repository}/commits/${head}`)return {commit:{tree:{sha:'c'.repeat(40)}}};
  if(route.endsWith('/actions/workflows/protected-admission.yml/runs'))return {workflow_runs:[]};
  throw Error(`unexpected authority request ${endpoint}`);
 },downloadEvidence:async()=>{throw Error('must not fetch absent independent artifact');}};
 return {options,pr,calls};
}
test('PR browser consumer does not turn absent independent evidence or candidate status into success',async()=>{
 const f=fixture();
 assert.deepEqual(await consumeProtectedAdmission(f.options),{accepted:false,eligible:true,reason:'missing-independent-evidence'});
 assert.ok(!f.calls.some(route=>/statuses|check-runs|dispatches/.test(route)));
});
test('PR browser consumer rejects cross-repository or stale candidate metadata before accepting evidence',async()=>{
 for(const mutate of [f=>f.pr.head.repo.full_name='Other/Atlas',f=>f.pr.base.repo.full_name='Other/Atlas',f=>f.pr.head.sha='d'.repeat(40),f=>f.pr.base.sha='d'.repeat(40),f=>f.pr.changed_files=2,f=>f.pr.state='closed']){
  const f=fixture();mutate(f);await assert.rejects(consumeProtectedAdmission(f.options));
 }
});
