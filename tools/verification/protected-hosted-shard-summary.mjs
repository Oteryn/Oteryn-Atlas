import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

const SHA = /^[a-f0-9]{40}$/;
const SHA256 = /^sha256:[a-f0-9]{64}$/;
const BROWSER_CONTAINER = 'mcr.microsoft.com/playwright:v1.62.0-noble@sha256:baed2032d533817f3dbe6425de795788430ba345e819a1201337009ba17c9d07';
const WORKER_POLICY = Object.freeze({ id: 'atlas-protected-hosted-workers-v1', version: 1, hostedShards: 2, workersPerShard: 1 });

function exactSha(value, label) {
  if (typeof value !== 'string' || !SHA.test(value)) throw new TypeError(`${label} must be an exact lowercase SHA`);
  return value;
}

function exactDigest(value, label) {
  if (typeof value !== 'string' || !SHA256.test(value)) throw new TypeError(`${label} must be sha256:<64 lowercase hex>`);
  return value;
}

function stableIds(value, label, { allowEmpty = false } = {}) {
  if (!Array.isArray(value) || (!allowEmpty && value.length === 0)
    || value.some((id) => typeof id !== 'string' || !id.includes('::'))) {
    throw new TypeError(`${label} must contain stable IDs`);
  }
  if (new Set(value).size !== value.length) throw new TypeError(`${label} contains duplicate stable IDs`);
  return [...value].sort();
}

function same(actual, expected, label) {
  if (actual !== expected) throw new TypeError(`${label} mismatch`);
}

function validatePlan(plan) {
  if (!plan || typeof plan !== 'object' || Array.isArray(plan) || plan.schemaVersion !== 2
    || plan.controller?.id !== 'atlas-protected-hosted-controller-v2' || plan.controller?.version !== 2) {
    throw new TypeError('protected shard evidence requires protected hosted plan v2');
  }
  exactSha(plan.controller.sourceSha, 'controller source SHA');
  exactSha(plan.candidateHeadSha, 'candidate head SHA');
  for (const [field, label] of [
    ['planDigest', 'plan digest'],
    ['expectedStableTestIdsDigest', 'expected stable-ID digest'],
    ['productIdentitiesDigest', 'product identities digest'],
    ['workerPolicyDigest', 'worker policy digest'],
    ['executionPolicyDigest', 'execution policy digest'],
  ]) exactDigest(plan[field], label);
  if (plan.retryPolicy?.retries !== 0 || plan.selectiveExecution !== false) {
    throw new TypeError('protected shard plan must bind zero retries and disabled selective execution');
  }
  const policy = plan.workerPolicy;
  if (!policy || policy.id !== WORKER_POLICY.id || policy.version !== WORKER_POLICY.version
    || policy.hostedShards !== WORKER_POLICY.hostedShards || policy.workersPerShard !== WORKER_POLICY.workersPerShard) {
    throw new TypeError('protected shard worker policy mismatch');
  }
  return plan;
}

function validateExecution(execution, plan) {
  if (!execution || typeof execution !== 'object' || Array.isArray(execution) || execution.schemaVersion !== 1) {
    throw new TypeError('protected shard evidence requires execution schemaVersion 1');
  }
  same(exactSha(execution.controllerSourceSha, 'execution controller source SHA'), plan.controller.sourceSha, 'controller source SHA');
  same(exactSha(execution.candidateHeadSha, 'execution candidate head SHA'), plan.candidateHeadSha, 'candidate head SHA');
  for (const [field, label] of [
    ['planDigest', 'plan digest'],
    ['expectedStableTestIdsDigest', 'expected stable-ID digest'],
    ['productIdentitiesDigest', 'product identities digest'],
    ['workerPolicyDigest', 'worker policy digest'],
    ['executionPolicyDigest', 'execution policy digest'],
  ]) same(exactDigest(execution[field], `execution ${label}`), plan[field], label);
  const hostedExpectedStableTestIdsDigest = exactDigest(execution.hostedExpectedStableTestIdsDigest, 'execution hosted stable-ID digest');
  exactDigest(execution.specialistExpectedStableTestIdsDigest, 'execution specialist stable-ID digest');
  if (execution.retries !== 0 || execution.selectiveExecution !== false) {
    throw new TypeError('protected shard execution must bind zero retries and disabled selective execution');
  }
  const hosted = stableIds(execution.hosted?.stableTestIds, 'hosted stable IDs', { allowEmpty: true });
  const specialist = stableIds(execution.specialist?.stableTestIds, 'specialist stable IDs', { allowEmpty: true });
  const specialistSet = new Set(specialist);
  if (hosted.some((id) => specialistSet.has(id))) throw new TypeError('hosted and specialist stable-ID placement overlaps');
  return { hosted, specialist, hostedExpectedStableTestIdsDigest };
}

export function buildProtectedHostedShardSummary({ plan, execution, summary, shardIndex, shardCount }) {
  const protectedPlan = validatePlan(plan);
  const { hosted, hostedExpectedStableTestIdsDigest } = validateExecution(execution, protectedPlan);
  if (!Number.isSafeInteger(shardCount) || shardCount !== protectedPlan.workerPolicy.hostedShards
    || !Number.isSafeInteger(shardIndex) || shardIndex < 0 || shardIndex >= shardCount) {
    throw new TypeError('protected shard count/index does not match worker policy');
  }
  if (!summary || typeof summary !== 'object' || Array.isArray(summary)) throw new TypeError('protected shard summary must be an object');
  if (summary.status !== 'passed') throw new TypeError('protected shard summary status must be passed');
  if (summary.cancelled === true) throw new TypeError('cancelled protected shard evidence is forbidden');
  const metadata = summary.metadata;
  if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) throw new TypeError('protected shard metadata is required');
  same(metadata.targetMode, 'checkout-overlay', 'target mode');
  same(exactSha(metadata.expectedRevision, 'summary expected revision'), protectedPlan.candidateHeadSha, 'revision');
  same(exactDigest(metadata.verificationPlanSha256, 'summary verification plan digest'), protectedPlan.planDigest, 'plan digest');
  same(metadata.browserContainer, BROWSER_CONTAINER, 'browser container');
  same(metadata.workers, protectedPlan.workerPolicy.workersPerShard, 'worker count');
  if (!Array.isArray(summary.scenarios)) throw new TypeError('protected shard scenarios must be an array');

  const hostedSet = new Set(hosted);
  const executed = [];
  const seen = new Set();
  for (const scenario of summary.scenarios) {
    if (!scenario || typeof scenario !== 'object' || typeof scenario.stableTestId !== 'string' || !scenario.stableTestId.includes('::')) {
      throw new TypeError('protected shard scenario has malformed stable ID');
    }
    const id = scenario.stableTestId;
    if (seen.has(id)) throw new TypeError(`protected shard contains duplicate stable ID: ${id}`);
    seen.add(id);
    if (!hostedSet.has(id)) throw new TypeError(`protected shard contains unexpected non-hosted stable ID: ${id}`);
    if (scenario.status === 'skipped' || scenario.skipReason != null) throw new TypeError(`protected shard skipped stable ID is forbidden: ${id}`);
    if (scenario.status !== 'passed') throw new TypeError(`protected shard scenario status is not passed: ${id}`);
    if (scenario.retry !== 0) throw new TypeError(`protected shard retry is forbidden: ${id}`);
    executed.push(id);
  }

  return Object.freeze({
    schemaVersion: 1,
    status: 'success',
    cancelled: false,
    candidateHeadSha: protectedPlan.candidateHeadSha,
    controllerSourceSha: protectedPlan.controller.sourceSha,
    planDigest: protectedPlan.planDigest,
    planExpectedStableTestIdsDigest: protectedPlan.expectedStableTestIdsDigest,
    expectedStableTestIdsDigest: hostedExpectedStableTestIdsDigest,
    productIdentitiesDigest: protectedPlan.productIdentitiesDigest,
    workerPolicyDigest: protectedPlan.workerPolicyDigest,
    executionPolicyDigest: protectedPlan.executionPolicyDigest,
    shardIndex,
    shardCount,
    retries: 0,
    skippedStableTestIds: Object.freeze([]),
    executedStableTestIds: Object.freeze(executed.sort()),
  });
}

function parseArgs(argv) {
  const required = ['--plan', '--execution', '--summary', '--shard-index', '--shard-count'];
  if (argv.length !== required.length * 2) throw new TypeError(`usage: protected-hosted-shard-summary.mjs ${required.join(' <value> ')}`);
  const result = {};
  for (let index = 0; index < argv.length; index += 2) {
    const flag = argv[index];
    const value = argv[index + 1];
    if (!required.includes(flag) || value == null || Object.hasOwn(result, flag)) throw new TypeError('protected shard summary CLI requires unique arguments');
    result[flag] = value;
  }
  if (required.some((flag) => !Object.hasOwn(result, flag))) throw new TypeError('protected shard summary CLI is incomplete');
  return result;
}

function readJson(pathname, label) {
  try { return JSON.parse(fs.readFileSync(pathname, 'utf8')); }
  catch (error) { throw new TypeError(`cannot read ${label}: ${error.message}`); }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  try {
    const args = parseArgs(process.argv.slice(2));
    const result = buildProtectedHostedShardSummary({
      plan: readJson(args['--plan'], 'plan'),
      execution: readJson(args['--execution'], 'execution'),
      summary: readJson(args['--summary'], 'summary'),
      shardIndex: Number(args['--shard-index']),
      shardCount: Number(args['--shard-count']),
    });
    process.stdout.write(`${JSON.stringify(result)}\n`);
  } catch (error) {
    process.stderr.write(`${error.message}\n`);
    process.exitCode = 1;
  }
}
