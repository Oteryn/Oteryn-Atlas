import assert from 'node:assert/strict';
import test from 'node:test';
import {fixture as captureFixture} from './fixtures/protected-review-fixture.mjs';
import {canonicalJson} from '../../tools/verification/verification-plan-schema.mjs';
import {protectedReviewDigest} from '../../tools/verification/protected-review-evidence.mjs';
import {consumeProtectedAdmission} from '../../tools/verification/consume-protected-admission.mjs';
import * as admissionEvidence from '../../tools/verification/protected-admission-evidence.mjs';

function fixture(mode='PR') {
  const f=captureFixture(),c=f.currentCandidate,a=f.authority,prefix=`/repos/${c.repository}`,workflow='.github/workflows/protected-admission.yml';
  a.workflowPath=workflow;a.jobName='Protected admission proof';a.artifactName='protected-admission-evidence-42-1';
  f.captureRun.path=workflow;f.captureRun.display_title=`protected-admission:${c.repository}:${c.prNumber}:${c.headSha}:${c.baseSha}`;
  f.captureJobs.jobs[0].name=a.jobName;f.captureArtifact.name=a.artifactName;
  const capture=JSON.parse(f.captureBytes);capture.producer.workflowPath=workflow;
  f.captureBytes=canonicalJson(capture);
  const decision=JSON.parse(f.review.body);decision.captureDigest=protectedReviewDigest(f.captureBytes);
  f.review.body=JSON.stringify({schemaVersion:1,kind:'protected-visual-review-bundle',candidate:c,captures:[decision]});
  const plan={semanticDigest:a.planDigest,requiredGroups:['deterministic.core','visual.creatures'],scenarioIds:a.scenarioIds,dataCapabilities:[a.dataCapability],profile:'full',proofPurpose:'candidate',evidenceKind:'protected-candidate-v1',propertyObligations:a.scenarioIds.map(stableId=>({stableId,profile:'functional',properties:['visual-acceptance']})),hostedPartitions:[{dataCapability:a.dataCapability,scenarioIds:a.summaryScenarioIds}],specialist:[],review:[{dataCapability:a.dataCapability,scenarioIds:a.scenarioIds,groupIds:['visual.creatures'],evidenceKind:'restricted-visual-review'}]};
  const partition={dataCapability:a.dataCapability,scenarioResults:a.summaryScenarioIds.map(id=>({id,result:'PASS'})),productDigest:a.productDigest,oracleDigest:a.oracleDigest,workers:1,retries:0};
  const evidence={schemaVersion:1,kind:'protected-admission',candidate:c,producer:{...capture.producer,event:'workflow_dispatch'},createdAt:'2026-09-06T10:03:00Z',proof:{plan,deterministic:{groups:['deterministic.core'],result:'PASS'},browser:{scenarioResults:[],workers:1,retries:0,dataCapability:null,oracleDigest:a.oracleDigest,productDigest:null,partitions:[partition]},reviewCaptures:[capture]}};
  const pr={number:c.prNumber,state:'open',merged:false,changed_files:1,head:{sha:c.headSha,repo:{id:99,full_name:c.repository}},base:{sha:c.baseSha,ref:'main',repo:{id:99,full_name:c.repository}}};
  const state={reviews:[f.review],permission:f.reviewerPermission,artifact:f.captureArtifact,run:f.captureRun,jobs:f.captureJobs.jobs,pr,evidence,reads:{},change:null};
  const options={repository:c.repository,codeRevision:mode==='PR'?c.headSha:'9'.repeat(40),protectedBaseSha:c.baseSha,...(mode==='PR'?{prNumber:c.prNumber}:{}),now:f.now,scopeAdmission:()=>({eligible:true}),authority:{executionPlan:plan,oracleDigest:a.oracleDigest,maxAgeMs:a.maxAgeMs,visualCaptureContract:{schemaVersion:1,requiredFrames:a.requiredFrames.map(row=>({frameId:row.frameId,stableTestId:row.scenarioId}))},visualCaptureExecution:{runnerKind:a.runnerKind,runnerGroupId:a.runnerGroupId,runnerLabels:a.runnerLabels,jobName:a.jobName}},downloadEvidence:async()=>structuredClone(state.evidence),request:async endpoint=>{
    const route=endpoint.split('?')[0];state.reads[route]=(state.reads[route]??0)+1;
    let result;
    if(route===prefix)result={id:99,full_name:c.repository,default_branch:'main'};
    else if(route===`${prefix}/git/ref/heads/main`)result={object:{sha:c.baseSha}};
    else if(route===`${prefix}/pulls/${c.prNumber}`)result=state.pr;
    else if(route===`${prefix}/pulls/${c.prNumber}/files`)result=c.changedFiles.map(row=>({filename:row.path,status:row.status}));
    else if(route===`${prefix}/commits/${c.headSha}`||route===`${prefix}/commits/${'9'.repeat(40)}`)result={commit:{tree:{sha:c.treeSha}}};
    else if(route===`${prefix}/commits/${'9'.repeat(40)}/pulls`)result=[state.pr];
    else if(route===`${prefix}/actions/workflows/protected-admission.yml/runs`)result={workflow_runs:[state.run]};
    else if(route===`${prefix}/actions/runs/42`)result=state.run;
    else if(route===`${prefix}/actions/runs/42/attempts/1/jobs`)result={jobs:state.jobs};
    else if(route===`${prefix}/actions/runs/42/artifacts`)result={artifacts:[state.artifact]};
    else if(route===`${prefix}/pulls/${c.prNumber}/reviews`)result=state.reviews;
    else if(route===`${prefix}/collaborators/maintainer/permission`)result=state.permission;
    else throw Error(`unexpected request ${endpoint}`);
    result=structuredClone(result);return state.change?.(route,state.reads[route],result)??result;
  }};
  return {options,state,prefix,candidate:c};
}
for(const mode of ['PR','MQ'])test(`${mode} consumes actual external bundle and rereads review permission artifacts and candidate`,async()=>{
  const f=fixture(mode),result=await consumeProtectedAdmission(f.options);
  assert.equal(result.accepted,true);
  for(const endpoint of [`${f.prefix}/pulls/7/reviews`,`${f.prefix}/collaborators/maintainer/permission`,`${f.prefix}/actions/runs/42/artifacts`])assert.equal(f.state.reads[endpoint],2);
});
test('complete machine proof waits for independent review instead of producing GREEN',async()=>{
  const f=fixture();f.state.reviews=[];
  assert.deepEqual(await consumeProtectedAdmission(f.options),{accepted:false,eligible:true,reason:'missing-independent-visual-review'});
});
for(const [label,mutate] of Object.entries({
  'missing capture':f=>f.state.evidence.proof.reviewCaptures=[],
  'candidate self attestation':f=>{f.state.reviews=[];f.state.evidence.proof.independentReview={accepted:true};},
  'missing required frame':f=>f.options.authority.visualCaptureContract.requiredFrames.push({frameId:'second',stableTestId:f.options.authority.executionPlan.scenarioIds[0]}),
  'review revoked during consumption':f=>f.state.change=(route,n,result)=>{if(route.endsWith('/reviews')&&n===2)result[0].state='DISMISSED';return result;},
  'reviewer loses authority':f=>f.state.change=(route,n,result)=>{if(route.endsWith('/permission')&&n===2)result.role_name='read';return result;},
  'artifact replaced during consumption':f=>f.state.change=(route,n,result)=>{if(route.endsWith('/artifacts')&&n===2)result.artifacts[0].id++;return result;},
}))test(`${label} cannot authorize candidate`,async()=>{
  const f=fixture();mutate(f);
  if(label==='candidate self attestation'){const result=await consumeProtectedAdmission(f.options);assert.equal(result.accepted,false);}
  else await assert.rejects(consumeProtectedAdmission(f.options));
});
test('reference metadata binds exact protected source and producer without pretending to recheck private image bytes',()=>{
  assert.equal(typeof admissionEvidence.validateProtectedReferenceMetadata,'function');
  const identity={repository:'Example/Atlas',pr:7,headSha:'a'.repeat(40),baseSha:'b'.repeat(40),candidateTree:'c'.repeat(40),referenceTree:'d'.repeat(40),productDigest:'sha256:'+'e'.repeat(64),workflow:'.github/workflows/protected-admission.yml',runId:42,jobId:43,attempt:1,browserImage:'pinned-protected-image'};
  const manifest={schemaVersion:1,identity,contractDigest:'sha256:'+'f'.repeat(64),images:[{project:'desktop-chromium',name:'desktop-inspector.png',bytes:100,width:50,height:40,sha256:'sha256:'+'1'.repeat(64)},{project:'mobile-chromium',name:'mobile-inspector-panel.png',bytes:100,width:40,height:50,sha256:'sha256:'+'2'.repeat(64)}]};
  assert.equal(admissionEvidence.validateProtectedReferenceMetadata(manifest,identity).accepted,true);
  for(const mutate of [m=>m.identity.headSha='f'.repeat(40),m=>m.identity.referenceTree='f'.repeat(40),m=>m.identity.jobId++,m=>m.identity.browserImage='candidate-image',m=>m.images.pop(),m=>m.images[0].width=0,m=>m.images[0].sha256='wrong',m=>m.contractDigest='wrong']){
    const changed=structuredClone(manifest);mutate(changed);assert.throws(()=>admissionEvidence.validateProtectedReferenceMetadata(changed,identity));
  }
});
for(const mode of ['PR','MQ'])test(`${mode} requires both qualified and bounded capture decisions in one real review body`,async()=>{
  const f=fixture(mode),plan=f.options.authority.executionPlan,proof=f.state.evidence.proof;
  const id='mobile-chromium::e2e/tests/visual-mobile.spec.mjs::qualified full frame',product='sha256:'+'a'.repeat(64);
  plan.scenarioIds=[...plan.scenarioIds,id];plan.dataCapabilities.push('qualification_fixture');
  plan.propertyObligations.push({stableId:id,profile:'functional',properties:['visual-acceptance']});
  plan.hostedPartitions.push({dataCapability:'qualification_fixture',scenarioIds:[id]});
  plan.review=[{dataCapability:'qualification_fixture',scenarioIds:[id],groupIds:['visual.creatures'],evidenceKind:'restricted-visual-review'}];
  f.options.authority.visualCaptureContract.requiredFrames.push({frameId:'qualified-frame',stableTestId:id});
  const capture=structuredClone(proof.reviewCaptures[0]);capture.dataCapability='qualification_fixture';capture.productDigest=product;capture.scenarioIds=[id];capture.frames=[{...capture.frames[0],frameId:'qualified-frame',scenarioId:id,path:'qualified/frame.png'}];
  proof.reviewCaptures.push(capture);
  const partition={dataCapability:'qualification_fixture',scenarioResults:[{id,result:'PASS'}],productDigest:product,oracleDigest:f.options.authority.oracleDigest,workers:1,retries:0};
  proof.browser.partitions.push(partition);proof.browser.dataCapability='qualification_fixture';proof.browser.productDigest=product;proof.browser.scenarioResults=partition.scenarioResults;
  const body=JSON.parse(f.state.reviews[0].body),decision={...body.captures[0],captureDigest:protectedReviewDigest(canonicalJson(capture)),frames:capture.frames.map(frame=>({...frame,result:'PASS'}))};
  body.captures.push(decision);f.state.reviews[0].body=JSON.stringify(body);
  assert.equal((await consumeProtectedAdmission(f.options)).accepted,true);
  body.captures.shift();f.state.reviews[0].body=JSON.stringify(body);
  await assert.rejects(consumeProtectedAdmission(f.options),/bundle/);
});
