import { deepFreeze, exactDigest, exactSha, isPlainObject } from './anti-loop-common.mjs';
import { canonicalJson } from './verification-plan-schema.mjs';

function fail(label) { throw new TypeError(`protected admission evidence: ${label}`); }
function object(value, keys, label) {
  if (!isPlainObject(value) || Object.keys(value).some(key => !keys.includes(key))
    || keys.some(key => !Object.hasOwn(value, key))) fail(`${label} shape`);
  return value;
}
function integer(value, label) {
  if (!Number.isSafeInteger(value) || value < 1) fail(`${label} positive integer`);
  return value;
}
function text(value, label) {
  if (typeof value !== 'string' || value.length === 0) fail(`${label} string`);
  return value;
}
function equal(actual, expected, label) {
  if (canonicalJson(actual) !== canonicalJson(expected)) fail(`${label} mismatch`);
}
function strings(value, label) {
  if (!Array.isArray(value) || value.length === 0) fail(`${label} nonempty list`);
  value.forEach(item => text(item, label));
  if (new Set(value).size !== value.length) fail(`${label} duplicate`);
  return [...value].sort();
}
function time(value, label) {
  if (typeof value !== 'string' || !Number.isFinite(Date.parse(value))) fail(`${label} timestamp`);
  return Date.parse(value);
}
function candidateIdentity(value) {
  object(value, ['repository', 'prNumber', 'headSha', 'baseSha', 'treeSha', 'changedFiles'], 'candidate');
  if (!/^[^/\s]+\/[^/\s]+$/.test(text(value.repository, 'repository'))) fail('repository format');
  integer(value.prNumber, 'PR');
  for (const key of ['headSha', 'baseSha', 'treeSha']) exactSha(value[key], key);
  if (!Array.isArray(value.changedFiles) || !value.changedFiles.length) fail('complete changed files missing');
  const paths = new Set();
  const files = value.changedFiles.map(file => {
    object(file, file?.status === 'renamed' ? ['path', 'status', 'previousPath'] : ['path', 'status'], 'changed file');
    if (!['added', 'modified', 'removed', 'renamed', 'copied', 'changed', 'unchanged'].includes(file.status)) fail('file status');
    for (const path of [file.path, ...(file.previousPath === undefined ? [] : [file.previousPath])]) {
      text(path, 'file path');
      if (path.startsWith('/') || path.includes('\\') || path.split('/').some(part => !part || part === '.' || part === '..')) fail('file path');
    }
    if (paths.has(file.path)) fail('duplicate changed file');
    paths.add(file.path);
    return { ...file };
  }).sort((a, b) => a.path.localeCompare(b.path));
  return { ...value, changedFiles: files };
}

/**
 * Pure PR/MQ contract. The caller must obtain authority from protected-base code,
 * currentCandidate from a final complete GitHub re-read, and producerRun/jobs from
 * GitHub. Evidence must come from that run's protected artifact, never a candidate
 * file, candidate status, or candidate-selected producer. This function deliberately
 * cannot authorize paths: independent protected admission must precede execution.
 */
export function validateProtectedAdmissionEvidence(input) {
  if (!isPlainObject(input)) fail('input');
  const { evidence, authority, producerRun: run, producerJobs, now } = input;
  if (!isPlainObject(authority)) fail('protected authority missing');
  const current = candidateIdentity(input.currentCandidate);
  equal(authority.protectedBaseSha, current.baseSha, 'protected authority base');
  exactSha(authority.protectedBaseSha, 'protected authority base');
  integer(authority.expectedRunId, 'trusted run locator');
  integer(authority.expectedJobId, 'trusted job locator');
  if (authority.event !== 'pull_request_target') fail('protected event');
  text(authority.workflowPath, 'protected workflow');
  text(authority.jobName, 'protected proof job');
  text(authority.evidenceKind, 'required evidence kind');
  const requiredGroups = strings(authority.requiredGroups, 'protected deterministic groups');
  const requiredIds = strings(authority.requiredScenarioIds, 'protected census');
  exactDigest(authority.oracleDigest, 'protected oracle');
  integer(authority.maxAgeMs, 'protected maximum age');
  object(evidence, ['schemaVersion', 'kind', 'candidate', 'producer', 'createdAt', 'proof'], 'envelope');
  if (evidence.schemaVersion !== 1 || evidence.kind !== authority.evidenceKind) fail('schema/kind');
  equal(candidateIdentity(evidence.candidate), current, 'exact current candidate');
  const p = object(evidence.producer, ['workflowPath', 'event', 'runId', 'jobId', 'runAttempt', 'sourceSha'], 'producer');
  equal(p.workflowPath, authority.workflowPath, 'workflow');
  equal(p.event, authority.event, 'event');
  equal(p.sourceSha, current.baseSha, 'protected source');
  equal(p.runId, authority.expectedRunId, 'trusted run');
  equal(p.jobId, authority.expectedJobId, 'trusted job');
  if (p.runAttempt !== 1) fail('producer retries prohibited');
  if (!isPlainObject(run) || run.status !== 'completed' || run.conclusion !== 'success') fail('successful GitHub run missing');
  equal(run.id, p.runId, 'GitHub run ID');
  equal(run.run_attempt, p.runAttempt, 'GitHub run attempt');
  equal(run.path, p.workflowPath, 'GitHub workflow');
  equal(run.event, p.event, 'GitHub event');
  equal(run.repository?.full_name, current.repository, 'GitHub repository');
  // GitHub pull_request_target metadata has used both base and candidate head.
  // The event selects protected source; exact PR association below is mandatory.
  if (![current.baseSha, current.headSha].includes(run.head_sha)) fail('GitHub run head');
  const repositoryId = integer(run.repository?.id, 'GitHub repository ID');
  const associations = Array.isArray(run.pull_requests) ? run.pull_requests.filter(pr => pr?.number === current.prNumber) : [];
  if (associations.length !== 1) fail('unique GitHub PR association');
  const association = associations[0];
  equal(association.head?.sha, current.headSha, 'associated head');
  equal(association.base?.sha, current.baseSha, 'associated base');
  for (const side of ['head', 'base']) equal(association[side]?.repo?.id, repositoryId, `associated ${side} repository`);
  const jobs = producerJobs?.jobs;
  if (!Array.isArray(jobs)) fail('GitHub jobs missing');
  const matches = jobs.filter(job => job?.name === authority.jobName);
  if (matches.length !== 1) fail('unique proof job');
  const job = matches[0];
  equal(job.id, p.jobId, 'GitHub job ID');
  equal(job.run_id, p.runId, 'GitHub job run');
  equal(job.run_attempt, p.runAttempt, 'GitHub job attempt');
  equal(job.head_sha, run.head_sha, 'GitHub job head');
  if (job.status !== 'completed' || job.conclusion !== 'success') fail('successful GitHub proof job missing');
  const clock = time(now, 'current time');
  const created = time(evidence.createdAt, 'evidence time');
  const runStart = time(run.created_at, 'GitHub run creation');
  const runEnd = time(run.updated_at, 'GitHub run update');
  const jobStart = time(job.started_at, 'GitHub job start');
  const jobEnd = time(job.completed_at, 'GitHub job completion');
  if (created < jobStart || created > jobEnd || jobStart < runStart || jobEnd > runEnd
    || runEnd > clock || clock - runStart > authority.maxAgeMs) fail('stale or inconsistent evidence time');
  object(evidence.proof, ['deterministic', 'browser'], 'required proof');
  const deterministic = object(evidence.proof.deterministic, ['groups', 'result'], 'deterministic proof');
  equal(strings(deterministic.groups, 'executed deterministic groups'), requiredGroups, 'deterministic groups');
  if (deterministic.result !== 'PASS') fail('deterministic proof failed');
  const browser = object(evidence.proof.browser, ['scenarioResults', 'workers', 'retries', 'dataCapability', 'oracleDigest', 'productDigest'], 'browser proof');
  if (browser.workers !== 1 || browser.retries !== 0 || browser.dataCapability !== 'qualification_fixture') fail('browser lower bounds');
  equal(browser.oracleDigest, authority.oracleDigest, 'independent oracle');
  exactDigest(browser.productDigest, 'candidate built product');
  if (!Array.isArray(browser.scenarioResults)) fail('browser census missing');
  const ids = browser.scenarioResults.map(scenario => {
    object(scenario, ['id', 'result'], 'scenario result');
    if (scenario.result !== 'PASS') fail('required scenario not passed');
    return scenario.id;
  });
  equal(strings(ids, 'executed census'), requiredIds, 'complete protected census');
  return deepFreeze({ schemaVersion: 1, status: 'success', candidate: current, producer: { ...p }, productDigest: browser.productDigest, scenarioIds: requiredIds });
}
