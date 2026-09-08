import {createHash} from 'node:crypto';
import {canonicalJson, validateVerificationCatalog} from './verification-plan-schema.mjs';
import {buildVerificationPlan, assertPlanExecutable} from './build-verification-plan.mjs';
import {deriveVerificationMetadata} from './verification-metadata.mjs';
import {resolveDeterministicCommands} from './deterministic-execution.mjs';
import {resolveBrowserExecution} from './browser-execution.mjs';
import {validateProtectedReviewBundle, selectLatestProtectedReview} from './protected-review-evidence.mjs';
import {assertExecutionProducer} from './execution-producer.mjs';

const reviewReceipts = new WeakSet();
const fail = message => { throw new TypeError(`execution contract: ${message}`); };
const equal = (left,right,label) => { if(canonicalJson(left)!==canonicalJson(right)) fail(`${label} mismatch`); };
const hash = value => `sha256:${createHash('sha256').update(canonicalJson(value)).digest('hex')}`;
const sha = value => /^[a-f0-9]{40}$/.test(value ?? '');
const digest = value => /^sha256:[a-f0-9]{64}$/.test(value ?? '');
const freeze = value => {if(value && typeof value==='object' && !Object.isFrozen(value)){Object.values(value).forEach(freeze);Object.freeze(value);}return value;};

function normalizedSnapshot(value) {
  if(!value || value.repository!=='Oteryn/Oteryn-Atlas' || !['headSha','baseSha','treeSha'].every(key=>sha(value[key]))) fail('candidate readback identity');
  if(value.prNumber!==null && (!Number.isSafeInteger(value.prNumber)||value.prNumber<1)) fail('candidate readback PR');
  if(!Array.isArray(value.changedFiles)||!value.changedFiles.length) fail('candidate readback changed-file census');
  const seen=new Set();
  const changedFiles=value.changedFiles.map(row=>{
    if(!row || !['added','modified','removed','renamed'].includes(row.status)) fail('candidate readback status');
    if((row.status==='renamed') !== (typeof row.previousPath==='string')) fail('candidate readback rename');
    for(const path of [row.path,row.previousPath].filter(path=>path!==undefined)) if(typeof path!=='string'||path.startsWith('/')||path.includes('\\')||path.split('/').some(x=>!x||x==='.'||x==='..')) fail('candidate readback path');
    if(seen.has(row.path)) fail('candidate readback duplicate path');seen.add(row.path);
    return {path:row.path,status:row.status,...(row.previousPath?{previousPath:row.previousPath}:{})};
  }).sort((a,b)=>a.path.localeCompare(b.path));
  return {repository:value.repository,prNumber:value.prNumber,headSha:value.headSha,baseSha:value.baseSha,treeSha:value.treeSha,changedFiles};
}

export function assertCandidateReadback({planned,current,sourceRepository,sourceRef,sourceRevision}) {
  const expected=normalizedSnapshot(planned),actual=normalizedSnapshot(current);
  if(sourceRepository!==expected.repository||sourceRef!=='refs/heads/main'||sourceRevision!==expected.baseSha) fail('protected source identity');
  equal(actual,expected,'candidate readback');return true;
}

export function classifyProductEvent({eventName,action}) {
  if(eventName==='pull_request_review'&&['submitted','edited','dismissed'].includes(action)) return 'authority-only';
  if(['pull_request','pull_request_target'].includes(eventName)) {
    if(['opened','synchronize','reopened','ready_for_review'].includes(action)) return 'product';
    if(['edited','labeled','unlabeled','review_requested','review_request_removed','converted_to_draft','closed'].includes(action)) return 'authority-only';
  }
  if(eventName==='merge_group'&&action==='checks_requested') return 'product';
  fail('unsupported product event');
}

export function assertExecutionWindow({before,after,startedAt,completedAt,timeoutSeconds,retries}) {
  if(retries!==0) fail('retries must remain zero');
  if(!Number.isSafeInteger(timeoutSeconds)||timeoutSeconds<1||timeoutSeconds>86400) fail('execution budget');
  const start=Date.parse(startedAt),end=Date.parse(completedAt);
  if(!Number.isFinite(start)||!Number.isFinite(end)||end<start||end-start>timeoutSeconds*1000) fail('execution budget exceeded or invalid clock');
  equal(normalizedSnapshot(before),normalizedSnapshot(after),'execution identity');return true;
}

export function sealExecutionContract(value) {
  if(!value || value.schemaVersion!==1 || !value.identity || !Array.isArray(value.commands)||!Array.isArray(value.reviews)||!Array.isArray(value.groups)) fail('contract shape');
  if(Object.keys(value.identity).sort().join(',')!==['repository','headSha','protectedBaseSha','treeSha','candidateDigest','planDigest','policyDigest','environmentDigest'].sort().join(',')||value.identity.repository!=='Oteryn/Oteryn-Atlas'||!sha(value.identity.headSha)||!sha(value.identity.protectedBaseSha)||!sha(value.identity.treeSha)||!digest(value.identity.candidateDigest)||!digest(value.identity.planDigest)||!digest(value.identity.policyDigest)||!/^[a-f0-9]{64}$/.test(value.identity.environmentDigest??'')) fail('contract identity');
  if(value.retries!==0) fail('contract retries');
  if(!Number.isSafeInteger(value.maxEvidenceAgeMs)||value.maxEvidenceAgeMs<1) fail('contract evidence lifetime');
  const policy=value.producerPolicy;
  if(!policy||!Number.isSafeInteger(policy.repositoryId)||policy.repositoryId<1||typeof policy.workflowPath!=='string'||!/^\.github\/workflows\/[a-z0-9-]+\.yml$/.test(policy.workflowPath)||typeof policy.jobName!=='string'||!policy.jobName||!['pull_request_target','merge_group'].includes(policy.event)) fail('contract protected producer policy');

  if(new Set(value.commands.map(c=>c.id)).size!==value.commands.length || new Set(value.groups.map(g=>g.id)).size!==value.groups.length) fail('contract duplicate command/group');
  for(const command of value.commands) {
    if(!digest(command.id)||!Array.isArray(command.expectedTestIds)||!command.expectedTestIds.length||new Set(command.expectedTestIds).size!==command.expectedTestIds.length) fail('contract exact test census');
    if(!Array.isArray(command.argv)||!command.argv.length||!Number.isSafeInteger(command.timeoutSeconds)||command.timeoutSeconds<1) fail('contract executable command');
  }
  for(const group of value.groups) {
    if(!Array.isArray(group.commandIds)||!group.commandIds.length||group.commandIds.some(id=>!value.commands.some(c=>c.id===id))) fail('contract group command conservation');
  }
  for(const review of value.reviews) {
    if(!Array.isArray(review.frames)||!review.frames.length||!Array.isArray(review.commandIds)||!review.commandIds.length||review.commandIds.some(id=>!value.commands.some(c=>c.id===id))) fail('contract visual conservation');
  }
  const copy=structuredClone(value);delete copy.contractDigest;
  return freeze({...copy,contractDigest:hash(copy)});
}

// Evidence and producer metadata are separate inputs. The protected caller must
// fetch producer records and artifact bytes from GitHub, not candidate files.
export function validateGroupEvidence({contract,evidence,producer,artifactBytes,now}) {
  equal(sealExecutionContract(contract),contract,'sealed contract');
  const command=contract.commands.find(c=>c.id===evidence?.commandId);
  if(!command) fail('unexpected command evidence');
  equal(evidence.contractDigest,contract.contractDigest,'evidence contract');
  equal(evidence.identity,contract.identity,'evidence candidate');
  if(evidence.status!=='passed'||evidence.exitCode!==0||evidence.attempt!==1) fail('failed/skipped/retried proof');
  if(!digest(evidence.logDigest)||!Array.isArray(evidence.tests)) fail('missing execution evidence');
  equal(evidence.tests.map(x=>x.id).sort(),[...command.expectedTestIds].sort(),'exact test evidence census');
  if(evidence.tests.some(x=>x.status!=='passed'||x.attempt!==1)) fail('required test failed/skipped/retried');
  const p=assertExecutionProducer(producer,{contract,commandId:command.id,artifactBytes}), clock=Date.parse(now),completed=Date.parse(evidence.completedAt),started=Date.parse(evidence.startedAt);
  if(!p||p.repository!==contract.identity.repository||p.headSha!==contract.identity.headSha||p.sourceSha!==contract.identity.protectedBaseSha||p.status!=='completed'||p.conclusion!=='success'||p.runAttempt!==1) fail('untrusted producer identity');
  if(!Number.isSafeInteger(p.runId)||p.runId<1||!Number.isSafeInteger(p.jobId)||p.jobId<1||!digest(p.artifactDigest)) fail('untrusted producer artifact');
  equal({repositoryId:p.repositoryId,workflowPath:p.workflowPath,jobName:p.jobName,event:p.event},contract.producerPolicy,'producer protected workflow');
  if(p.sourceRef!=='refs/heads/main'||p.headRepositoryId!==p.repositoryId||p.baseRepositoryId!==p.repositoryId||p.baseSha!==contract.identity.protectedBaseSha) fail('producer source/PR association');
  equal(evidence.producer,{runId:p.runId,jobId:p.jobId,artifactDigest:p.artifactDigest},'producer association');
  if(!Buffer.isBuffer(artifactBytes)&&typeof artifactBytes!=='string') fail('raw execution artifact bytes required');
  const actualDigest='sha256:'+createHash('sha256').update(artifactBytes).digest('hex');
  equal(actualDigest,p.artifactDigest,'downloaded artifact digest');
  const {producer:association,...report}=evidence;
  equal(JSON.parse(artifactBytes.toString()),report,'downloaded artifact report');
  if(!Number.isFinite(clock)||!Number.isFinite(completed)||!Number.isFinite(started)||started>completed||completed>clock||clock-completed>contract.maxEvidenceAgeMs||completed-started>command.timeoutSeconds*1000) fail('stale or over-budget evidence');
  return freeze({commandId:command.id,accepted:true});
}

export function evaluateFanIn({contract,evidence,producers={},artifacts={},reviews=[],reviewAuthorizations={},now}) {
  equal(sealExecutionContract(contract),contract,'sealed contract');
  if(!Array.isArray(evidence)) fail('evidence array missing');
  const seen=new Set();
  for(const row of evidence) {
    if(seen.has(row.commandId)) fail('duplicate command evidence');seen.add(row.commandId);
    validateGroupEvidence({contract,evidence:row,producer:producers[row.commandId],artifactBytes:artifacts[row.commandId],now});
  }
  const missingCommands=contract.commands.filter(c=>!seen.has(c.id)).map(c=>c.id);
  if(missingCommands.length) return freeze({status:'BLOCKED',missingCommands,missingReviews:[]});
  const required=contract.reviews.flatMap(review=>review.frames.map(frame=>({...frame,groupId:review.groupId})));
  const reviewed=new Set();
  for(const review of reviews) {
    const expected=required.find(frame=>frame.frameId===review.frameId&&frame.groupId===review.groupId);
    if(!expected||reviewed.has(`${review.groupId}:${review.frameId}`)) fail('unexpected/duplicate visual review');
    equal(review.contractDigest,contract.contractDigest,'visual contract');equal(review.identity,contract.identity,'visual identity');
    if(review.status!=='approved'||review.independent!==true||typeof review.reviewer!=='string'||!review.reviewer.trim()||!digest(review.screenshotDigest)||!digest(review.playwrightResultDigest)||review.stableTestId!==expected.stableTestId) fail('restricted visual review missing');
    const authorization=reviewAuthorizations[review.reviewId];
    if(!authorization||!reviewReceipts.has(authorization)||authorization.status!=='approved'||authorization.independent!==true||authorization.reviewer!==review.reviewer||authorization.contractDigest!==contract.contractDigest||authorization.frameId!==review.frameId||authorization.screenshotDigest!==review.screenshotDigest||authorization.playwrightResultDigest!==review.playwrightResultDigest) fail('unauthenticated restricted reviewer');
    const capture=evidence.filter(row=>contract.reviews.some(r=>r.groupId===review.groupId&&r.commandIds.includes(row.commandId))).flatMap(row=>row.captures??[]).find(frame=>frame.frameId===review.frameId);
    if(!capture||capture.screenshotDigest!==review.screenshotDigest||capture.playwrightResultDigest!==review.playwrightResultDigest||capture.stableTestId!==review.stableTestId) fail('visual capture/review binding');
    reviewed.add(`${review.groupId}:${review.frameId}`);
  }
  const missingReviews=required.filter(frame=>!reviewed.has(`${frame.groupId}:${frame.frameId}`)).map(frame=>frame.frameId);
  return freeze({status:missingReviews.length?'BLOCKED':'PASS',missingCommands:[],missingReviews});
}

// Only a protected-base caller may supply policy, census and source authority.
// Candidate metadata can widen the plan, but cannot supply executable commands.
export function resolveExecutionContract({root, candidate, planInput, claimedPlan,
  protectedCatalog, protectedImpactManifest, protectedStableTestIds,
  environmentDigest, publicationProofs, protectedExpectedAuthorities, producerPolicy}) {
  const snapshot=normalizedSnapshot(candidate);
  if(!/^[a-f0-9]{64}$/.test(environmentDigest??'')) fail('environment digest');
  if(planInput?.repository!==snapshot.repository || planInput.headSha!==snapshot.headSha || planInput.integrationBaseSha!==snapshot.baseSha) fail('plan candidate identity');
  equal(planInput.changedFiles,snapshot.changedFiles,'plan candidate changed files');
  const plan=buildVerificationPlan({...planInput,trustedVerificationCatalog:protectedCatalog,
    trustedImpactManifest:protectedImpactManifest,protectedStableTestIds,stableTestIds:undefined});
  if(claimedPlan) equal(claimedPlan,plan,'recomputed plan');
  assertPlanExecutable(plan);
  const metadata=deriveVerificationMetadata(protectedCatalog);
  const protectedGroups=validateVerificationCatalog(protectedCatalog).groups;
  for(const {id,...group} of plan.groups) {
    if(!protectedGroups[id]) fail(`unprotected execution group ${id}`);
    const semantic=value=>Object.fromEntries(Object.entries(value).map(([key,field])=>[key,Array.isArray(field)?[...field].sort():field]));
    equal(semantic(group),semantic(protectedGroups[id]),`protected execution group ${id}`);
  }
  const identity={repository:snapshot.repository,headSha:snapshot.headSha,protectedBaseSha:snapshot.baseSha,
    treeSha:snapshot.treeSha,candidateDigest:hash(snapshot),planDigest:hash(plan),policyDigest:hash({protectedCatalog,protectedImpactManifest,protectedStableTestIds:protectedStableTestIds??[]}),environmentDigest};
  const commands=[],reviews=[],groups=[];
  const deterministic=plan.groups.filter(group=>group.executionEngine==='deterministic').map(group=>group.id);
  if(deterministic.length) {
    const resolved=resolveDeterministicCommands({root,catalog:metadata.deterministic.proposedCatalog,ownership:metadata.deterministic,groupIds:deterministic});
    for(const command of resolved) {
      const groupIds=deterministic.filter(id=>protectedGroups[id].specs.some(spec=>command.coveredSpecs.includes(spec)));
      const entry={argv:[command.interpreter,...command.argv],cwd:'.',engine:'deterministic',groupIds,
        expectedTestIds:command.coveredSpecs,resourceClass:'cpu-light',dataCapability:'qualification_fixture',timeoutSeconds:900};
      commands.push({...entry,id:hash({identity,...entry})});
    }
  }
  const browserIds=plan.groups.filter(group=>group.executionEngine==='playwright').map(group=>group.id);
  if(browserIds.length) {
    if(!Array.isArray(protectedStableTestIds)||!protectedStableTestIds.length) fail('missing protected test census for Playwright execution');
    const resolved=resolveBrowserExecution({protectedRegistry:metadata.browser,requiredGroups:browserIds,
      atlasRevision:snapshot.headSha,protectedBaseSha:snapshot.baseSha,environmentDigest,policyResolved:true,
      publicationProofs,protectedExpectedAuthorities});
    const keys=new Map();
    for(const command of resolved.commands) {
      const prefix=`${command.project}::${command.spec}::`;
      const expectedTestIds=plan.stableTestIds.filter(id=>id.startsWith(prefix));
      if(!expectedTestIds.length) fail(`missing protected test census: ${command.spec}`);
      const entry={argv:command.argv,cwd:command.cwd,engine:'playwright',groupIds:[command.groupId],
        expectedTestIds,resourceClass:command.resourceClass,dataCapability:command.dataCapability,
        publication:command.identity.publication,timeoutSeconds:command.resourceClass==='soak'?14400:3600};
      const id=hash({identity,...entry});keys.set(command.executionKey,id);commands.push({...entry,id});
    }
    for(const review of resolved.reviews) reviews.push({groupId:review.groupId,frames:review.requiredFrames,commandIds:review.machineExecutionKeys.map(key=>keys.get(key))});
  }
  for(const group of plan.groups) {
    const commandIds=group.evidence==='restricted-visual-review'
      ? reviews.find(review=>review.groupId===group.id)?.commandIds
      : commands.filter(command=>command.groupIds.includes(group.id)).map(command=>command.id);
    if(!commandIds?.length) fail(`unresolved execution engine: ${group.id}`);
    groups.push({id:group.id,commandIds});
  }
  return sealExecutionContract({schemaVersion:1,identity,producerPolicy,retries:0,maxEvidenceAgeMs:24*60*60*1000,commands,groups,reviews});
}

// Production fan-in must rebuild the contract from protected policy and current
// candidate readback. A self-consistent candidate-supplied sealed JSON is not authority.
export function evaluateCandidateEvidence({executionInput,evidence,producers,artifacts,reviews,reviewAuthorizations,now}) {
  const contract=resolveExecutionContract(executionInput);
  return evaluateFanIn({contract,evidence,producers,artifacts,reviews,reviewAuthorizations,now});
}

// The caller supplies complete current GitHub records, never candidate JSON.
// This receipt is process-local and cannot be serialized into an authorization.
export function authenticateExecutionReviews({contract, input, currentReviews, candidateAuthorId}) {
  equal(sealExecutionContract(contract),contract,'sealed contract');
  const candidate=normalizedSnapshot(input.currentCandidate);
  if(candidate.repository!==contract.identity.repository||candidate.headSha!==contract.identity.headSha||candidate.baseSha!==contract.identity.protectedBaseSha||candidate.treeSha!==contract.identity.treeSha||hash(candidate)!==contract.identity.candidateDigest) fail('review candidate identity');
  if(!Number.isSafeInteger(candidateAuthorId)||candidateAuthorId<1||input.review?.user?.id===candidateAuthorId) fail('independent reviewer required');
  equal(selectLatestProtectedReview(currentReviews,candidate),input.review,'current review timeline');
  const validated=validateProtectedReviewBundle(input);
  const receipts={};
  for(const group of contract.reviews) for(const expected of group.frames) {
    const matches=input.captures.flatMap(row=>{
      equal(row.authority.planDigest,contract.identity.planDigest,'review plan authority');
      const capture=JSON.parse(row.captureBytes.toString());
      return capture.frames.filter(frame=>frame.frameId===expected.frameId&&frame.scenarioId===expected.stableTestId)
        .map(frame=>({frame,capture}));
    });
    if(matches.length!==1) fail('exact reviewed frame capture');
    const {frame,capture}=matches[0];
    const reviewId=`${validated.reviewId}:${group.groupId}:${frame.frameId}`;
    const receipt=freeze({reviewId,groupId:group.groupId,identity:contract.identity,status:'approved',independent:true,
      reviewer:validated.reviewer.login,contractDigest:contract.contractDigest,frameId:frame.frameId,
      stableTestId:frame.scenarioId,screenshotDigest:frame.digest,playwrightResultDigest:capture.summary.digest});
    reviewReceipts.add(receipt);receipts[reviewId]=receipt;
  }
  return freeze(receipts);
}
