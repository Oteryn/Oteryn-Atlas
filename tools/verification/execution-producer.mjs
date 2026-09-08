import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';

import {canonicalJson} from './verification-plan-schema.mjs';

const receipts = new WeakMap();
const MAX_ARCHIVE_BYTES = 2 * 1024 * 1024;
const MAX_REPORT_BYTES = 1024 * 1024;
const SHA = /^[a-f0-9]{40}$/;
const DIGEST = /^sha256:[a-f0-9]{64}$/;
const IDENTITY_KEYS = ['candidateDigest','environmentDigest','headSha','planDigest','policyDigest','protectedBaseSha','repository','treeSha'];
const POLICY_KEYS = ['event','jobName','repositoryId','workflowPath'];

function fail(message) { throw new TypeError(`execution producer: ${message}`); }
function equal(left, right, label) {
  if (canonicalJson(left) !== canonicalJson(right)) fail(`${label} mismatch`);
}
function exactKeys(value, keys, label) {
  if (!value || typeof value !== 'object' || Array.isArray(value)
    || Object.keys(value).sort().join(',') !== [...keys].sort().join(',')) fail(`${label} shape`);
}
function integer(value, label) {
  if (!Number.isSafeInteger(value) || value < 1) fail(`${label} must be a positive integer`);
  return value;
}
function instant(value, label) {
  const parsed = typeof value === 'string' ? Date.parse(value) : NaN;
  if (!Number.isFinite(parsed)) fail(`${label} timestamp`);
  return parsed;
}
function bytes(value, label, maximum = MAX_ARCHIVE_BYTES) {
  if (!Buffer.isBuffer(value) && !(value instanceof Uint8Array)) fail(`${label} must be raw bytes`);
  const result = Buffer.from(value);
  if (result.length === 0 || result.length > maximum) fail(`${label} size`);
  return result;
}
function bytesDigest(value) {
  return `sha256:${createHash('sha256').update(value).digest('hex')}`;
}
function canonicalDigest(value) {
  return bytesDigest(Buffer.from(canonicalJson(value)));
}
function freeze(value) {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    for (const child of Object.values(value)) freeze(child);
    Object.freeze(value);
  }
  return value;
}

function validateContract(contract, commandId) {
  if (!contract || typeof contract !== 'object' || Array.isArray(contract)) fail('sealed contract required');
  const core = structuredClone(contract);
  delete core.contractDigest;
  if (!DIGEST.test(contract.contractDigest ?? '') || canonicalDigest(core) !== contract.contractDigest) fail('sealed contract required');
  exactKeys(contract.identity, IDENTITY_KEYS, 'contract identity');
  const identity = contract.identity;
  if (identity.repository !== 'Oteryn/Oteryn-Atlas'
    || !SHA.test(identity.headSha) || !SHA.test(identity.protectedBaseSha) || !SHA.test(identity.treeSha)
    || !DIGEST.test(identity.candidateDigest) || !DIGEST.test(identity.planDigest) || !DIGEST.test(identity.policyDigest)
    || !/^[a-f0-9]{64}$/.test(identity.environmentDigest ?? '')) fail('contract identity');
  exactKeys(contract.producerPolicy, POLICY_KEYS, 'producer policy');
  const policy = contract.producerPolicy;
  integer(policy.repositoryId, 'repository ID');
  if (!/^\.github\/workflows\/[a-z0-9-]+\.yml$/.test(policy.workflowPath ?? '')
    || typeof policy.jobName !== 'string' || policy.jobName.length === 0
    || !['pull_request_target','merge_group'].includes(policy.event)) fail('producer policy');
  if (!Number.isSafeInteger(contract.maxEvidenceAgeMs) || contract.maxEvidenceAgeMs < 1) fail('evidence lifetime');
  if (!Array.isArray(contract.commands) || !DIGEST.test(commandId ?? '')) fail('command identity');
  const matches = contract.commands.filter(command => command?.id === commandId);
  if (matches.length !== 1 || !Number.isSafeInteger(matches[0].timeoutSeconds) || matches[0].timeoutSeconds < 1) fail('unique contract command required');
  return matches[0];
}

function validateProtectedSource(source, contract) {
  exactKeys(source, ['ref','repository','repositoryId','revision'], 'protected source');
  if (source.repository !== contract.identity.repository || source.repositoryId !== contract.producerPolicy.repositoryId
    || source.ref !== 'refs/heads/main' || source.revision !== contract.identity.protectedBaseSha) fail('protected source readback');
}

function validateRun(run, contract) {
  const {identity, producerPolicy: policy} = contract;
  if (!run || typeof run !== 'object' || run.id == null) fail('current workflow run required');
  integer(run.id, 'run ID');
  if (run.run_attempt !== 1 || run.path !== policy.workflowPath || run.event !== policy.event
    || run.status !== 'completed' || run.conclusion !== 'success'
    || run.repository?.id !== policy.repositoryId || run.repository?.full_name !== identity.repository) fail('workflow run identity or result');
  if (policy.event === 'pull_request_target') {
    if (run.head_sha !== identity.protectedBaseSha || run.head_branch !== 'main'
      || !Array.isArray(run.pull_requests) || run.pull_requests.length !== 1) fail('PR producer association');
    const association = run.pull_requests[0];
    integer(association?.number, 'PR number');
    if (association.head?.sha !== identity.headSha || association.base?.sha !== identity.protectedBaseSha
      || association.head?.repo?.id !== policy.repositoryId || association.base?.repo?.id !== policy.repositoryId) fail('PR producer association');
  } else {
    if (run.head_sha !== identity.headSha
      || typeof run.head_branch !== 'string'
      || !/^gh-readonly-queue\/main\/pr-[1-9]\d*-[a-f0-9]+$/.test(run.head_branch)) fail('merge-group producer association');
  }
}

function validateJob(jobs, run, contract, command, now) {
  if (!jobs || !Array.isArray(jobs.jobs) || !Number.isSafeInteger(jobs.total_count)
    || jobs.total_count !== jobs.jobs.length) fail('complete job census required');
  const matching = jobs.jobs.filter(job => job?.name === contract.producerPolicy.jobName);
  if (matching.length !== 1) fail('unique protected producer job required');
  const job = matching[0];
  integer(job.id, 'job ID');
  if (job.run_id !== run.id || job.run_attempt !== 1 || job.head_sha !== run.head_sha
    || job.status !== 'completed' || job.conclusion !== 'success') fail('producer job identity or result');
  const clock = instant(now, 'current');
  const runStarted = instant(run.created_at, 'run start');
  const jobStarted = instant(job.started_at, 'job start');
  const jobEnded = instant(job.completed_at, 'job completion');
  const runEnded = instant(run.updated_at, 'run completion');
  if (runStarted > jobStarted || jobStarted > jobEnded || jobEnded > runEnded || runEnded > clock
    || clock - jobEnded > contract.maxEvidenceAgeMs
    || jobEnded - jobStarted > command.timeoutSeconds * 1000) fail('producer freshness or execution budget');
  return job;
}

function expectedArtifactName(commandId) { return `execution-proof-${commandId.slice('sha256:'.length)}`; }
function expectedReportPath(commandId) { return `${expectedArtifactName(commandId)}.json`; }

function decodeReport(archive, pathname) {
  const script = String.raw`import io,stat,sys,zipfile
raw=sys.stdin.buffer.read()
with zipfile.ZipFile(io.BytesIO(raw),'r') as archive:
 entries=archive.infolist()
 if len(entries)!=1: raise ValueError('exactly one report member required')
 entry=entries[0]
 if entry.filename!=sys.argv[1] or entry.is_dir(): raise ValueError('unexpected report path')
 if entry.flag_bits & 1: raise ValueError('encrypted report prohibited')
 if stat.S_ISLNK(entry.external_attr >> 16): raise ValueError('symlink report prohibited')
 if entry.compress_size<0 or entry.compress_size>${MAX_REPORT_BYTES}: raise ValueError('compressed report too large')
 if entry.file_size<1 or entry.file_size>${MAX_REPORT_BYTES}: raise ValueError('report too large')
 data=archive.read(entry)
 if len(data)!=entry.file_size: raise ValueError('report size mismatch')
 sys.stdout.buffer.write(data)`;
  try {
    return execFileSync('python3', ['-c', script, pathname], {
      input: archive,
      maxBuffer: MAX_REPORT_BYTES + 1,
      timeout: 5_000,
      windowsHide: true,
      stdio: ['pipe','pipe','pipe'],
    });
  } catch {
    fail('unsafe or invalid execution proof archive');
  }
}

function validateArtifact(artifact, archive, run, contract, commandId) {
  const policy = contract.producerPolicy;
  integer(artifact?.id, 'artifact ID');
  if (artifact.name !== expectedArtifactName(commandId) || artifact.expired !== false
    || !DIGEST.test(artifact.digest ?? '') || artifact.digest !== bytesDigest(archive)) fail('artifact identity or archive digest');
  const association = artifact.workflow_run;
  if (!association || association.id !== run.id || association.repository_id !== policy.repositoryId
    || association.head_repository_id !== policy.repositoryId || association.head_sha !== run.head_sha) fail('artifact workflow association');
}

function validateReport(reportBytes, contract, commandId) {
  let report;
  try { report = JSON.parse(reportBytes.toString('utf8')); } catch { fail('execution report is not JSON'); }
  if (!report || typeof report !== 'object' || Array.isArray(report) || Object.hasOwn(report, 'producer')) fail('execution report shape');
  if (report.commandId !== commandId || report.contractDigest !== contract.contractDigest) fail('execution report contract');
  equal(report.identity, contract.identity, 'execution report identity');
  return report;
}

// This is an inactive authentication boundary. Its caller owns complete current
// GitHub API pagination/readback; it performs no network request or execution.
export function authenticateExecutionProducer({contract, commandId, run, jobs, artifact, archiveBytes, protectedSource, now} = {}) {
  const command = validateContract(contract, commandId);
  validateProtectedSource(protectedSource, contract);
  validateRun(run, contract);
  const job = validateJob(jobs, run, contract, command, now);
  const archive = bytes(archiveBytes, 'artifact archive');
  validateArtifact(artifact, archive, run, contract, commandId);
  const reportBytes = decodeReport(archive, expectedReportPath(commandId));
  validateReport(reportBytes, contract, commandId);
  const archiveDigest = bytesDigest(archive);
  const reportDigest = bytesDigest(reportBytes);
  const normalizedProducer = freeze({
    repository: contract.identity.repository,
    repositoryId: contract.producerPolicy.repositoryId,
    workflowPath: contract.producerPolicy.workflowPath,
    jobName: contract.producerPolicy.jobName,
    event: contract.producerPolicy.event,
    headSha: contract.identity.headSha,
    baseSha: contract.identity.protectedBaseSha,
    sourceSha: contract.identity.protectedBaseSha,
    sourceRef: 'refs/heads/main',
    headRepositoryId: contract.producerPolicy.repositoryId,
    baseRepositoryId: contract.producerPolicy.repositoryId,
    runId: run.id,
    jobId: job.id,
    runAttempt: 1,
    status: 'completed',
    conclusion: 'success',
    artifactDigest: reportDigest,
  });
  const receipt = freeze({accepted: true, contractDigest: contract.contractDigest, commandId,
    runId: run.id, jobId: job.id, artifactId: artifact.id, archiveDigest, reportDigest});
  receipts.set(receipt, {contractDigest: contract.contractDigest, commandId, reportBytes: Buffer.from(reportBytes), normalizedProducer});
  return receipt;
}

export function assertExecutionProducer(receipt, {contract, commandId, artifactBytes} = {}) {
  validateContract(contract, commandId);
  const authenticated = receipts.get(receipt);
  if (!authenticated || authenticated.contractDigest !== contract.contractDigest || authenticated.commandId !== commandId) fail('authenticated producer receipt required');
  const reportBytes = bytes(artifactBytes, 'execution report', MAX_REPORT_BYTES);
  if (!reportBytes.equals(authenticated.reportBytes) || bytesDigest(reportBytes) !== receipt.reportDigest) fail('authenticated execution report bytes required');
  return authenticated.normalizedProducer;
}
