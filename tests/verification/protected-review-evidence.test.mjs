import assert from 'node:assert/strict';
import test from 'node:test';
import crypto from 'node:crypto';
import fs from 'node:fs';
import {fixture} from './fixtures/protected-review-fixture.mjs';
import {evaluateProtectedRouting} from '../../tools/verification/protected-semantic-routing.mjs';

const module = await import('../../tools/verification/protected-review-evidence.mjs').catch(error => {
  if (error.code === 'ERR_MODULE_NOT_FOUND') return {};
  throw error;
});
const digest = bytes => 'sha256:' + crypto.createHash('sha256').update(bytes).digest('hex');
const sha = character => character.repeat(40);
const hash = character => 'sha256:' + character.repeat(64);
const scenarioId = 'desktop-chromium::e2e/tests/visual-desktop.spec.mjs::full frame';

function changeCapture(input, change) { const capture=JSON.parse(input.captureBytes);change(capture);input.captureBytes=Buffer.from(JSON.stringify(capture)); }
function changeDecision(input,change) {const decision=JSON.parse(input.review.body);change(decision);input.review.body=JSON.stringify(decision);}

test('private capture bytes and authenticated current review accept one exact candidate',()=>{
  assert.equal(typeof module.validateProtectedVisualCapture,'function');
  assert.equal(typeof module.validateProtectedReviewEvidence,'function');
  const input=fixture();
  assert.equal(module.validateProtectedVisualCapture(input).accepted,true);
  const {files,...published}=input;
  assert.equal(module.validateProtectedReviewEvidence(published).accepted,true,'PR/MQ validation must not require private frame bytes');
});
test('current maintainer COMMENTED review supports a sole owner without inventing second-person approval',()=>{
  const input=fixture();input.reviewerPermission.permission='write';input.reviewerPermission.role_name='maintain';
  assert.equal(module.validateProtectedReviewEvidence(input).reviewer.id,5);
});
for(const [name,mutate] of Object.entries({
  'wrong repository':x=>x.currentCandidate.repository='Other/Atlas',
  'wrong PR':x=>x.currentCandidate.prNumber++,
  'wrong head':x=>x.currentCandidate.headSha=sha('d'),
  'wrong base':x=>x.currentCandidate.baseSha=sha('d'),
  'wrong tree':x=>x.currentCandidate.treeSha=sha('d'),
  'changed file drift':x=>x.currentCandidate.changedFiles.push({path:'extra',status:'added'}),
  'candidate plan substitution':x=>changeCapture(x,c=>c.planDigest=hash('a')),
  'oracle substitution':x=>changeCapture(x,c=>c.oracleDigest=hash('a')),
  'product substitution':x=>changeCapture(x,c=>c.productDigest=hash('a')),
  'capability substitution':x=>changeCapture(x,c=>c.dataCapability='qualification_fixture'),
  'missing scenario':x=>changeCapture(x,c=>c.scenarioIds=[]),
  'missing frame':x=>changeCapture(x,c=>c.frames=[]),
  'frame traversal':x=>changeCapture(x,c=>c.frames[0].path='../frame.png'),
  'wrong capture workflow':x=>x.captureRun.path='.github/workflows/candidate.yml',
  'candidate source capture':x=>x.captureRun.head_sha=x.currentCandidate.headSha,
  'candidate event capture':x=>x.captureRun.event='pull_request',
  'wrong repository ID':x=>x.captureRun.repository.id++,
  'failed capture':x=>x.captureRun.conclusion='failure',
  'retried capture':x=>x.captureRun.run_attempt++,
  'wrong job':x=>x.captureJobs.jobs[0].id++,
  'duplicate jobs':x=>x.captureJobs.jobs.push({...x.captureJobs.jobs[0]}),
  'wrong job attempt':x=>x.captureJobs.jobs[0].run_attempt++,
  'wrong runner group':x=>x.captureJobs.jobs[0].runner_group_id++,
  'wrong runner labels':x=>x.captureJobs.jobs[0].labels=['ubuntu-latest'],
  'expired artifact':x=>x.captureArtifact.expired=true,
  'wrong artifact':x=>x.captureArtifact.workflow_run.id++,
  'wrong artifact name':x=>x.captureArtifact.name='candidate-supplied',
  'stale capture':x=>x.now='2026-09-07T10:15:00Z',
  'review predates capture':x=>x.review.submitted_at='2026-09-06T09:00:00Z',
  'review from future':x=>x.review.submitted_at='2026-09-07T10:00:00Z',
  'dismissed review':x=>x.review.state='DISMISSED',
  'changes requested':x=>x.review.state='CHANGES_REQUESTED',
  'wrong review head':x=>x.review.commit_id=sha('d'),
  'wrong review PR association':x=>x.review.pull_request_url='https://api.github.com/repos/Example/Atlas/pulls/8',
  'read-only reviewer':x=>{x.reviewerPermission.permission='read';x.reviewerPermission.role_name='read';},
  'write-only reviewer':x=>{x.reviewerPermission.permission='write';x.reviewerPermission.role_name='write';},
  'permission actor drift':x=>x.reviewerPermission.user={id:6,login:'another'},
  'unopened frames':x=>changeDecision(x,d=>d.reviewedAllFrames=false),
  'wrong capture digest':x=>changeDecision(x,d=>d.captureDigest=hash('a')),
  'wrong summary digest':x=>changeDecision(x,d=>d.summaryDigest=hash('a')),
  'wrong reviewer assertion':x=>changeDecision(x,d=>d.reviewer.id++),
  'incomplete frame review':x=>changeDecision(x,d=>d.frames=[]),
  'failed frame review':x=>changeDecision(x,d=>d.frames[0].result='FAIL'),
  'self-authorizing extra policy':x=>changeDecision(x,d=>d.allowedScope=['*']),
  'plain manual green':x=>x.review.body='GREEN',
}))test(`${name} rejects published review evidence`,()=>assert.throws(()=>module.validateProtectedReviewEvidence((x=>{mutate(x);return x;})(fixture()))));

test('private byte substitution fails even when the public capture declares valid digests',()=>{
  const input=fixture();input.files[1].bytes=Buffer.from('substituted');assert.throws(()=>module.validateProtectedVisualCapture(input));
});
test('private capture rejects missing files and unexpected public frame paths',()=>{
  const input=fixture();input.files.pop();assert.throws(()=>module.validateProtectedVisualCapture(input));
});
test('private summary rejects retries and incomplete test census',()=>{
  for(const mutate of [s=>s.scenarios[0].retry=1,s=>s.scenarios=[],s=>s.metadata.workers=2,s=>s.scenarios[0].status='skipped']){
    const input=fixture();const summary=JSON.parse(input.files[0].bytes);mutate(summary);input.files[0].bytes=Buffer.from(JSON.stringify(summary));changeCapture(input,c=>c.summary.digest=digest(input.files[0].bytes));assert.throws(()=>module.validateProtectedVisualCapture(input));
  }
});
test('latest exact review supersedes older approval, including revocation',()=>{
  assert.equal(typeof module.selectLatestProtectedReview,'function');
  const input=fixture(),newer={...input.review,id:46,state:'DISMISSED',submitted_at:'2026-09-06T10:11:00Z'};
  assert.equal(module.selectLatestProtectedReview([input.review,newer],input.currentCandidate).id,46);
  assert.throws(()=>module.validateProtectedReviewEvidence({...input,review:module.selectLatestProtectedReview([input.review,newer],input.currentCandidate)}));
});
test('protected fixture frames may be captured by the configured GitHub-hosted job',()=>{
  const input=fixture();input.authority.dataCapability='qualification_fixture';input.authority.runnerKind='github-hosted';input.authority.runnerLabels=['ubuntu-24.04'];input.captureJobs.jobs[0].labels=['ubuntu-24.04'];
  changeCapture(input,c=>c.dataCapability='qualification_fixture');changeDecision(input,d=>d.captureDigest=digest(input.captureBytes));
  assert.equal(module.validateProtectedReviewEvidence(input).accepted,true);
});
test('verified bounded capture follows explicit protected hosted placement without inventing a new restriction',()=>{
  const input=fixture();input.authority.runnerKind='github-hosted';input.authority.runnerLabels=['ubuntu-24.04'];input.captureJobs.jobs[0].labels=['ubuntu-24.04'];
  assert.equal(module.validateProtectedReviewEvidence(input).accepted,true);
});
test('one authenticated review bundle validates its exact complete capture set without rewritten review bodies',()=>{
  assert.equal(typeof module.validateProtectedReviewBundle,'function');
  const input=fixture(),decision=JSON.parse(input.review.body);
  input.review.body=JSON.stringify({schemaVersion:1,kind:'protected-visual-review-bundle',candidate:input.currentCandidate,captures:[decision]});
  input.captures=[{authority:input.authority,captureBytes:input.captureBytes}];
  assert.equal(module.validateProtectedReviewBundle(input).accepted,true);
  for(const mutate of [b=>b.captures=[],b=>b.captures.push(decision),b=>b.captures[0].captureDigest=hash('a'),b=>b.allowedScope=['*']]){
    const changed=structuredClone(input),body=JSON.parse(input.review.body);mutate(body);changed.review.body=JSON.stringify(body);
    // Preserve raw Buffer identity while cloning the untrusted review body.
    changed.captures=input.captures;assert.throws(()=>module.validateProtectedReviewBundle(changed));
  }
});
test('each protected frame ID is required independently of its scenario ID',()=>{
  const input=fixture();input.authority.requiredFrames.push({frameId:'second-full-frame',scenarioId});
  assert.throws(()=>module.validateProtectedReviewEvidence(input));
});
test('protected review may cover a subset of a complete larger passing summary',()=>{
  const input=fixture();const summary=JSON.parse(input.files[0].bytes),other={...summary.scenarios[0],scenario:'another scenario',stableTestId:'desktop-chromium::e2e/tests/visual-desktop.spec.mjs::another scenario'};
  summary.scenarios.push(other);input.authority.summaryScenarioIds.push(other.stableTestId);
  input.files[0].bytes=Buffer.from(JSON.stringify(summary));changeCapture(input,c=>c.summary.digest=digest(input.files[0].bytes));
  assert.equal(module.validateProtectedVisualCapture(input).accepted,true);
  summary.scenarios[1].status='failed';input.files[0].bytes=Buffer.from(JSON.stringify(summary));changeCapture(input,c=>c.summary.digest=digest(input.files[0].bytes));
  assert.throws(()=>module.validateProtectedVisualCapture(input));
});
test('live hosted group zero and extra artifact API fields are accepted without branch authority',()=>{
  const input=fixture();input.authority.dataCapability='qualification_fixture';input.authority.runnerKind='github-hosted';input.authority.runnerGroupId=0;input.authority.runnerLabels=['ubuntu-24.04'];
  input.captureJobs.jobs[0].labels=['ubuntu-24.04'];input.captureJobs.jobs[0].runner_group_id=0;input.captureArtifact.workflow_run.head_branch='arbitrary/locator';
  changeCapture(input,c=>c.dataCapability='qualification_fixture');changeDecision(input,d=>d.captureDigest=digest(input.captureBytes));
  assert.equal(module.validateProtectedReviewEvidence(input).accepted,true);
});
test('protected pull request target capture requires exact independent PR and repository association',()=>{
  const input=fixture(),c=input.currentCandidate;input.captureRun.event='pull_request_target';input.captureRun.head_sha=c.headSha;
  input.captureRun.pull_requests=[{number:c.prNumber,head:{sha:c.headSha,repo:{id:99}},base:{sha:c.baseSha,repo:{id:99}}}];
  input.captureJobs.jobs[0].head_sha=c.headSha;input.captureArtifact.workflow_run.head_sha=c.headSha;
  assert.equal(module.validateProtectedReviewEvidence(input).accepted,true);
  input.captureRun.pull_requests[0].base.sha=sha('d');assert.throws(()=>module.validateProtectedReviewEvidence(input));
});
test('latest malformed visual review cannot hide behind an older valid decision',()=>{
  const input=fixture(),newer={...input.review,id:46,submitted_at:'2026-09-06T10:11:00Z',body:'protected-visual-review invalid JSON'};
  assert.equal(module.selectLatestProtectedReview([newer,input.review],input.currentCandidate).id,46);
  assert.throws(()=>module.validateProtectedReviewEvidence({...input,review:module.selectLatestProtectedReview([newer,input.review],input.currentCandidate)}));
});
test('unrelated review discussion does not constitute a new visual decision',()=>{
  const input=fixture(),newer={...input.review,id:46,submitted_at:'2026-09-06T10:11:00Z',body:'Unrelated code discussion'};
  assert.equal(module.selectLatestProtectedReview([input.review,newer],input.currentCandidate).id,44);
  assert.throws(()=>module.selectLatestProtectedReview([input.review,input.review],input.currentCandidate));
});
test('review contract has no repository PR branch or head allowlist',()=>{
  const input=fixture(),c=input.currentCandidate;c.repository='Another/Repository';c.prNumber=932;c.headSha=sha('9');
  changeCapture(input,capture=>capture.candidate=c);changeDecision(input,decision=>{decision.candidate=c;decision.captureDigest=digest(input.captureBytes);});
  input.captureRun.repository.full_name=c.repository;input.captureArtifact.workflow_run.head_branch='future/arbitrary';
  input.review.commit_id=c.headSha;input.review.pull_request_url=`https://api.github.com/repos/${c.repository}/pulls/${c.prNumber}`;
  assert.equal(module.validateProtectedReviewEvidence(input).accepted,true);
});
test('private shadow integrity may use an honest null PR but cannot claim published acceptance',()=>{
  const input=fixture();input.currentCandidate.prNumber=null;input.executionKind='shadow';changeCapture(input,c=>c.candidate=input.currentCandidate);
  const result=module.validateProtectedVisualCapture(input);
  assert.equal(result.executionKind,'shadow');assert.equal(result.integrityVerified,true);assert.equal(Object.hasOwn(result,'accepted'),false);
  assert.throws(()=>module.validateProtectedReviewEvidence(input));
  delete input.executionKind;assert.throws(()=>module.validateProtectedVisualCapture(input));
});
test('serialized acceptance is not an independently validated in-process bundle',()=>{
  const input=fixture();assert.throws(()=>module.assertProtectedReviewBundle({accepted:true},input.currentCandidate,[JSON.parse(input.captureBytes)]));
});

function currentFrameCaptureFixtures() {
  const read=name=>JSON.parse(fs.readFileSync(new URL(`../../tools/verification/${name}`,import.meta.url),'utf8'));
  const contract=read('protected-visual-capture-contract.json');
  const plan=evaluateProtectedRouting({candidate:fixture().currentCandidate,manifest:read('impact-manifest.json'),catalog:read('verification-catalog.json'),census:read('full-safety-net-stable-ids.json'),inventory:read('protected-scenario-inventory.json'),routing:read('protected-routing.json'),forceFull:true});
  assert.equal(contract.requiredFrames.length,17);
  assert.equal(new Set(plan.review.flatMap(row=>row.scenarioIds)).size,5);
  return plan.hostedPartitions.flatMap(partition=>{
    const requiredFrames=contract.requiredFrames.filter(frame=>partition.scenarioIds.includes(frame.stableTestId)).map(({frameId,stableTestId})=>({frameId,scenarioId:stableTestId}));
    if(!requiredFrames.length)return [];
    const input=fixture(),reviewIds=plan.review.filter(row=>row.dataCapability===partition.dataCapability).flatMap(row=>row.scenarioIds);
    const ids=[...new Set([...reviewIds,...requiredFrames.map(frame=>frame.scenarioId)])].sort();
    Object.assign(input.authority,{dataCapability:partition.dataCapability,scenarioIds:ids,summaryScenarioIds:partition.scenarioIds,requiredFrames,planDigest:plan.semanticDigest});
    const summary=Buffer.from(JSON.stringify({status:'passed',metadata:{expectedRevision:input.currentCandidate.headSha,workers:1},scenarios:partition.scenarioIds.map(stableTestId=>{
      const [project,specPath,...title]=stableTestId.split('::');return {stableTestId,project,specPath,scenario:title.join('::'),status:'passed',retry:0};
    })}));
    const frames=requiredFrames.map(frame=>({...frame,path:`frames/${frame.frameId}.png`,bytes:Buffer.from(`contract fixture bytes for ${frame.frameId}`)}));
    input.files=[{path:'summary.json',bytes:summary},...frames.map(({path,bytes})=>({path,bytes}))];
    changeCapture(input,c=>Object.assign(c,{planDigest:plan.semanticDigest,dataCapability:partition.dataCapability,scenarioIds:ids,summary:{path:'summary.json',digest:digest(summary)},frames:frames.map(({bytes,...frame})=>({...frame,digest:digest(bytes)}))}));
    return [input];
  });
}
test('current 17 protected frames cover their owners while all five review scenarios remain required',()=>{
  const inputs=currentFrameCaptureFixtures();
  assert.equal(inputs.reduce((count,input)=>count+input.authority.requiredFrames.length,0),17);
  assert.equal(inputs.reduce((count,input)=>count+input.authority.scenarioIds.filter(id=>!input.authority.requiredFrames.some(frame=>frame.scenarioId===id)).length,0),2);
  for(const input of inputs)assert.equal(module.validateProtectedVisualCapture(input).accepted,true);
});
test('current frame ownership contract still rejects any missing protected frame',()=>{
  for(const input of currentFrameCaptureFixtures()){
    changeCapture(input,c=>c.frames.pop());input.files.pop();
    assert.throws(()=>module.validateProtectedVisualCapture(input));
  }
});
test('review scenarios without frame ownership still require passing summary evidence',()=>{
  const input=currentFrameCaptureFixtures().find(input=>input.authority.scenarioIds.some(id=>!input.authority.requiredFrames.some(frame=>frame.scenarioId===id)));
  const id=input.authority.scenarioIds.find(id=>!input.authority.requiredFrames.some(frame=>frame.scenarioId===id));
  const summary=JSON.parse(input.files[0].bytes);summary.scenarios=summary.scenarios.filter(row=>row.stableTestId!==id);
  input.files[0].bytes=Buffer.from(JSON.stringify(summary));changeCapture(input,c=>c.summary.digest=digest(input.files[0].bytes));
  assert.throws(()=>module.validateProtectedVisualCapture(input));
});
