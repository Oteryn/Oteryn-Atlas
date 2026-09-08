import assert from 'node:assert/strict';
import test from 'node:test';
import {bindExecutionArtifacts} from './helpers/execution-proof-fixture.mjs';
import {assertCandidateReadback, classifyProductEvent, assertExecutionWindow, evaluateFanIn} from '../../tools/verification/verification-execution-contract.mjs';
const sha = c => c.repeat(40);
const snapshot = () => ({repository:'Oteryn/Oteryn-Atlas',prNumber:7,headSha:sha('a'),baseSha:sha('b'),treeSha:sha('c'),changedFiles:[{path:'src/browser/loader.mjs',status:'modified'}]});
const source = {sourceRepository:'Oteryn/Oteryn-Atlas',sourceRef:'refs/heads/main',sourceRevision:sha('b')};
test('final candidate readback rejects head/base/tree/repository/file drift',()=>{
 const planned=snapshot();assert.equal(assertCandidateReadback({planned,current:snapshot(),...source}),true);
 for(const key of ['headSha','baseSha','treeSha','repository']) {const current=snapshot();current[key]=key==='repository'?'Other/Atlas':sha('d');assert.throws(()=>assertCandidateReadback({planned,current,...source}),/readback/);}
 const current=snapshot();current.changedFiles[0].path='README.md';assert.throws(()=>assertCandidateReadback({planned,current,...source}),/readback/);
});
test('candidate branches cannot impersonate protected execution source',()=>{
 for(const bad of [{sourceRef:'refs/heads/feature'},{sourceRepository:'Other/Atlas'},{sourceRevision:sha('d')}]) assert.throws(()=>assertCandidateReadback({planned:snapshot(),current:snapshot(),...source,...bad}),/protected source/);
});
test('product events exclude review and nonsemantic metadata but preserve PR/MQ candidates',()=>{
 for(const eventName of ['pull_request','pull_request_target']) assert.equal(classifyProductEvent({eventName,action:'synchronize'}),'product');
 assert.equal(classifyProductEvent({eventName:'merge_group',action:'checks_requested'}),'product');
 for(const action of ['submitted','edited','dismissed']) assert.equal(classifyProductEvent({eventName:'pull_request_review',action}),'authority-only');
 assert.equal(classifyProductEvent({eventName:'pull_request_target',action:'edited'}),'authority-only');
 assert.throws(()=>classifyProductEvent({eventName:'workflow_dispatch',action:'anything'}),/unsupported/);
});
test('bounded zero-retry execution rejects overtime and final identity drift',()=>{
 const input={before:snapshot(),after:snapshot(),startedAt:'2026-09-07T00:00:00Z',completedAt:'2026-09-07T00:00:05Z',timeoutSeconds:10,retries:0};
 assert.equal(assertExecutionWindow(input),true);
 assert.throws(()=>assertExecutionWindow({...input,timeoutSeconds:1}),/budget/);
 assert.throws(()=>assertExecutionWindow({...input,retries:1}),/retries/);
 assert.throws(()=>assertExecutionWindow({...input,after:{...snapshot(),headSha:sha('d')}}),/identity/);
});
test('fan-in cannot accept an unsealed or absent execution contract',()=>{
 assert.throws(()=>evaluateFanIn({contract:{},evidence:[]}),/contract/);
});

import {sealExecutionContract,validateGroupEvidence} from '../../tools/verification/verification-execution-contract.mjs';
const h=c=>'sha256:'+c.repeat(64);
function proofFixture(visual=false) {
 const identity={repository:'Oteryn/Oteryn-Atlas',headSha:sha('a'),protectedBaseSha:sha('b'),treeSha:sha('c'),candidateDigest:h('a'),environmentDigest:'f'.repeat(64),planDigest:h('c'),policyDigest:h('d')};
 const producerPolicy={repositoryId:1337995824,workflowPath:'.github/workflows/product-verification.yml',jobName:'proof',event:'pull_request_target'};
 const frame={frameId:'viewport',stableTestId:'desktop-chromium::e2e/tests/desktop.spec.mjs::smoke'};
 const contract=sealExecutionContract({schemaVersion:1,identity,producerPolicy,maxEvidenceAgeMs:60000,retries:0,commands:[{id:h('e'),argv:['node','--test','tests/a.mjs'],expectedTestIds:['tests/a.mjs'],timeoutSeconds:10}],groups:[{id:'deterministic.example',commandIds:[h('e')]}],reviews:visual?[{groupId:'review.example',frames:[frame],commandIds:[h('e')]}]:[]});
 const producer={...producerPolicy,repository:identity.repository,headSha:identity.headSha,baseSha:identity.protectedBaseSha,sourceSha:identity.protectedBaseSha,sourceRef:'refs/heads/main',headRepositoryId:producerPolicy.repositoryId,baseRepositoryId:producerPolicy.repositoryId,runId:12,jobId:13,runAttempt:1,status:'completed',conclusion:'success',artifactDigest:h('f')};
 const evidence={commandId:h('e'),identity,contractDigest:contract.contractDigest,status:'passed',exitCode:0,attempt:1,logDigest:h('1'),tests:[{id:'tests/a.mjs',status:'passed',attempt:1}],startedAt:'2026-09-07T00:00:00Z',completedAt:'2026-09-07T00:00:05Z',producer:{runId:12,jobId:13,artifactDigest:h('f')},captures:visual?[{...frame,screenshotDigest:h('2'),playwrightResultDigest:h('3')}]:[]};
 return bindExecutionArtifacts({contract,evidence:[evidence],producers:{[h('e')]:producer},now:'2026-09-07T00:00:10Z'});
}
test('exact trusted producer evidence closes every required command once',()=>assert.equal(evaluateFanIn(proofFixture()).status,'PASS'));
test('missing and duplicate command proof cannot pass fan-in',()=>{
 const f=proofFixture();assert.equal(evaluateFanIn({...f,evidence:[]}).status,'BLOCKED');
 assert.throws(()=>evaluateFanIn({...f,evidence:[...f.evidence,...f.evidence]}),/duplicate/);
});
test('stale, skipped, retry, candidate, workflow and source substitutions fail closed',()=>{
 for(const mutate of [f=>f.evidence[0].tests[0].status='skipped',f=>f.evidence[0].attempt=2,f=>f.evidence[0].identity={...f.evidence[0].identity,headSha:sha('d')},f=>f.producers[h('e')]={...f.producers[h('e')],workflowPath:'.github/workflows/other.yml'},f=>f.producers[h('e')]={...f.producers[h('e')],sourceRef:'refs/heads/feature'},f=>f.producers[h('e')]={...f.producers[h('e')],headRepositoryId:2},f=>f.now='2026-09-08T00:00:10Z']) {
  const f=proofFixture();mutate(f);assert.throws(()=>evaluateFanIn(f));
 }
});
test('machine success never discharges restricted visual review or reviewer authority',()=>{
 const f=proofFixture(true);assert.equal(evaluateFanIn(f).status,'BLOCKED');
 const review={reviewId:'trusted-review-7',groupId:'review.example',frameId:'viewport',stableTestId:'desktop-chromium::e2e/tests/desktop.spec.mjs::smoke',identity:f.contract.identity,contractDigest:f.contract.contractDigest,status:'approved',independent:true,reviewer:'independent-fixture-reviewer',screenshotDigest:h('2'),playwrightResultDigest:h('3')};
 assert.throws(()=>evaluateFanIn({...f,reviews:[review]}),/unauthenticated/);
 const complete={...f,reviews:[review],reviewAuthorizations:{[review.reviewId]:review}};
 assert.throws(()=>evaluateFanIn(complete),/unauthenticated/);
 complete.evidence[0].captures[0].screenshotDigest=h('4');assert.throws(()=>evaluateFanIn(complete),/artifact/);
});

import fs from 'node:fs';
import {fileURLToPath} from 'node:url';
import {resolveExecutionContract, evaluateCandidateEvidence} from '../../tools/verification/verification-execution-contract.mjs';
const root=fileURLToPath(new URL('../../',import.meta.url));
function executionInput(path='tests/semantic-search.mjs',event='pull_request_target') {
 const candidate={...snapshot(),changedFiles:[{path,status:'modified'}]};
 const protectedCatalog=JSON.parse(fs.readFileSync(`${root}/tools/verification/verification-catalog.json`));
 const protectedImpactManifest=JSON.parse(fs.readFileSync(`${root}/tools/verification/impact-manifest.json`));
 return {root,candidate,protectedCatalog,protectedImpactManifest,environmentDigest:'f'.repeat(64),
  producerPolicy:{repositoryId:1337995824,workflowPath:'.github/workflows/product-verification.yml',jobName:'verify',event},
  planInput:{repository:candidate.repository,headSha:candidate.headSha,integrationBaseSha:candidate.baseSha,mergeBaseSha:candidate.baseSha,changedFiles:candidate.changedFiles,
   candidateVerificationCatalog:protectedCatalog,candidateImpactManifest:protectedImpactManifest}};
}
test('planner resolves exact deterministic commands and preserves changed-test coverage',()=>{
 const contract=resolveExecutionContract(executionInput());
 assert.deepEqual(contract.groups.map(g=>g.id),['deterministic.search']);
 assert(contract.commands.some(c=>c.expectedTestIds.includes('tests/semantic-search.mjs')));
 assert(contract.commands.every(c=>c.engine==='deterministic'&&c.argv[0]==='node'&&c.cwd==='.'&&c.dataCapability==='qualification_fixture'));
 assert.equal(new Set(contract.commands.flatMap(c=>c.expectedTestIds)).size,contract.commands.flatMap(c=>c.expectedTestIds).length);
 assert.equal(evaluateCandidateEvidence({executionInput:executionInput(),evidence:[],now:new Date().toISOString()}).status,'BLOCKED');
});
test('docs-only plan produces no command or runner and needs no publication',()=>{
 const input=executionInput('docs/ordinary.md');const contract=resolveExecutionContract(input);
 assert.deepEqual(contract.commands,[]);assert.deepEqual(contract.groups,[]);
 assert.equal(evaluateCandidateEvidence({executionInput:input,evidence:[],now:new Date().toISOString()}).status,'PASS');
});
test('unknown paths, candidate command widening and stale claimed plans fail closed',()=>{
 assert.throws(()=>resolveExecutionContract(executionInput('unknown/product.mjs')),/unresolved obligations/);
 const input=executionInput();input.planInput.candidateVerificationCatalog=structuredClone(input.protectedCatalog);
 input.planInput.candidateVerificationCatalog.groups['deterministic.search'].specs.push('tests/creature-gameplay-model.mjs');
 assert.throws(()=>resolveExecutionContract(input),/protected execution group/);
 assert.throws(()=>resolveExecutionContract({...executionInput(),claimedPlan:{}}),/recomputed plan/);
 const changed=executionInput();changed.candidate.treeSha='bad';assert.throws(()=>resolveExecutionContract(changed),/readback identity/);
});
test('equivalent PR and MQ candidates resolve identical semantic commands',()=>{
 const pr=resolveExecutionContract(executionInput()),mq=resolveExecutionContract(executionInput('tests/semantic-search.mjs','merge_group'));
 assert.deepEqual(pr.commands,mq.commands);assert.deepEqual(pr.groups,mq.groups);
 assert.notEqual(pr.contractDigest,mq.contractDigest,'producer event must remain separately bound');
});

import {fixture as rawReviewFixture} from './fixtures/protected-review-fixture.mjs';
import {authenticateExecutionReviews} from '../../tools/verification/verification-execution-contract.mjs';
test('authenticated current review bundle closes visual fan-in; copies and revoked timeline do not',()=>{
 const input=rawReviewFixture();
 // All values are transport fixtures, never live review evidence.
 input.currentCandidate.repository='Oteryn/Oteryn-Atlas';
 const capture=JSON.parse(input.captureBytes),decision=JSON.parse(input.review.body);
 capture.candidate=input.currentCandidate;decision.candidate=input.currentCandidate;
 input.captureRun.repository.full_name=input.currentCandidate.repository;
 input.review.pull_request_url='https://api.github.com/repos/Oteryn/Oteryn-Atlas/pulls/7';
 input.captureBytes=Buffer.from(JSON.stringify(capture));
 decision.captureDigest='sha256:'+createHash('sha256').update(input.captureBytes).digest('hex');
 input.review.body=JSON.stringify({schemaVersion:1,kind:'protected-visual-review-bundle',candidate:input.currentCandidate,captures:[decision]});
 input.captures=[{authority:input.authority,captureBytes:input.captureBytes}];
 const f=proofFixture(true),frame=capture.frames[0];
 f.contract=sealExecutionContract({...f.contract,identity:{...f.contract.identity,treeSha:input.currentCandidate.treeSha,candidateDigest:'sha256:'+createHash('sha256').update(canonicalJson(input.currentCandidate)).digest('hex'),planDigest:capture.planDigest},reviews:[{groupId:'review.example',frames:[{frameId:frame.frameId,stableTestId:frame.scenarioId}],commandIds:[f.contract.commands[0].id]}]});
 f.evidence[0]={...f.evidence[0],identity:f.contract.identity,contractDigest:f.contract.contractDigest,captures:[{frameId:frame.frameId,stableTestId:frame.scenarioId,screenshotDigest:frame.digest,playwrightResultDigest:capture.summary.digest}]};
 const machine=bindExecutionArtifacts(f);
 const receipts=authenticateExecutionReviews({contract:f.contract,input,currentReviews:[input.review],candidateAuthorId:6});
 const reviews=Object.values(receipts).map(row=>structuredClone(row));
 assert.equal(evaluateFanIn({...machine,reviews,reviewAuthorizations:receipts}).status,'PASS');
 assert.throws(()=>evaluateFanIn({...machine,reviews,reviewAuthorizations:structuredClone(receipts)}),/unauthenticated/);
 assert.throws(()=>authenticateExecutionReviews({contract:f.contract,input,currentReviews:[input.review,{...input.review,id:45,state:'DISMISSED',submitted_at:'2026-09-06T10:11:00Z'}],candidateAuthorId:6}),/timeline/);
 assert.throws(()=>authenticateExecutionReviews({contract:f.contract,input,currentReviews:[input.review],candidateAuthorId:5}),/independent/);
});
import {createHash} from 'node:crypto';
test('raw artifact digest and bytes are required independently of matching producer claims',()=>{
 const f=proofFixture();assert.throws(()=>evaluateFanIn({...f,artifacts:{}}),/execution report/);
 const altered={...f,artifacts:{...f.artifacts,[f.evidence[0].commandId]:Buffer.from('{}')}};
 assert.throws(()=>evaluateFanIn(altered),/execution report/);
});

import {canonicalJson} from '../../tools/verification/verification-plan-schema.mjs';

import {createPublicationProofFixtures} from './helpers/publication-proof-fixture.mjs';
test('HTTP Playwright proof resolves exact protected test census without browser or FullWorld',()=>{
 const input=executionInput('e2e/tests/creature-gameplay-source-contract-desktop.spec.mjs');
 input.protectedStableTestIds=JSON.parse(fs.readFileSync(`${root}/tools/verification/protected-scenario-inventory.json`)).stableTestIds;
 Object.assign(input,createPublicationProofFixtures());
 const contract=resolveExecutionContract(input);
 assert.deepEqual(contract.groups.map(g=>g.id),['integration.source-contract-http']);
 assert.equal(contract.commands.length,1);assert.equal(contract.commands[0].expectedTestIds.length,2);
 assert.equal(contract.commands[0].dataCapability,'bounded_real_world');
 assert.equal(contract.commands[0].resourceClass,'cpu-light');
 assert.equal(contract.commands[0].cwd,'e2e');
 assert.throws(()=>resolveExecutionContract({...input,protectedStableTestIds:undefined}),/missing protected test census/);
 const bad=structuredClone(input);bad.publicationProofs.bounded_real_world.source.revision='e'.repeat(40);
 assert.throws(()=>resolveExecutionContract(bad),/publication authentication/);
});
test('review frames remain additional obligations after exact browser command resolution',()=>{
 const input=executionInput('e2e/tests/creature-presentation-desktop.spec.mjs');
 input.protectedStableTestIds=JSON.parse(fs.readFileSync(`${root}/tools/verification/protected-scenario-inventory.json`)).stableTestIds;
 Object.assign(input,createPublicationProofFixtures());
 const contract=resolveExecutionContract(input);
 assert.equal(contract.commands.length,2);assert.equal(contract.reviews.length,2);
 assert.equal(contract.reviews.flatMap(r=>r.frames).length,13);
 assert(contract.commands.every(c=>c.dataCapability==='qualification_fixture'));
});

test('review frame IDs cannot substitute for the complete protected machine test census',()=>{
 const input=executionInput('e2e/tests/creature-gameplay-desktop.spec.mjs');
 Object.assign(input,createPublicationProofFixtures());
 assert.throws(()=>resolveExecutionContract(input),/missing protected test census/);
 input.protectedStableTestIds=JSON.parse(fs.readFileSync(`${root}/tools/verification/protected-scenario-inventory.json`)).stableTestIds;
 const contract=resolveExecutionContract(input);
 const command=contract.commands.find(row=>row.expectedTestIds.some(id=>id.includes('creature-gameplay-desktop.spec.mjs')));
 assert.equal(command.expectedTestIds.length,4);
 assert.equal(contract.reviews.find(row=>row.groupId==='review.creature-gameplay-desktop').frames.length,1);
});
