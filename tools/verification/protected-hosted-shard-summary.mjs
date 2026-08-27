import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

const SHA = /^[a-f0-9]{40}$/;
const SHA256 = /^sha256:[a-f0-9]{64}$/;
const BROWSER_CONTAINER = 'mcr.microsoft.com/playwright:v1.62.0-noble@sha256:baed2032d533817f3dbe6425de795788430ba345e819a1201337009ba17c9d07';
const WORKER_POLICY = Object.freeze({ id: 'atlas-protected-hosted-workers-v1', version: 1, hostedShards: 2, workersPerShard: 1 });
const SOURCE_PLACEMENTS = new Set(['protected', 'candidate-additions']);
const HOSTED_DATA_CAPABILITIES = new Set(['qualification_fixture', 'bounded_real_world']);

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

function validatePartitions(value, hosted, protectedHosted, candidateAdditions) {
  if (value == null) return [];
  if (!Array.isArray(value)) throw new TypeError('protected shard hosted data capability partitions must be an array');
  const hostedSet = new Set(hosted);
  const protectedSet = new Set(protectedHosted);
  const additionsSet = new Set(candidateAdditions);
  const seenCapabilities = new Set();
  const seenIds = new Set();
  const partitions = value.map((partition) => {
    if (!partition || typeof partition !== 'object' || Array.isArray(partition)) {
      throw new TypeError('protected shard data capability partition must be an object');
    }
    const dataCapability = partition.dataCapability;
    if (!HOSTED_DATA_CAPABILITIES.has(dataCapability)) {
      throw new TypeError(`protected shard hosted data capability is unsupported: ${dataCapability ?? ''}`);
    }
    if (seenCapabilities.has(dataCapability)) throw new TypeError(`protected shard duplicate data capability partition: ${dataCapability}`);
    seenCapabilities.add(dataCapability);
    const stableTestIds = stableIds(partition.stableTestIds, `${dataCapability} stable IDs`);
    const protectedStableTestIds = stableIds(partition.protectedStableTestIds, `${dataCapability} protected stable IDs`, { allowEmpty: true });
    const candidateAdditionalStableTestIds = stableIds(partition.candidateAdditionalStableTestIds, `${dataCapability} candidate-addition stable IDs`, { allowEmpty: true });
    const sourcePartition = [...new Set([...protectedStableTestIds, ...candidateAdditionalStableTestIds])].sort();
    if (sourcePartition.length !== stableTestIds.length || sourcePartition.some((id, index) => id !== stableTestIds[index])) {
      throw new TypeError(`protected shard ${dataCapability} source placement must exactly partition stable IDs`);
    }
    if (protectedStableTestIds.some((id) => candidateAdditionalStableTestIds.includes(id))) {
      throw new TypeError(`protected shard ${dataCapability} source placement overlaps`);
    }
    for (const id of stableTestIds) {
      if (!hostedSet.has(id)) throw new TypeError(`protected shard ${dataCapability} contains a non-hosted stable ID`);
      if (seenIds.has(id)) throw new TypeError(`protected shard stable ID appears in duplicate data capability partitions: ${id}`);
      seenIds.add(id);
    }
    if (protectedStableTestIds.some((id) => !protectedSet.has(id))) {
      throw new TypeError(`protected shard ${dataCapability} contains a non-protected source ID`);
    }
    if (candidateAdditionalStableTestIds.some((id) => !additionsSet.has(id))) {
      throw new TypeError(`protected shard ${dataCapability} contains a non-candidate-addition source ID`);
    }
    return Object.freeze({ dataCapability, stableTestIds, protectedStableTestIds, candidateAdditionalStableTestIds });
  });
  const partitionIds = [...seenIds].sort();
  if (partitionIds.length !== hosted.length || partitionIds.some((id, index) => id !== hosted[index])) {
    throw new TypeError('protected shard data capability partitions must exactly partition hosted stable IDs');
  }
  return partitions;
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
  const protectedHosted = stableIds(execution.hosted?.protectedStableTestIds, 'protected hosted stable IDs', { allowEmpty: true });
  const candidateAdditions = stableIds(execution.hosted?.candidateAdditionalStableTestIds, 'candidate-addition hosted stable IDs', { allowEmpty: true });
  const specialist = stableIds(execution.specialist?.stableTestIds, 'specialist stable IDs', { allowEmpty: true });
  const specialistSet = new Set(specialist);
  if (hosted.some((id) => specialistSet.has(id))) throw new TypeError('hosted and specialist stable-ID placement overlaps');
  const partition = [...new Set([...protectedHosted, ...candidateAdditions])].sort();
  if (partition.length !== hosted.length || partition.some((id, index) => id !== hosted[index])) {
    throw new TypeError('protected shard hosted source placement must exactly partition hosted stable IDs');
  }
  if (protectedHosted.some((id) => candidateAdditions.includes(id))) {
    throw new TypeError('protected shard hosted source placement overlaps');
  }
  const partitions = validatePartitions(execution.hosted?.partitions, hosted, protectedHosted, candidateAdditions);
  return { hosted, protectedHosted, candidateAdditions, specialist, hostedExpectedStableTestIdsDigest, partitions };
}

function normalizeSummaries(summary, summaries) {
  if (summary != null && summaries != null) throw new TypeError('protected shard evidence accepts summary or summaries, not both');
  const values = summaries ?? (summary == null ? null : [summary]);
  if (!Array.isArray(values) || values.length === 0 || values.length > 2) {
    throw new TypeError('protected shard evidence requires one or two source summaries');
  }
  return values;
}

function validateRawSummary(summary, protectedPlan, allowedStableIds, sourceLabel, seen, executed) {
  if (!summary || typeof summary !== 'object' || Array.isArray(summary)) throw new TypeError(`protected shard ${sourceLabel} summary must be an object`);
  if (summary.status !== 'passed') throw new TypeError(`protected shard ${sourceLabel} summary status must be passed`);
  if (summary.cancelled === true) throw new TypeError(`cancelled protected shard ${sourceLabel} evidence is forbidden`);
  const metadata = summary.metadata;
  if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) throw new TypeError(`protected shard ${sourceLabel} metadata is required`);
  same(metadata.targetMode, 'checkout-overlay', `${sourceLabel} target mode`);
  same(exactSha(metadata.expectedRevision, `${sourceLabel} summary expected revision`), protectedPlan.candidateHeadSha, `${sourceLabel} revision`);
  same(exactDigest(metadata.verificationPlanSha256, `${sourceLabel} summary verification plan digest`), protectedPlan.planDigest, `${sourceLabel} plan digest`);
  same(metadata.browserContainer, BROWSER_CONTAINER, `${sourceLabel} browser container`);
  same(metadata.workers, protectedPlan.workerPolicy.workersPerShard, `${sourceLabel} worker count`);
  if (!Array.isArray(summary.scenarios)) throw new TypeError(`protected shard ${sourceLabel} scenarios must be an array`);

  const allowed = new Set(allowedStableIds);
  for (const scenario of summary.scenarios) {
    if (!scenario || typeof scenario !== 'object' || typeof scenario.stableTestId !== 'string' || !scenario.stableTestId.includes('::')) {
      throw new TypeError(`protected shard ${sourceLabel} scenario has malformed stable ID`);
    }
    const id = scenario.stableTestId;
    if (seen.has(id)) throw new TypeError(`protected shard contains duplicate stable ID across source summaries: ${id}`);
    seen.add(id);
    if (!allowed.has(id)) throw new TypeError(`protected shard ${sourceLabel} contains unexpected stable ID: ${id}`);
    if (scenario.status === 'skipped' || scenario.skipReason != null) throw new TypeError(`protected shard skipped stable ID is forbidden: ${id}`);
    if (scenario.status !== 'passed') throw new TypeError(`protected shard scenario status is not passed: ${id}`);
    if (scenario.retry !== 0) throw new TypeError(`protected shard retry is forbidden: ${id}`);
    executed.push(id);
  }
}

function validateCapabilitySources(sourceSummaries, partitions, protectedPlan, seen, executed) {
  if (!Array.isArray(sourceSummaries) || sourceSummaries.length === 0) {
    throw new TypeError('protected shard capability source summaries must be a non-empty array');
  }
  if (!partitions.length) throw new TypeError('protected shard capability source summaries require hosted data capability partitions');
  const expected = new Map();
  for (const partition of partitions) {
    if (partition.protectedStableTestIds.length) expected.set(`protected\0${partition.dataCapability}`, partition.protectedStableTestIds);
    if (partition.candidateAdditionalStableTestIds.length) expected.set(`candidate-additions\0${partition.dataCapability}`, partition.candidateAdditionalStableTestIds);
  }
  const supplied = new Set();
  for (const source of sourceSummaries) {
    if (!source || typeof source !== 'object' || Array.isArray(source) || !SOURCE_PLACEMENTS.has(source.placement)) {
      throw new TypeError('protected shard capability source requires a valid placement');
    }
    if (!HOSTED_DATA_CAPABILITIES.has(source.dataCapability)) {
      throw new TypeError(`protected shard capability source is unsupported: ${source.dataCapability ?? ''}`);
    }
    const key = `${source.placement}\0${source.dataCapability}`;
    const allowed = expected.get(key);
    if (!allowed) throw new TypeError(`protected shard capability source is unexpected: ${source.placement}/${source.dataCapability}`);
    if (supplied.has(key)) throw new TypeError(`protected shard duplicate capability source: ${source.placement}/${source.dataCapability}`);
    supplied.add(key);
    validateRawSummary(source.summary, protectedPlan, allowed, `${source.placement}:${source.dataCapability}`, seen, executed);
  }
  for (const key of expected.keys()) {
    if (!supplied.has(key)) {
      const [placement, dataCapability] = key.split('\0');
      throw new TypeError(`protected shard capability source is missing: ${placement}/${dataCapability}`);
    }
  }
}

export function buildProtectedHostedShardSummary({ plan, execution, summary, summaries, sourceSummaries, shardIndex, shardCount }) {
  const protectedPlan = validatePlan(plan);
  const { hosted, protectedHosted, candidateAdditions, hostedExpectedStableTestIdsDigest, partitions } = validateExecution(execution, protectedPlan);
  if (!Number.isSafeInteger(shardCount) || shardCount !== protectedPlan.workerPolicy.hostedShards
    || !Number.isSafeInteger(shardIndex) || shardIndex < 0 || shardIndex >= shardCount) {
    throw new TypeError('protected shard count/index does not match worker policy');
  }

  const executed = [];
  const seen = new Set();
  if (sourceSummaries != null) {
    if (summary != null || summaries != null) throw new TypeError('protected shard capability sources cannot be combined with legacy summary arguments');
    validateCapabilitySources(sourceSummaries, partitions, protectedPlan, seen, executed);
  } else {
    const rawSummaries = normalizeSummaries(summary, summaries);
    validateRawSummary(rawSummaries[0], protectedPlan, protectedHosted, 'protected-body', seen, executed);
    if (rawSummaries.length === 2) {
      if (candidateAdditions.length === 0) throw new TypeError('candidate-addition summary is forbidden when no candidate additions are planned');
      validateRawSummary(rawSummaries[1], protectedPlan, candidateAdditions, 'candidate-additions', seen, executed);
    }
  }
  const hostedSet = new Set(hosted);
  if (executed.some((id) => !hostedSet.has(id))) throw new TypeError('protected shard source evidence escaped hosted placement');

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
  if (argv.length < 10 || argv.length % 2 !== 0) {
    throw new TypeError('usage: protected-hosted-shard-summary.mjs --plan <plan> --execution <execution> (--summary <summary> [--additional-summary <summary>] | --source-manifest <manifest>) --shard-index <index> --shard-count <count>');
  }
  const allowed = ['--plan', '--execution', '--summary', '--additional-summary', '--source-manifest', '--shard-index', '--shard-count'];
  const result = {};
  for (let index = 0; index < argv.length; index += 2) {
    const flag = argv[index];
    const value = argv[index + 1];
    if (!allowed.includes(flag) || value == null || Object.hasOwn(result, flag)) throw new TypeError('protected shard summary CLI requires unique arguments');
    result[flag] = value;
  }
  for (const required of ['--plan', '--execution', '--shard-index', '--shard-count']) {
    if (!Object.hasOwn(result, required)) throw new TypeError('protected shard summary CLI is incomplete');
  }
  const legacy = Object.hasOwn(result, '--summary');
  const manifest = Object.hasOwn(result, '--source-manifest');
  if (legacy === manifest) throw new TypeError('protected shard summary CLI requires exactly one source evidence mode');
  if (!legacy && Object.hasOwn(result, '--additional-summary')) throw new TypeError('additional summary requires legacy summary mode');
  return result;
}

function readJson(pathname, label) {
  try { return JSON.parse(fs.readFileSync(pathname, 'utf8')); }
  catch (error) { throw new TypeError(`cannot read ${label}: ${error.message}`); }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  try {
    const args = parseArgs(process.argv.slice(2));
    let sourceSummaries;
    let rawSummaries;
    if (args['--source-manifest']) {
      const manifest = readJson(args['--source-manifest'], 'capability source manifest');
      if (!Array.isArray(manifest)) throw new TypeError('capability source manifest must be an array');
      sourceSummaries = manifest.map((source) => {
        if (!source || typeof source !== 'object' || typeof source.summaryPath !== 'string' || source.summaryPath.length === 0) {
          throw new TypeError('capability source manifest entry requires summaryPath');
        }
        return {
          placement: source.placement,
          dataCapability: source.dataCapability,
          summary: readJson(source.summaryPath, `${source.placement ?? 'unknown'}/${source.dataCapability ?? 'unknown'} summary`),
        };
      });
    } else {
      rawSummaries = [readJson(args['--summary'], 'protected-body summary')];
      if (args['--additional-summary']) rawSummaries.push(readJson(args['--additional-summary'], 'candidate-additions summary'));
    }
    const result = buildProtectedHostedShardSummary({
      plan: readJson(args['--plan'], 'plan'),
      execution: readJson(args['--execution'], 'execution'),
      summaries: rawSummaries,
      sourceSummaries,
      shardIndex: Number(args['--shard-index']),
      shardCount: Number(args['--shard-count']),
    });
    process.stdout.write(`${JSON.stringify(result)}\n`);
  } catch (error) {
    process.stderr.write(`${error.message}\n`);
    process.exitCode = 1;
  }
}
