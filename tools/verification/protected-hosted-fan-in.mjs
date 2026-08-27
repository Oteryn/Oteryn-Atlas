const SHA = /^[a-f0-9]{40}$/;
const SHA256 = /^sha256:[a-f0-9]{64}$/;

function exactSha(value, label) {
  if (typeof value !== 'string' || !SHA.test(value)) throw new TypeError(`${label} must be an exact lowercase SHA`);
  return value;
}

function exactDigest(value, label) {
  if (typeof value !== 'string' || !SHA256.test(value)) throw new TypeError(`${label} must be sha256:<64 lowercase hex>`);
  return value;
}

function stableIds(value, label, allowEmpty = false) {
  if (!Array.isArray(value) || (!allowEmpty && value.length === 0)
    || value.some((id) => typeof id !== 'string' || !id.includes('::'))) {
    throw new TypeError(`${label} must contain stable IDs`);
  }
  if (new Set(value).size !== value.length) throw new TypeError(`${label} contains duplicate stable IDs`);
  return [...value];
}

function sameIdentity(summary, plan, field, label) {
  const planned = exactDigest(plan[field], `plan ${label}`);
  const actual = exactDigest(summary[field], `summary ${label}`);
  if (actual !== planned) throw new TypeError(`fan-in ${label} mismatch`);
}

export function validateProtectedHostedFanIn(plan, summaries, { currentHeadSha } = {}) {
  if (!plan || typeof plan !== 'object' || Array.isArray(plan) || plan.schemaVersion !== 2) {
    throw new TypeError('fan-in requires protected hosted plan schemaVersion 2');
  }
  if (plan.controller?.id !== 'atlas-protected-hosted-controller-v2' || plan.controller?.version !== 2) {
    throw new TypeError('fan-in controller identity is invalid');
  }
  const controllerSourceSha = exactSha(plan.controller.sourceSha, 'plan controller source SHA');
  const candidateHeadSha = exactSha(plan.candidateHeadSha, 'plan candidate head');
  if (exactSha(currentHeadSha, 'current PR head') !== candidateHeadSha) throw new TypeError('fan-in current PR head is stale');
  const planDigest = exactDigest(plan.planDigest, 'plan digest');
  const expectedDigest = exactDigest(plan.expectedStableTestIdsDigest, 'plan expected stable-ID digest');
  const expected = stableIds(plan.stableTestIds, 'planned stable IDs').sort();
  exactDigest(plan.productIdentitiesDigest, 'plan product identities digest');
  exactDigest(plan.workerPolicyDigest, 'plan worker policy digest');
  exactDigest(plan.executionPolicyDigest, 'plan execution policy digest');
  if (plan.retryPolicy?.retries !== 0) throw new TypeError('fan-in plan retries must be zero');
  if (plan.selectiveExecution !== false) throw new TypeError('fan-in plan selective execution must remain disabled');
  if (!Array.isArray(summaries) || summaries.length === 0) throw new TypeError('fan-in requires shard summaries');

  let shardCount = null;
  const shardIndexes = new Set();
  const executed = [];
  const seenStableIds = new Set();

  for (const summary of summaries) {
    if (!summary || typeof summary !== 'object' || Array.isArray(summary) || summary.schemaVersion !== 1) {
      throw new TypeError('fan-in summary schema is invalid');
    }
    if (summary.status !== 'success') throw new TypeError('fan-in summary status is not success');
    if (summary.cancelled !== false) throw new TypeError('fan-in cancelled evidence cannot satisfy qualification');
    if (summary.retries !== 0) throw new TypeError('fan-in retries must be zero');
    if (exactSha(summary.candidateHeadSha, 'summary candidate head') !== candidateHeadSha) throw new TypeError('fan-in candidate head mismatch');
    if (exactSha(summary.controllerSourceSha, 'summary controller source SHA') !== controllerSourceSha) throw new TypeError('fan-in controller identity mismatch');
    if (exactDigest(summary.planDigest, 'summary plan digest') !== planDigest) throw new TypeError('fan-in plan digest mismatch');
    if (exactDigest(summary.expectedStableTestIdsDigest, 'summary expected stable-ID digest') !== expectedDigest) {
      throw new TypeError('fan-in expected stable-ID digest mismatch');
    }
    sameIdentity(summary, plan, 'productIdentitiesDigest', 'product identities digest');
    sameIdentity(summary, plan, 'workerPolicyDigest', 'worker policy digest');
    sameIdentity(summary, plan, 'executionPolicyDigest', 'execution policy digest');

    if (!Number.isSafeInteger(summary.shardCount) || summary.shardCount < 1
      || !Number.isSafeInteger(summary.shardIndex) || summary.shardIndex < 0 || summary.shardIndex >= summary.shardCount) {
      throw new TypeError('fan-in shard identity is invalid');
    }
    if (shardCount == null) shardCount = summary.shardCount;
    if (summary.shardCount !== shardCount) throw new TypeError('fan-in sibling shard count mismatch');
    if (shardIndexes.has(summary.shardIndex)) throw new TypeError(`fan-in duplicate shard index: ${summary.shardIndex}`);
    shardIndexes.add(summary.shardIndex);

    const skipped = stableIds(summary.skippedStableTestIds, 'skipped stable IDs', true);
    if (skipped.length) throw new TypeError(`fan-in skipped stable IDs are forbidden: ${skipped.join(', ')}`);
    for (const id of stableIds(summary.executedStableTestIds, 'executed stable IDs', true)) {
      if (seenStableIds.has(id)) throw new TypeError(`fan-in duplicate stable ID: ${id}`);
      seenStableIds.add(id);
      executed.push(id);
    }
  }

  if (summaries.length !== shardCount) throw new TypeError(`fan-in partial sibling evidence: expected ${shardCount} shards, received ${summaries.length}`);
  for (let index = 0; index < shardCount; index += 1) {
    if (!shardIndexes.has(index)) throw new TypeError(`fan-in missing sibling shard index: ${index}`);
  }

  const unexpected = executed.filter((id) => !expected.includes(id)).sort();
  if (unexpected.length) throw new TypeError(`fan-in unexpected stable IDs: ${unexpected.join(', ')}`);
  const missing = expected.filter((id) => !seenStableIds.has(id));
  if (missing.length) throw new TypeError(`fan-in missing stable IDs: ${missing.join(', ')}`);

  return Object.freeze({
    status: 'success',
    candidateHeadSha,
    planDigest,
    executedStableTestIds: Object.freeze([...executed].sort()),
  });
}
