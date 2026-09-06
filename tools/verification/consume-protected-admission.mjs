import { appendFileSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { validateProtectedAdmissionEvidence } from './protected-admission-evidence.mjs';
import { validateStableIdCensus } from './stable-id-census.mjs';
import { canonicalJson } from './verification-plan-schema.mjs';
import { exactSha } from './anti-loop-common.mjs';
import {selectLatestProtectedReview, validateProtectedReviewBundle} from './protected-review-evidence.mjs';

const workflow = '.github/workflows/protected-admission.yml';
function fail(message) { throw new TypeError(`protected admission consumer: ${message}`); }
function same(a, b, label) { if (canonicalJson(a) !== canonicalJson(b)) fail(`${label} changed`); }
async function pages(request, endpoint, key, maximumItems = 10000) {
  const result = [];
  for (let page = 1; ; page++) {
    const response = await request(`${endpoint}${endpoint.includes('?') ? '&' : '?'}per_page=100&page=${page}`);
    const items = key ? response?.[key] : response;
    if (!Array.isArray(items)) fail(`invalid paginated response: ${endpoint}`);
    result.push(...items);
    if (result.length > maximumItems) fail(`pagination exceeds protected bound: ${endpoint}`);
    if (items.length < 100) return result;
  }
}

export function protectedAdmissionScenarioIds(catalog, ids) {
  const group = catalog?.groups?.['e2e.full'];
  if (!group || !Array.isArray(group.specs) || !Array.isArray(group.projects)
    || !Array.isArray(ids) || !ids.length || new Set(ids).size !== ids.length) fail('protected census missing');
  // This transition contract preserves the complete protected census, never a
  // candidate-selected subset. Planner simplification is a separate change.
  if (ids.some(id => {
    const [project, file, ...title] = typeof id === 'string' ? id.split('::') : [];
    return !group.projects.includes(project) || !group.specs.includes(file) || !title.join('::');
  })) fail('protected census/catalog disagreement');
  return [...ids].sort();
}

async function readCandidate({ request, repository, protectedBaseSha }, number, expectedHead) {
  const prefix = `/repos/${repository}`;
  const repo = await request(prefix);
  if (repo.full_name !== repository || typeof repo.default_branch !== 'string') fail('repository identity');
  const base = await request(`${prefix}/git/ref/heads/${encodeURIComponent(repo.default_branch)}`);
  if (base.object?.sha !== protectedBaseSha) fail('protected base moved');
  const pr = await request(`${prefix}/pulls/${number}`);
  if (pr.number !== number || pr.state !== 'open' || pr.merged === true
    || pr.base?.repo?.full_name !== repository || pr.head?.repo?.full_name !== repository
    || pr.base?.ref !== repo.default_branch || pr.base?.sha !== protectedBaseSha) fail('live PR/base association');
  if (expectedHead && pr.head?.sha !== expectedHead) fail('current PR head moved');
  exactSha(pr.head?.sha, 'current candidate head');
  const files = await pages(request, `${prefix}/pulls/${number}/files`);
  if (!Number.isSafeInteger(pr.changed_files) || pr.changed_files !== files.length) fail('incomplete changed-file set');
  const commit = await request(`${prefix}/commits/${pr.head.sha}`);
  exactSha(commit.commit?.tree?.sha, 'current candidate tree');
  return { repository, prNumber: number, headSha: pr.head.sha, baseSha: protectedBaseSha,
    treeSha: commit.commit.tree.sha, changedFiles: files.map(file => ({ path: file.filename, status: file.status,
      ...(file.status === 'renamed' ? { previousPath: file.previous_filename } : {}) })).sort((a, b) => a.path.localeCompare(b.path)) };
}

function reviewCaptures(options,candidate,executionPlan,evidence,run,artifact) {
  const contract=options.authority.visualCaptureContract,execution=options.authority.visualCaptureExecution;
  if(contract?.schemaVersion!==1||!Array.isArray(contract.requiredFrames)||!contract.requiredFrames.length||!execution)fail('protected visual capture authority missing');
  if(new Set(contract.requiredFrames.map(row=>row.frameId)).size!==contract.requiredFrames.length)fail('protected frame IDs duplicate');
  const supplied=evidence.proof?.reviewCaptures;
  if(!Array.isArray(supplied)||!supplied.length)fail('required review captures missing');
  const partitionIds=executionPlan.hostedPartitions.flatMap(partition=>partition.scenarioIds);
  if(contract.requiredFrames.some(frame=>!partitionIds.includes(frame.stableTestId)))fail('protected frame owner absent from plan');
  const expected=executionPlan.hostedPartitions.flatMap(partition=>{
    const requiredFrames=contract.requiredFrames.filter(frame=>partition.scenarioIds.includes(frame.stableTestId)).map(frame=>({frameId:frame.frameId,scenarioId:frame.stableTestId}));
    if(!requiredFrames.length)return [];
    const capture=supplied.filter(row=>row.dataCapability===partition.dataCapability);
    if(capture.length!==1)fail('unique partition review capture required');
    const product=evidence.proof.browser.partitions.filter(row=>row.dataCapability===partition.dataCapability);
    if(product.length!==1)fail('unique review product required');
    const reviewIds=executionPlan.review.filter(row=>row.dataCapability===partition.dataCapability).flatMap(row=>row.scenarioIds);
    const scenarioIds=[...new Set([...reviewIds,...requiredFrames.map(frame=>frame.scenarioId)])].sort();
    return [{captureBytes:canonicalJson(capture[0]),authority:{...execution,repositoryId:run.repository.id,protectedBaseSha:candidate.baseSha,workflowPath:workflow,artifactName:artifact.name,maxAgeMs:options.authority.maxAgeMs,planDigest:executionPlan.semanticDigest,oracleDigest:options.authority.oracleDigest,productDigest:product[0].productDigest,dataCapability:partition.dataCapability,scenarioIds,summaryScenarioIds:partition.scenarioIds,requiredFrames}}];
  });
  if(expected.length!==supplied.length)fail('unexpected review capture partition');
  return expected;
}

/** Both PR and MQ use this function with independently fetched GitHub state. */
export async function consumeProtectedAdmission(options) {
  const { request, repository, codeRevision, protectedBaseSha } = options;
  if (!/^[^/\s]+\/[^/\s]+$/.test(repository)) fail('repository format');
  exactSha(codeRevision, 'execution revision'); exactSha(protectedBaseSha, 'protected base');
  const prefix = `/repos/${repository}`;
  let number = options.prNumber;
  let queueTree;
  if (number === undefined) {
    queueTree = (await request(`${prefix}/commits/${codeRevision}`)).commit?.tree?.sha;
    exactSha(queueTree, 'merge-group tree');
    const associated = await pages(request, `${prefix}/commits/${codeRevision}/pulls`);
    // Synthetic merge commits need not have GitHub PR associations. Search live
    // open PRs by exact immutable tree, never by queue branch spelling.
    const pool = associated.length ? associated : await pages(request, `${prefix}/pulls?state=open`, undefined, 1000);
    const candidates = pool.filter(pr => pr?.state === 'open' && pr.base?.repo?.full_name === repository
      && pr.head?.repo?.full_name === repository && pr.base?.sha === protectedBaseSha);
    const matching = [];
    for (const pr of candidates) {
      exactSha(pr.head?.sha, 'associated candidate head');
      const tree = (await request(`${prefix}/commits/${pr.head.sha}`)).commit?.tree?.sha;
      exactSha(tree, 'associated candidate tree');
      if (tree === queueTree) matching.push(pr);
    }
    if (!matching.length) {
      return { accepted: false, eligible: false, reason: 'missing-exact-tree-association' };
    }
    if (matching.length !== 1) fail('ambiguous MQ PR association');
    number = matching[0].number;
  }
  if (!Number.isSafeInteger(number) || number < 1) fail('PR number');
  const candidate = await readCandidate(options, number, queueTree ? undefined : codeRevision);
  if (queueTree && queueTree !== candidate.treeSha) fail('merge-group tree differs from exact candidate tree');
  if (typeof options.scopeAdmission !== 'function') fail('protected scope predicate missing');
  let admission;
  try {
    admission = options.scopeAdmission(candidate);
    if (admission?.eligible !== true) fail('protected scope predicate did not admit candidate');
  } catch (error) {
    if (error?.code === 'ADMISSION_SCOPE_INELIGIBLE') return { accepted: false, eligible: false, reason: 'scope-ineligible' };
    throw error;
  }
  const executionPlan = typeof options.executionPlan === 'function'
    ? options.executionPlan(candidate, admission) : options.authority.executionPlan;
  if (!executionPlan) fail('protected semantic execution plan missing');
  const runs = await pages(request, `${prefix}/actions/workflows/protected-admission.yml/runs`, 'workflow_runs');
  const matchesCandidateRun = run => run?.path === workflow && run.repository?.full_name === repository
    && ((run.event === 'pull_request_target' && Array.isArray(run.pull_requests)
      && run.pull_requests.some(pr => pr.number === number && pr.head?.sha === candidate.headSha && pr.base?.sha === protectedBaseSha))
    || (run.event === 'workflow_dispatch' && run.head_sha === protectedBaseSha
      && run.display_title === `protected-admission:${repository}:${number}:${candidate.headSha}:${protectedBaseSha}`));
  const relevant = runs.filter(matchesCandidateRun);
  relevant.sort((a, b) => Number(b.id) - Number(a.id));
  // The latest exact-candidate run is the authority. Never hide its failure or
  // pending state by selecting an older green artifact.
  const locator = relevant[0];
  if (!locator || locator.status !== 'completed') return { accepted: false, eligible: true, reason: 'missing-independent-evidence' };
  if (locator.conclusion !== 'success' || locator.run_attempt !== 1) fail('latest exact producer is failed or retried');
  const run = await request(`${prefix}/actions/runs/${locator.id}`);
  const jobs = await pages(request, `${prefix}/actions/runs/${locator.id}/attempts/1/jobs`, 'jobs');
  const proofJobs = jobs.filter(job => job?.name === 'Protected admission proof');
  if (proofJobs.length !== 1) fail('unique independent proof job missing');
  const artifacts = await pages(request, `${prefix}/actions/runs/${locator.id}/artifacts`, 'artifacts');
  const name = `protected-admission-evidence-${locator.id}-1`;
  const matches = artifacts.filter(artifact => artifact.name === name);
  if (matches.length !== 1 || matches[0].expired === true) fail('independent evidence artifact missing or expired');
  if (!Number.isSafeInteger(matches[0].id) || matches[0].id < 1) fail('artifact ID');
  const evidence = await options.downloadEvidence(matches[0].id);
  let independentReview,reviewSnapshot;
  if(executionPlan.review?.length) {
    const captures=reviewCaptures(options,candidate,executionPlan,evidence,run,matches[0]);
    const endpoint=`${prefix}/pulls/${number}/reviews`,reviews=await pages(request,endpoint);
    const review=selectLatestProtectedReview(reviews,candidate);
    if(!review)return {accepted:false,eligible:true,reason:'missing-independent-visual-review'};
    if(!/^[A-Za-z0-9-]+$/.test(review.user?.login??''))fail('reviewer login required');
    const permissionEndpoint=`${prefix}/collaborators/${encodeURIComponent(review.user.login)}/permission`;
    const reviewerPermission=await request(permissionEndpoint);
    independentReview=validateProtectedReviewBundle({currentCandidate:candidate,captures,captureRun:run,captureJobs:{jobs},captureArtifact:matches[0],review,reviewerPermission,now:options.now??new Date().toISOString()});
    reviewSnapshot={endpoint,reviews,permissionEndpoint,reviewerPermission};
  }
  const finalRun = await request(`${prefix}/actions/runs/${locator.id}`);
  same(finalRun, run, 'final producer reread');
  const finalJobs = await pages(request, `${prefix}/actions/runs/${locator.id}/attempts/1/jobs`, 'jobs');
  same(finalJobs, jobs, 'final producer jobs reread');
  const finalRuns = await pages(request, `${prefix}/actions/workflows/protected-admission.yml/runs`, 'workflow_runs');
  const latest = finalRuns.filter(matchesCandidateRun).sort((a, b) => Number(b.id) - Number(a.id))[0];
  if (latest?.id !== locator.id || latest.run_attempt !== 1 || latest.status !== 'completed' || latest.conclusion !== 'success') fail('latest producer changed during consumption');
  if(reviewSnapshot) {
    same(await pages(request,reviewSnapshot.endpoint),reviewSnapshot.reviews,'final visual review timeline');
    same(await request(reviewSnapshot.permissionEndpoint),reviewSnapshot.reviewerPermission,'final reviewer authority');
    same(await pages(request,`${prefix}/actions/runs/${locator.id}/artifacts`,'artifacts'),artifacts,'final capture artifacts');
  }
  const current = await readCandidate(options, number, candidate.headSha);
  same(current, candidate, 'final candidate reread');
  if (queueTree) same((await request(`${prefix}/commits/${codeRevision}`)).commit?.tree?.sha, queueTree, 'final queue tree');
  const result = validateProtectedAdmissionEvidence({ evidence,independentReview,
    authority: { ...options.authority, executionPlan,
      requiredGroups: executionPlan.requiredGroups.filter(group => group.startsWith('deterministic.')),
      requiredScenarioIds: executionPlan.scenarioIds, protectedBaseSha, expectedRunId: locator.id, expectedJobId: proofJobs[0].id,
      workflowPath: workflow, event: finalRun.event, jobName: 'Protected admission proof', evidenceKind: 'protected-admission' },
    currentCandidate: current, producerRun: finalRun, producerJobs: { jobs: finalJobs }, now: options.now ?? new Date().toISOString() });
  return { accepted: true, eligible: true, evidence: result };
}

function githubRequest(endpoint) {
  return Promise.resolve(JSON.parse(execFileSync('gh', ['api', endpoint], { encoding: 'utf8', maxBuffer: 32 * 1024 * 1024 })));
}
function downloadEvidence(repository, artifactId) {

    // Never extract archive members into the execution tree. Python reads one
    // fixed JSON member in memory and rejects any other member or archive link.
    const bytes = execFileSync('gh', ['api', `/repos/${repository}/actions/artifacts/${artifactId}/zip`], { maxBuffer: 8 * 1024 * 1024 });
    const script = 'import sys,io,zipfile,json,stat\nz=zipfile.ZipFile(io.BytesIO(sys.stdin.buffer.read()))\ni=z.infolist()\nassert len(i)==1 and i[0].filename=="protected-admission-evidence.json"\nassert i[0].file_size<=1048576 and not stat.S_ISLNK(i[0].external_attr >> 16)\nv=json.loads(z.read(i[0]))\nprint(json.dumps(v))';
    return Promise.resolve(JSON.parse(execFileSync('python3', ['-c', script], { input: bytes, maxBuffer: 2 * 1024 * 1024 }).toString('utf8')));
}

async function main() {
  const args = process.argv.slice(2);
  const options = {};
  for (let i = 0; i < args.length; i += 2) {
    if (!['--output', '--protected-root'].includes(args[i]) || !args[i + 1]) fail('CLI arguments');
    options[args[i]] = args[i + 1];
  }
  const root = options['--protected-root'] ? path.resolve(options['--protected-root']) : path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
  const catalog = JSON.parse(readFileSync(path.join(root, 'tools/verification/verification-catalog.json'), 'utf8'));
  const census = validateStableIdCensus(JSON.parse(readFileSync(path.join(root, 'tools/verification/full-safety-net-stable-ids.json'), 'utf8')));
  const { protectedOracleDigest,CANDIDATE_IMAGE } = await import('./run-protected-admission.mjs');
  const { validateProtectedExecutionScope } = await import('./protected-admission-policy.mjs');
  const { evaluateProtectedRouting } = await import('./protected-semantic-routing.mjs');
  const manifest = JSON.parse(readFileSync(path.join(root, 'tools/verification/impact-manifest.json'), 'utf8'));
  const inventory = JSON.parse(readFileSync(path.join(root, 'tools/verification/protected-scenario-inventory.json'), 'utf8'));
  const routing = JSON.parse(readFileSync(path.join(root, 'tools/verification/protected-routing.json'), 'utf8'));
  const gitArgs = ['--no-replace-objects', '-C', root, '-c', 'core.hooksPath=/dev/null'];
  if (execFileSync('git', [...gitArgs, 'rev-parse', 'HEAD'], { encoding: 'utf8' }).trim() !== process.env.ATLAS_PROTECTED_BASE_SHA) fail('protected checkout base drift');
  const protectedPaths = execFileSync('git', [...gitArgs, 'ls-tree', '-r', '--name-only', 'HEAD'], { encoding: 'utf8', maxBuffer: 16 * 1024 * 1024 }).trim().split('\n');
  const repository = process.env.GITHUB_REPOSITORY;
  const result = await consumeProtectedAdmission({ repository, codeRevision: process.env.ATLAS_CODE_REVISION,
    protectedBaseSha: process.env.ATLAS_PROTECTED_BASE_SHA,
    ...(process.env.ATLAS_PR_NUMBER ? { prNumber: Number(process.env.ATLAS_PR_NUMBER) } : {}),
    scopeAdmission: candidate => validateProtectedExecutionScope({ changedFiles: candidate.changedFiles, protectedPaths }),
    executionPlan: (candidate, admission) => {
      const plan = evaluateProtectedRouting({ candidate, manifest, catalog, census, inventory, routing, forceFull: admission.forceFull === true });
      return { semanticDigest: plan.semanticDigest, requiredGroups: plan.requiredGroups, scenarioIds: plan.scenarioIds,
        dataCapabilities: plan.capabilities, profile: plan.profile, proofPurpose: plan.proofPurpose, evidenceKind: plan.evidenceKind, propertyObligations: plan.propertyObligations, hostedPartitions: plan.hostedPartitions, specialist: plan.specialist, review: plan.review };
    },
    request: githubRequest, downloadEvidence: id => downloadEvidence(repository, id),
    authority: { oracleDigest: protectedOracleDigest(root), maxAgeMs: 24 * 60 * 60 * 1000,
      visualCaptureContract:JSON.parse(readFileSync(path.join(root,'tools/verification/protected-visual-capture-contract.json'),'utf8')),
      visualReference:{required:true,referenceTree:execFileSync('git',[...gitArgs,'rev-parse','HEAD^{tree}'],{encoding:'utf8'}).trim(),browserImage:CANDIDATE_IMAGE},
      visualCaptureExecution:{runnerKind:'github-hosted',runnerGroupId:0,runnerLabels:['ubuntu-24.04'],jobName:'Protected admission proof'} } });
  if (options['--output']) writeFileSync(options['--output'], `${JSON.stringify(result)}\n`);
  if (process.env.GITHUB_OUTPUT) appendFileSync(process.env.GITHUB_OUTPUT, `admission_accepted=${result.accepted}\nadmission_eligible=${result.eligible}\n`);
  console.log(JSON.stringify(result));
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main().catch(error => { console.error(error.message); process.exitCode = 1; });
