import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {canonicalJson} from './verification-plan-schema.mjs';
import {collectProtectedVisualCapture} from './collect-protected-visual-capture.mjs';
import {protectedReviewDigest,selectLatestProtectedReview,validateProtectedReviewBundle} from './protected-review-evidence.mjs';
import {githubRequest,readCandidateSnapshot} from './protected-candidate-snapshot.mjs';

const ACTIVE='.github/workflows/verification-shadow.yml';
const REVIEW_ARTIFACT_PREFIX='atlas-verification-review';
const REVIEW_MAX_AGE_MS=72*60*60*1000;
const REVIEW_ARTIFACT_MAX_BYTES=96*1024*1024;
const REVIEW_WAIT_MS=25*60*1000;
const REVIEW_POLL_MS=15*1000;
const fail=message=>{throw new TypeError(`verification shadow review: ${message}`);};
const digest=value=>'sha256:'+createHash('sha256').update(canonicalJson(value)).digest('hex');
const same=(left,right)=>canonicalJson(left)===canonicalJson(right);
const exactSha=value=>typeof value==='string'&&/^[a-f0-9]{40}$/.test(value);

function reviewGroup(group) {
  return group?.executionRole==='canonical-review'&&group.executionEngine==='playwright'
    &&group.evidence==='restricted-visual-review'&&group.capabilities?.visualReview===true;
}
function hostedMachine(group) {
  return group?.executionRole==='canonical-machine'&&group.executionEngine==='playwright'
    &&group.evidence==='machine-summary'&&group.capabilities?.visualReview===false;
}

/** The protected plan remains authoritative; this only states what the active R5 executor can truthfully execute. */
export function assertShadowExecutorCoverage(plan) {
  if(!plan||!Array.isArray(plan.groups))fail('protected plan missing');
  for(const group of plan.groups) {
    if(group.executionEngine==='deterministic')continue;
    if(group.id==='integration.source-contract-http') {
      if(!hostedMachine(group)||group.capabilities?.dataCapability!=='bounded_real_world'||group.capabilities?.specialistReason!=null)fail('HTTP source-contract executor drift');
      continue;
    }
    if(reviewGroup(group)) {
      if(group.capabilities?.hosted!==true||group.capabilities?.dataCapability!=='qualification_fixture'||group.capabilities?.specialistReason!=null)fail(`independent review executor unavailable for ${group.id}`);
      continue;
    }
    if(hostedMachine(group)) {
      const capability=group.capabilities?.dataCapability;
      if(group.capabilities?.hosted!==true||group.capabilities?.specialistReason!=null||group.capabilities?.browser!==true)fail(`hosted machine executor unavailable for ${group.id}`);
      if(capability==='qualification_fixture')continue;
      if(capability==='bounded_real_world'&&group.id==='integration.source-contract-browser')continue;
    }
    fail(`R5 executor unavailable for ${group.id}`);
  }
  return true;
}

function safeRelative(relative) {
  if(typeof relative!=='string'||relative.startsWith('/')||relative.includes('\\')||relative.split('/').some(part=>!part||part==='.'||part==='..'))fail('unsafe evidence path');
  return relative;
}
export function normalizeShadowReviewChangedFiles(rows) {
  if(!Array.isArray(rows)||!rows.length)fail('review changed files');
  const normalized=[];
  for(const row of rows) {
    if(!row||typeof row!=='object'||Array.isArray(row))fail('review changed file shape');
    safeRelative(row.path);
    if(row.status==='renamed') {
      safeRelative(row.previousPath);
      normalized.push({path:row.previousPath,status:'removed'},{path:row.path,status:'added'});
    } else {
      if(!['added','modified','removed'].includes(row.status))fail('review changed file status');
      normalized.push({path:row.path,status:row.status});
    }
  }
  if(new Set(normalized.map(row=>row.path)).size!==normalized.length)fail('review changed file collision');
  return normalized.sort((a,b)=>a.path.localeCompare(b.path));
}
function copyEvidenceFile(root,relative,bytes) {
  safeRelative(relative);
  const target=path.join(root,...relative.split('/'));
  fs.mkdirSync(path.dirname(target),{recursive:true});
  fs.writeFileSync(target,bytes,{flag:'wx',mode:0o444});
}

export function shadowReviewFramesForCommand(contract,command) {
  const frames=new Map();
  for(const review of contract?.reviews??[]) {
    if(!Array.isArray(review.commandIds)||!review.commandIds.includes(command.id))continue;
    for(const frame of review.frames??[]) {
      if(typeof frame?.frameId!=='string'||typeof frame?.stableTestId!=='string')fail('review frame shape');
      const current=frames.get(frame.frameId);
      if(current&&current!==frame.stableTestId)fail('review frame owner collision');
      frames.set(frame.frameId,frame.stableTestId);
    }
  }
  return [...frames].map(([frameId,stableTestId])=>({frameId,stableTestId})).sort((a,b)=>a.frameId.localeCompare(b.frameId));
}

/** Review binding is exact-tree portable from PR head to its single-PR Merge Queue commit. */
export function shadowReviewPlanDigest(candidate,contract) {
  if(!candidate||!exactSha(candidate.baseSha)||!exactSha(candidate.treeSha)||!Array.isArray(candidate.changedFiles))fail('review candidate identity');
  return digest({schemaVersion:1,repository:candidate.repository,baseSha:candidate.baseSha,treeSha:candidate.treeSha,
    changedFiles:normalizeShadowReviewChangedFiles(candidate.changedFiles),
    commands:(contract.commands??[]).map(({id,...command})=>command),
    reviews:(contract.reviews??[]).map(review=>({groupId:review.groupId,frames:review.frames})),
    groups:(contract.groups??[]).map(group=>group.id)});
}

export function shadowOracleDigest(root) {
  const base=path.resolve(root),hash=createHash('sha256');
  const walk=(directory,prefix)=>{
    for(const name of fs.readdirSync(directory).sort()) {
      if(name==='node_modules'||name==='.git')continue;
      const absolute=path.join(directory,name),relative=path.posix.join(prefix,name),stat=fs.lstatSync(absolute);
      if(stat.isSymbolicLink())fail('oracle symlink');
      if(stat.isDirectory())walk(absolute,relative);
      else if(stat.isFile())hash.update(relative+'\0').update(fs.readFileSync(absolute)).update('\0');
      else fail('oracle special file');
    }
  };
  walk(path.join(base,'e2e'),'e2e');
  return 'sha256:'+hash.digest('hex');
}

export function shadowReviewArtifactName(runId) {
  if(!Number.isSafeInteger(runId)||runId<1)fail('run id');
  return `${REVIEW_ARTIFACT_PREFIX}-${runId}-1`;
}

export function persistShadowReviewCapture({artifactRoot,evidenceRoot,currentCandidate,command,contract,publication,producer,oracleDigest}) {
  const frames=shadowReviewFramesForCommand(contract,command);
  if(!frames.length)return null;
  if(command.dataCapability!=='qualification_fixture')fail('review capture requires qualification fixture');
  if(!path.isAbsolute(evidenceRoot??''))fail('review evidence root');
  const requiredFrames=frames.map(({frameId,stableTestId})=>({frameId,scenarioId:stableTestId}));
  const scenarioIds=[...new Set(requiredFrames.map(frame=>frame.scenarioId))].sort();
  const authority={protectedBaseSha:currentCandidate.baseSha,workflowPath:ACTIVE,
    planDigest:shadowReviewPlanDigest(currentCandidate,contract),oracleDigest,productDigest:publication.manifest.productDigest,
    dataCapability:command.dataCapability,scenarioIds,summaryScenarioIds:command.expectedTestIds,requiredFrames};
  const {capture,files}=collectProtectedVisualCapture({artifactRoot,currentCandidate,authority,producer});
  const captureBytes=Buffer.from(canonicalJson(capture));
  const captureDigest=protectedReviewDigest(captureBytes);
  fs.mkdirSync(evidenceRoot,{recursive:true});
  const relativeRoot=`capture-${captureDigest.slice('sha256:'.length,'sha256:'.length+20)}`;
  const destination=path.join(evidenceRoot,relativeRoot);
  if(fs.existsSync(destination))fail('duplicate review capture');
  fs.mkdirSync(destination);
  copyEvidenceFile(destination,'capture.json',captureBytes);
  for(const file of files)copyEvidenceFile(destination,file.path,file.bytes);
  return {captureDigest,relativeRoot,frames:capture.frames,dataCapability:command.dataCapability,summaryScenarioIds:[...command.expectedTestIds]};
}

export function assertShadowReviewCaptureCensus(contract,results) {
  const expected=new Map();
  for(const review of contract?.reviews??[])for(const frame of review.frames??[]) {
    const current=expected.get(frame.frameId);
    if(current&&current!==frame.stableTestId)fail('expected review frame collision');
    expected.set(frame.frameId,frame.stableTestId);
  }
  const observed=new Map();
  for(const result of results??[])for(const frame of result.reviewCapture?.frames??[]) {
    const current=observed.get(frame.frameId);
    if(current&&current!==frame.scenarioId)fail('observed review frame collision');
    observed.set(frame.frameId,frame.scenarioId);
  }
  if(!same([...observed].sort(),[...expected].sort()))fail('review capture census incomplete');
  return true;
}

async function pages(request,endpoint,key=null,maximumPages=20) {
  const values=[];
  for(let page=1;page<=maximumPages;page++) {
    const join=endpoint.includes('?')?'&':'?';
    const response=await request(`${endpoint}${join}per_page=100&page=${page}`);
    const rows=key?response?.[key]:response;
    if(!Array.isArray(rows))fail(`invalid paginated response ${endpoint}`);
    values.push(...rows);
    if(rows.length<100)return values;
  }
  fail(`pagination bound exceeded ${endpoint}`);
}

async function workflowJobs(request,runId) {
  const response=await request(`/repos/Oteryn/Oteryn-Atlas/actions/runs/${runId}/attempts/1/jobs?per_page=100`);
  if(!Array.isArray(response?.jobs)||response.total_count!==response.jobs.length||response.jobs.length>20)fail('workflow job census');
  return response.jobs;
}

export async function currentShadowJobId(runId,name,{request=githubRequest}={}) {
  const jobs=await workflowJobs(request,runId),matches=jobs.filter(job=>job.name===name&&job.run_id===runId&&job.run_attempt===1);
  if(matches.length!==1||matches[0].status!=='in_progress'||matches[0].conclusion!=null||!Number.isSafeInteger(matches[0].id))fail(`current ${name} job identity`);
  return matches[0].id;
}

async function assertCurrentMachineRun(request,runId) {
  const jobs=await workflowJobs(request,runId);
  const unique=name=>{const rows=jobs.filter(job=>job.name===name);if(rows.length!==1)fail(`current ${name} job census`);return rows[0];};
  const plan=unique('plan'),execute=unique('execute'),review=unique('review');
  if(plan.status!=='completed'||plan.conclusion!=='success'||execute.status!=='completed'||execute.conclusion!=='success'||review.status!=='in_progress'||review.conclusion!=null)fail('fresh machine execution not complete');
  return {plan,execute,review,jobs};
}

async function exactReviewCandidate(candidate,request) {
  if(candidate.prNumber!==null)return candidate;
  const pulls=await pages(request,`/repos/${candidate.repository}/pulls?state=open`);
  const candidates=pulls.filter(pr=>pr?.base?.sha===candidate.baseSha&&pr.base?.repo?.full_name===candidate.repository&&pr.head?.repo?.full_name===candidate.repository);
  const matches=[];
  for(const pr of candidates) {
    const current=await readCandidateSnapshot({request,repository:candidate.repository,baseSha:candidate.baseSha,headSha:pr.head.sha,prNumber:pr.number,changedFiles:[]});
    if(current.treeSha===candidate.treeSha&&same(normalizeShadowReviewChangedFiles(current.changedFiles),normalizeShadowReviewChangedFiles(candidate.changedFiles)))matches.push(current);
  }
  if(matches.length!==1)fail('Merge Queue requires unique exact-tree PR association');
  return matches[0];
}

function reviewCaptureDigests(review,candidate) {
  let body;
  try{body=JSON.parse(review.body);}catch{fail('visual review body JSON');}
  if(body?.schemaVersion!==1||body.kind!=='protected-visual-review-bundle'||!same(body.candidate,candidate)||!Array.isArray(body.captures)||!body.captures.length)fail('visual review bundle locator');
  const values=body.captures.map(row=>row?.captureDigest);
  if(values.some(value=>!/^sha256:[a-f0-9]{64}$/.test(value??''))||new Set(values).size!==values.length)fail('visual review capture digest locator');
  return values.sort();
}

export function downloadShadowCaptureArtifact(repository,artifactId) {
  if(!Number.isSafeInteger(artifactId)||artifactId<1)fail('artifact id');
  const zip=execFileSync('gh',['api',`/repos/${repository}/actions/artifacts/${artifactId}/zip`],{maxBuffer:REVIEW_ARTIFACT_MAX_BYTES+8*1024*1024});
  const script=`import base64,io,json,stat,sys,zipfile\nraw=sys.stdin.buffer.read()\nassert len(raw)<=${REVIEW_ARTIFACT_MAX_BYTES}\nz=zipfile.ZipFile(io.BytesIO(raw))\nitems=z.infolist();assert 0<len(items)<=500\nout=[];total=0\nfor i in items:\n p=i.filename.replace('\\\\','/')\n assert p and not p.startswith('/') and '..' not in p.split('/') and not stat.S_ISLNK(i.external_attr>>16)\n assert 0<=i.file_size<=16777216\n total+=i.file_size;assert total<=${REVIEW_ARTIFACT_MAX_BYTES}\n if p.endswith('/capture.json') or p=='capture.json':\n  assert i.file_size<=1048576\n  out.append(base64.b64encode(z.read(i)).decode('ascii'))\nassert out\nprint(json.dumps(out))`;
  const output=execFileSync('python3',['-c',script],{input:zip,encoding:'utf8',maxBuffer:8*1024*1024});
  const rows=JSON.parse(output);
  if(!Array.isArray(rows)||!rows.length||rows.length>50)fail('capture manifest census');
  return rows.map(value=>Buffer.from(value,'base64'));
}

function expectedCaptureAuthorities({candidate,contract,productDigest,oracleDigest,repositoryId,artifactName,liveReview=false,failedReviewGate=false}) {
  const values=[];
  const planDigest=shadowReviewPlanDigest(candidate,contract);
  for(const command of contract.commands??[]) {
    const frames=shadowReviewFramesForCommand(contract,command);
    if(!frames.length)continue;
    if(command.dataCapability!=='qualification_fixture')fail('review command capability');
    const requiredFrames=frames.map(({frameId,stableTestId})=>({frameId,scenarioId:stableTestId}));
    values.push({match:{dataCapability:command.dataCapability,frameIds:requiredFrames.map(row=>row.frameId).sort()},authority:{repositoryId,
      protectedBaseSha:candidate.baseSha,workflowPath:ACTIVE,jobName:'execute',artifactName,runnerKind:'github-hosted',runnerGroupId:0,runnerLabels:['ubuntu-24.04'],
      maxAgeMs:REVIEW_MAX_AGE_MS,...(liveReview?{allowInProgressReviewGate:true,reviewGateJobName:'review'}:failedReviewGate?{allowCompletedReviewGateFailure:true,reviewGateJobName:'review'}:{}),planDigest,oracleDigest,productDigest,
      dataCapability:command.dataCapability,scenarioIds:[...new Set(requiredFrames.map(row=>row.scenarioId))].sort(),summaryScenarioIds:command.expectedTestIds,requiredFrames}});
  }
  return values;
}

function pairCaptures(captureBytesList,expected) {
  const unused=[...expected],captures=[];
  for(const captureBytes of captureBytesList) {
    let value;try{value=JSON.parse(captureBytes);}catch{fail('capture manifest JSON');}
    const key={dataCapability:value?.dataCapability,frameIds:Array.isArray(value?.frames)?value.frames.map(row=>row.frameId).sort():[]};
    const matches=unused.flatMap((row,index)=>same(row.match,key)?[index]:[]);
    if(matches.length!==1)fail('capture does not match unique protected review obligation');
    const [row]=unused.splice(matches[0],1);
    captures.push({authority:row.authority,captureBytes});
  }
  if(unused.length)fail('review capture set incomplete');
  return captures;
}

export async function validateShadowReviewGate({candidate,currentRunId,contract,productDigest,oracleDigest,request=githubRequest,downloadArtifact=downloadShadowCaptureArtifact,now=new Date().toISOString()}) {
  await assertCurrentMachineRun(request,currentRunId);
  const currentRun=await request(`/repos/${candidate.repository}/actions/runs/${currentRunId}`);
  if(currentRun?.id!==currentRunId||currentRun.run_attempt!==1||currentRun.path!==ACTIVE||currentRun.status!=='in_progress'||currentRun.conclusion!==null
    ||currentRun.head_sha!==candidate.headSha||currentRun.repository?.full_name!==candidate.repository)fail('current review run identity');
  const reviewCandidate=await exactReviewCandidate(candidate,request);
  if(reviewCandidate.baseSha!==candidate.baseSha||reviewCandidate.treeSha!==candidate.treeSha
    ||!same(normalizeShadowReviewChangedFiles(reviewCandidate.changedFiles),normalizeShadowReviewChangedFiles(candidate.changedFiles)))fail('review candidate tree/base drift');
  const reviews=await pages(request,`/repos/${candidate.repository}/pulls/${reviewCandidate.prNumber}/reviews`);
  const review=selectLatestProtectedReview(reviews,reviewCandidate);
  if(!review)fail('independent visual review required');
  const wanted=reviewCaptureDigests(review,reviewCandidate);
  const runs=await pages(request,`/repos/${candidate.repository}/actions/runs?event=pull_request_target&head_sha=${reviewCandidate.headSha}`,'workflow_runs');
  const prior=runs.filter(run=>run.id<currentRunId&&run.path===ACTIVE&&run.event==='pull_request_target'&&run.run_attempt===1&&run.status==='completed'&&['success','failure'].includes(run.conclusion)
    &&run.head_sha===reviewCandidate.headSha&&Array.isArray(run.pull_requests)&&run.pull_requests.some(pr=>pr.number===reviewCandidate.prNumber&&pr.head?.sha===reviewCandidate.headSha&&pr.base?.sha===reviewCandidate.baseSha))
    .sort((a,b)=>b.id-a.id).slice(0,20);
  const candidates=candidate.prNumber===null?prior:[currentRun,...prior];
  let selected=null;
  for(const run of candidates) {
    const artifacts=await pages(request,`/repos/${candidate.repository}/actions/runs/${run.id}/artifacts`,'artifacts');
    const name=shadowReviewArtifactName(run.id),matches=artifacts.filter(artifact=>artifact.name===name&&!artifact.expired);
    if(matches.length>1)fail('duplicate review artifact');
    if(matches.length!==1)continue;
    const artifact=matches[0];
    if(!Number.isSafeInteger(artifact.size_in_bytes)||artifact.size_in_bytes<1||artifact.size_in_bytes>REVIEW_ARTIFACT_MAX_BYTES)fail('review artifact size');
    const captureBytesList=downloadArtifact(candidate.repository,artifact.id);
    const digests=captureBytesList.map(protectedReviewDigest).sort();
    if(same(digests,wanted)){selected={run,artifact,artifacts,captureBytesList};break;}
  }
  if(!selected)fail('reviewed protected capture artifact not found');
  const run=await request(`/repos/${candidate.repository}/actions/runs/${selected.run.id}`);
  const jobs=await workflowJobs(request,selected.run.id);
  const repo=await request(`/repos/${candidate.repository}`);
  if(repo.full_name!==candidate.repository||!Number.isSafeInteger(repo.id))fail('review repository identity');
  const artifactName=shadowReviewArtifactName(run.id),liveReview=run.id===currentRunId,failedReviewGate=run.status==='completed'&&run.conclusion==='failure';
  const expected=expectedCaptureAuthorities({candidate:reviewCandidate,contract,productDigest,oracleDigest,repositoryId:repo.id,artifactName,liveReview,failedReviewGate});
  const captures=pairCaptures(selected.captureBytesList,expected);
  if(captures.length!==wanted.length)fail('review bundle capture count');
  const login=review.user?.login;
  if(typeof login!=='string'||!/^[A-Za-z0-9-]+$/.test(login))fail('reviewer login');
  const permissionEndpoint=`/repos/${candidate.repository}/collaborators/${encodeURIComponent(login)}/permission`;
  const reviewerPermission=await request(permissionEndpoint);
  const independent=validateProtectedReviewBundle({currentCandidate:reviewCandidate,captures,captureRun:run,captureJobs:{jobs},captureArtifact:selected.artifact,review,reviewerPermission,now});
  const [finalRun,finalJobs,finalReviews,finalPermission,finalArtifacts]=await Promise.all([
    request(`/repos/${candidate.repository}/actions/runs/${run.id}`),workflowJobs(request,run.id),
    pages(request,`/repos/${candidate.repository}/pulls/${reviewCandidate.prNumber}/reviews`),request(permissionEndpoint),
    pages(request,`/repos/${candidate.repository}/actions/runs/${run.id}/artifacts`,'artifacts'),
  ]);
  const finalReview=selectLatestProtectedReview(finalReviews,reviewCandidate);
  if(!finalReview||finalReview.id!==review.id)fail('review decision changed during validation');
  const finalMatches=finalArtifacts.filter(artifact=>artifact.name===artifactName&&!artifact.expired);
  if(finalMatches.length!==1||finalMatches[0].id!==selected.artifact.id)fail('review artifact changed during validation');
  validateProtectedReviewBundle({currentCandidate:reviewCandidate,captures,captureRun:finalRun,captureJobs:{jobs:finalJobs},captureArtifact:finalMatches[0],review:finalReview,reviewerPermission:finalPermission,now});
  return {accepted:true,reviewCandidate,reviewId:independent.reviewId,captureRunId:run.id,captureArtifactId:selected.artifact.id,captureDigests:wanted};
}

const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
export async function waitForShadowReviewGate(options,{maxWaitMs=REVIEW_WAIT_MS,pollMs=REVIEW_POLL_MS,sleepFn=sleep,clock=Date.now}={}) {
  if(!Number.isSafeInteger(maxWaitMs)||maxWaitMs<0||!Number.isSafeInteger(pollMs)||pollMs<1||typeof sleepFn!=='function'||typeof clock!=='function')fail('review wait policy');
  const deadline=clock()+maxWaitMs;
  for(;;) {
    try{return await validateShadowReviewGate(options);}catch(error) {
      const retryable=new Set(['verification shadow review: independent visual review required','verification shadow review: reviewed protected capture artifact not found']);
      if(options?.candidate?.prNumber===null||!retryable.has(error?.message)||clock()>=deadline)throw error;
      await sleepFn(Math.min(pollMs,Math.max(1,deadline-clock())));
    }
  }
}
