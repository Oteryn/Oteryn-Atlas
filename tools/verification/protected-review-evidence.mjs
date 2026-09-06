import crypto from 'node:crypto';
import {canonicalJson} from './verification-plan-schema.mjs';
import {deepFreeze, isPlainObject} from './anti-loop-common.mjs';
import {stableTestId} from './stable-id.mjs';

const fail = reason => { throw new TypeError(`protected visual review: ${reason}`); };
const validatedBundles = new WeakMap();
const equal = (actual, expected, reason) => { if (canonicalJson(actual) !== canonicalJson(expected)) fail(reason); };
const integer = value => { if (!Number.isSafeInteger(value) || value < 1) fail('positive integer required'); return value; };
const hash = value => { if (!/^sha256:[a-f0-9]{64}$/.test(value ?? '')) fail('digest required'); return value; };
const sha = value => { if (!/^[a-f0-9]{40}$/.test(value ?? '')) fail('revision required'); return value; };
const text = value => { if (typeof value !== 'string' || !value.length) fail('text required'); return value; };
function shape(value, keys, label) {
  if (!isPlainObject(value) || Object.keys(value).sort().join(',') !== [...keys].sort().join(',')) fail(`${label} shape`);
  return value;
}
function list(value, label) {
  if (!Array.isArray(value) || !value.length || value.some(item => typeof item !== 'string' || !item.length) || new Set(value).size !== value.length) fail(`${label} census`);
  return [...value].sort();
}
function relative(value) {
  text(value);
  if (value.startsWith('/') || value.includes('\\') || /[\x00-\x1f]/.test(value) || value.split('/').some(part=>!part||part==='.'||part==='..')) fail('unsafe capture path');
  return value;
}
function instant(value) { const result = typeof value === 'string' ? Date.parse(value) : NaN; if (!Number.isFinite(result)) fail('timestamp required'); return result; }
export function protectedReviewDigest(bytes) {
  if (typeof bytes !== 'string' && !Buffer.isBuffer(bytes)) fail('raw evidence bytes required');
  return 'sha256:' + crypto.createHash('sha256').update(bytes).digest('hex');
}
function candidate(value,allowShadow=false) {
  shape(value,['repository','prNumber','headSha','baseSha','treeSha','changedFiles'],'candidate');
  if (!/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(value.repository ?? '')) fail('repository required');
  if(!(allowShadow&&value.prNumber===null))integer(value.prNumber);sha(value.headSha);sha(value.baseSha);sha(value.treeSha);
  if (!Array.isArray(value.changedFiles) || !value.changedFiles.length) fail('complete changed files required');
  const paths=[];
  for(const row of value.changedFiles) {
    shape(row,row.status==='renamed'?['path','status','previousPath']:['path','status'],'changed file');
    relative(row.path);paths.push(row.path);
    if(!['added','modified','removed','renamed'].includes(row.status))fail('changed file status');
    if(row.status==='renamed')relative(row.previousPath);
  }
  if(new Set(paths).size!==paths.length)fail('duplicate changed file');
  return value;
}
function manifest(input,privateCapture=false) {
  const {authority:a,currentCandidate:c,captureBytes}=input;
  if(!isPlainObject(a))fail('protected authority required');
  const shadow=privateCapture&&input.executionKind==='shadow';
  if(shadow&&c?.prNumber!==null)fail('shadow capture must not invent PR association');
  candidate(c,shadow);equal(a.protectedBaseSha,c.baseSha,'protected base drift');
  protectedReviewDigest(captureBytes);
  const value=JSON.parse(captureBytes.toString());
  shape(value,['schemaVersion','kind','candidate','producer','planDigest','oracleDigest','productDigest','dataCapability','scenarioIds','summary','frames'],'capture');
  if(value.schemaVersion!==1||value.kind!=='protected-visual-capture')fail('capture kind');
  equal(candidate(value.candidate,shadow),c,'exact candidate drift');
  for(const key of ['planDigest','oracleDigest','productDigest'])equal(hash(value[key]),hash(a[key]),`${key} drift`);
  if(!['bounded_real_world','qualification_fixture'].includes(a.dataCapability))fail('unsupported capture capability');
  equal(value.dataCapability,a.dataCapability,'capture capability drift');
  equal(list(value.scenarioIds,'capture'),list(a.scenarioIds,'protected'),'capture scenario drift');
  const summaryIds=list(a.summaryScenarioIds,'protected summary');
  if(value.scenarioIds.some(id=>!summaryIds.includes(id)))fail('review scenario absent from protected summary');
  if(!Array.isArray(a.requiredFrames)||!a.requiredFrames.length)fail('protected frame obligations missing');
  for(const frame of a.requiredFrames){shape(frame,['frameId','scenarioId'],'protected frame');text(frame.frameId);if(!value.scenarioIds.includes(frame.scenarioId))fail('protected frame scenario drift');}
  list(a.requiredFrames.map(frame=>frame.frameId),'protected frames');
  shape(value.producer,['workflowPath','sourceSha','runId','jobId','runAttempt'],'capture producer');
  equal(value.producer.workflowPath,text(a.workflowPath),'capture workflow drift');
  equal(sha(value.producer.sourceSha),c.baseSha,'capture protected source drift');
  integer(value.producer.runId);integer(value.producer.jobId);
  if(value.producer.runAttempt!==1)fail('capture retries prohibited');
  shape(value.summary,['path','digest'],'capture summary');relative(value.summary.path);hash(value.summary.digest);
  if(!Array.isArray(value.frames)||!value.frames.length)fail('capture frames missing');
  const framePaths=[],scenarioIds=new Set();
  for(const frame of value.frames) {
    shape(frame,['frameId','scenarioId','path','digest'],'capture frame');text(frame.frameId);
    if(!value.scenarioIds.includes(frame.scenarioId))fail('unknown frame scenario');
    relative(frame.path);hash(frame.digest);framePaths.push(frame.path);scenarioIds.add(frame.scenarioId);
  }
  if(new Set(framePaths).size!==framePaths.length||framePaths.includes(value.summary.path))fail('duplicate capture path');
  equal(value.frames.map(({frameId,scenarioId})=>({frameId,scenarioId})).sort((a,b)=>a.frameId.localeCompare(b.frameId)),[...a.requiredFrames].sort((a,b)=>a.frameId.localeCompare(b.frameId)),'protected frame obligation drift');
  equal([...scenarioIds].sort(),[...new Set(a.requiredFrames.map(frame=>frame.scenarioId))].sort(),'incomplete frame coverage');
  return value;
}

/** Capture host/reviewer operation; this function does not authorize publication.
 * Callers obtain bytes from regular files beneath a fenced capture root and honor
 * the protected data-capability privacy policy for any subsequent transfer.
 * Success proves byte/census integrity; it does not assert that anyone viewed images.
 */
export function validateProtectedVisualCapture(input) {
  const capture=manifest(input,true);
  if(!Array.isArray(input.files))fail('private files required');
  const files=new Map();
  for(const file of input.files) {
    shape(file,['path','bytes'],'private file');relative(file.path);
    if(files.has(file.path))fail('duplicate private file');
    protectedReviewDigest(file.bytes);files.set(file.path,file.bytes);
  }
  const entries=[capture.summary,...capture.frames];
  equal([...files.keys()].sort(),entries.map(row=>row.path).sort(),'complete private files required');
  for(const entry of entries)equal(protectedReviewDigest(files.get(entry.path)),entry.digest,'private bytes drift');
  const summary=JSON.parse(files.get(capture.summary.path).toString());
  if(summary.status!=='passed'||summary.metadata?.expectedRevision!==input.currentCandidate.headSha||summary.metadata?.workers!==1)fail('private summary identity or result');
  if(!Array.isArray(summary.scenarios))fail('private summary scenarios missing');
  const ids=summary.scenarios.map(row=>{
    if(row.status!=='passed'||row.retry!==0)fail('private summary failed, skipped or retried');
    equal(row.stableTestId,stableTestId(row.project,row.specPath,row.scenario),'private summary stable identity');
    return row.stableTestId;
  });
  equal(list(ids,'executed'),list(input.authority.summaryScenarioIds,'protected summary'),'private summary census drift');
  return deepFreeze({...input.executionKind==='shadow'?{executionKind:'shadow',integrityVerified:true}:{accepted:true},captureDigest:protectedReviewDigest(input.captureBytes),summaryDigest:capture.summary.digest});
}

/** Only a protected caller may supply authority and current GitHub API metadata.
 * captureBytes must be the manifest downloaded from captureArtifact, never a
 * candidate file. This public contract deliberately does not require private pixels.
 * The caller must enumerate all review pages and re-read candidate, capture run,
 * jobs, artifact, review timeline and reviewer permission before accepting evidence.
 */
export function validateProtectedReviewEvidence(input) {
  return validateDecision(input,JSON.parse(text(input.review?.body)));
}

function validateDecision(input,decision) {
  const capture=manifest(input),{authority:a,currentCandidate:c,captureRun:run,captureJobs,captureArtifact:artifact,review,reviewerPermission:permission}=input,p=capture.producer;
  if(!isPlainObject(run)||run.id!==p.runId||run.run_attempt!==1||run.path!==a.workflowPath||!['workflow_dispatch','pull_request_target'].includes(run.event)||run.status!=='completed'||run.conclusion!=='success')fail('current protected capture run required');
  equal(run.repository?.full_name,c.repository,'capture repository drift');equal(run.repository?.id,integer(a.repositoryId),'capture repository ID drift');
  if(run.event==='workflow_dispatch')equal(run.head_sha,c.baseSha,'dispatch protected source drift');
  else {
    if(![c.headSha,c.baseSha].includes(run.head_sha))fail('capture run head drift');
    const associations=Array.isArray(run.pull_requests)?run.pull_requests.filter(pr=>pr.number===c.prNumber):[];
    if(associations.length!==1)fail('unique capture PR association required');
    const association=associations[0];
    equal(association.head?.sha,c.headSha,'capture associated head drift');equal(association.base?.sha,c.baseSha,'capture associated base drift');
    for(const side of ['head','base'])equal(association[side]?.repo?.id,a.repositoryId,'capture associated repository drift');
  }
  const jobs=captureJobs?.jobs;if(!Array.isArray(jobs))fail('capture jobs missing');
  const matching=jobs.filter(job=>job.name===a.jobName);
  if(matching.length!==1)fail('unique protected capture job required');
  const job=matching[0];
  if(job.id!==p.jobId||job.run_id!==p.runId||job.run_attempt!==1||job.head_sha!==run.head_sha||job.status!=='completed'||job.conclusion!=='success')fail('capture job identity or result');
  if(!Number.isSafeInteger(a.runnerGroupId)||a.runnerGroupId<0||(a.runnerKind==='self-hosted'&&a.runnerGroupId===0))fail('protected runner group required');
  equal(job.runner_group_id,a.runnerGroupId,'capture runner group drift');
  const labels=list(job.labels,'runner'),required=list(a.runnerLabels,'protected runner');
  if(required.some(label=>!labels.includes(label)))fail('capture runner labels drift');
  if(a.runnerKind==='self-hosted') {if(!required.includes('self-hosted'))fail('private capture runner required');}
  else if(a.runnerKind==='github-hosted') {if(labels.includes('self-hosted'))fail('capture runner kind drift');}
  else fail('protected runner kind required');
  if(!isPlainObject(artifact)||!Number.isSafeInteger(artifact.id)||artifact.id<1||artifact.name!==text(a.artifactName)||artifact.expired!==false)fail('protected capture artifact required');
  for(const [key,value] of Object.entries({id:p.runId,repository_id:a.repositoryId,head_repository_id:a.repositoryId,head_sha:run.head_sha}))equal(artifact.workflow_run?.[key],value,'capture artifact association drift');
  const clock=instant(input.now),started=instant(run.created_at),ended=instant(run.updated_at),jobStarted=instant(job.started_at),jobEnded=instant(job.completed_at);
  integer(a.maxAgeMs);
  if(started>jobStarted||jobStarted>jobEnded||jobEnded>ended||ended>clock||clock-started>a.maxAgeMs)fail('capture freshness');
  if(!isPlainObject(review)||!['COMMENTED','APPROVED'].includes(review.state)||review.commit_id!==c.headSha||review.pull_request_url!==`https://api.github.com/repos/${c.repository}/pulls/${c.prNumber}`)fail('current authenticated review required');
  integer(review.id);integer(review.user?.id);text(review.user?.login);
  const submitted=instant(review.submitted_at);
  if(submitted<ended||submitted>clock)fail('review must follow complete capture');
  if(!isPlainObject(permission)||!((permission.role_name==='admin'&&permission.permission==='admin')||(permission.role_name==='maintain'&&permission.permission==='write')))fail('current reviewer maintainer authority required');
  equal(permission.user?.id,review.user.id,'reviewer permission identity drift');equal(permission.user?.login,review.user.login,'reviewer permission login drift');
  shape(decision,['schemaVersion','kind','candidate','captureDigest','planDigest','summaryDigest','reviewer','reviewedAllFrames','result','frames'],'visual decision');
  if(decision.schemaVersion!==1||decision.kind!=='protected-visual-review'||decision.result!=='PASS'||decision.reviewedAllFrames!==true)fail('explicit complete visual review required');
  equal(candidate(decision.candidate),c,'review candidate drift');equal(hash(decision.captureDigest),protectedReviewDigest(input.captureBytes),'review capture drift');
  equal(hash(decision.planDigest),capture.planDigest,'review plan drift');equal(hash(decision.summaryDigest),capture.summary.digest,'review summary drift');
  shape(decision.reviewer,['id','login'],'reviewer');equal(decision.reviewer,{id:review.user.id,login:review.user.login},'review actor drift');
  if(!Array.isArray(decision.frames))fail('review frame census required');
  for(const frame of decision.frames){shape(frame,['frameId','scenarioId','path','digest','result'],'reviewed frame');if(frame.result!=='PASS')fail('frame review failed');}
  equal([...decision.frames].sort((a,b)=>a.path.localeCompare(b.path)),capture.frames.map(frame=>({...frame,result:'PASS'})).sort((a,b)=>a.path.localeCompare(b.path)),'complete frame review required');
  return deepFreeze({accepted:true,reviewId:review.id,reviewer:{id:review.user.id,login:review.user.login},captureRunId:run.id,captureJobId:job.id,captureArtifactId:artifact.id,captureDigest:protectedReviewDigest(input.captureBytes),summaryDigest:capture.summary.digest,scenarioIds:[...capture.scenarioIds].sort()});
}

/** Validate nested decisions from the original authenticated body, not synthetic reviews. */
export function validateProtectedReviewBundle(input) {
  const body=JSON.parse(text(input.review?.body));
  shape(body,['schemaVersion','kind','candidate','captures'],'review bundle');
  if(body.schemaVersion!==1||body.kind!=='protected-visual-review-bundle')fail('review bundle kind');
  equal(candidate(body.candidate),candidate(input.currentCandidate),'review bundle candidate drift');
  if(!Array.isArray(input.captures)||!input.captures.length||!Array.isArray(body.captures)||body.captures.length!==input.captures.length)fail('complete review bundle required');
  const expected=input.captures.map(capture=>protectedReviewDigest(capture.captureBytes));
  equal(list(body.captures.map(row=>row.captureDigest),'review bundle'),list(expected,'capture bundle'),'review bundle capture drift');
  const captures=input.captures.map(capture=>validateDecision({...input,...capture},body.captures.find(row=>row.captureDigest===protectedReviewDigest(capture.captureBytes))));
  const result=deepFreeze({accepted:true,reviewId:input.review.id,reviewer:captures[0].reviewer,captures});
  validatedBundles.set(result,{candidate:canonicalJson(input.currentCandidate),digests:[...expected].sort()});
  return result;
}

/** In-process authority token; serialized candidate data cannot mint acceptance. */
export function assertProtectedReviewBundle(result,currentCandidate,captures) {
  const bound=validatedBundles.get(result);
  if(!bound)fail('independently validated review bundle required');
  equal(bound.candidate,canonicalJson(candidate(currentCandidate)),'validated review candidate drift');
  if(!Array.isArray(captures))fail('review captures required');
  equal(bound.digests,captures.map(capture=>protectedReviewDigest(canonicalJson(capture))).sort(),'validated review capture drift');
  return result;
}

/** Complete current API review timeline required; never fall back to older GREEN. */
export function selectLatestProtectedReview(reviews,currentCandidate) {
  candidate(currentCandidate);if(!Array.isArray(reviews))fail('complete review timeline required');
  const ids=new Set(),selected=[];
  for(const review of reviews) {
    integer(review.id);if(ids.has(review.id))fail('duplicate review');ids.add(review.id);
    if(review.commit_id!==currentCandidate.headSha||review.pull_request_url!==`https://api.github.com/repos/${currentCandidate.repository}/pulls/${currentCandidate.prNumber}`)continue;
    const relevant=['CHANGES_REQUESTED','DISMISSED'].includes(review.state)||(typeof review.body==='string'&&review.body.includes('protected-visual-review'));
    if(relevant){instant(review.submitted_at);selected.push(review);}
  }
  selected.sort((a,b)=>instant(b.submitted_at)-instant(a.submitted_at)||b.id-a.id);
  return selected[0]??null;
}
