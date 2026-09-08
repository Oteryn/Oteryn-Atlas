import assert from 'node:assert/strict';

// Inactive extracted policy, not a Docker/network executor or deployment grant.
// The caller must authenticate main/source observations and provide adapters.
// Source: suspended synology-live-acceptance staging, product validation,
// stop/rename/start and previous-container rollback. Live cutover is not atomic.
const sha = /^[0-9a-f]{40}$/;
const digest = /^sha256:[0-9a-f]{64}$/;
function requireValue(value, message) { if (!value) throw new Error(`deployment contract: ${message}`); }
export function planDeployment(input) {
  requireValue(input?.ref === 'refs/heads/main' && input.clean === true, 'clean merged main required');
  const revision = input.triggeringRevision;
  requireValue(sha.test(revision) && input.checkedOutRevision === revision && input.mergedMainRevision === revision, 'exact triggering main revision required');
  requireValue(sha.test(input.previousRevision) && input.previousMergedMainRevision === input.previousRevision, 'previous merged main revision required');
  requireValue(input.pythonNetwork === 'none', 'isolated Python execution required');
  requireValue(input.browserNetwork === 'bridge', 'browser bridge isolation required');
  let url; try { url = new URL(input.previewUrl); } catch { /* rejected below */ }
  requireValue(url && ['http:', 'https:'].includes(url.protocol) && !url.username && !url.password, 'HTTP preview URL required');
  requireValue(input.products && JSON.stringify(Object.keys(input.products).sort()) === JSON.stringify(['animation', 'creatures', 'gameplay']) && Object.values(input.products).every(value => digest.test(value)), 'exact candidate products required');
  return Object.freeze({ ...structuredClone(input), revision, products: Object.freeze({ ...input.products }) });
}
function exactRevision(observation, revision) {
  requireValue(observation?.labelRevision === revision && observation?.headerRevision === revision, 'container and HTTP revision mismatch');
}
function qualified(observation, plan) {
  exactRevision(observation, plan.revision);
  assert.deepEqual(observation.products, plan.products, 'deployment candidate products differ');
}
export async function runDeploymentTransaction(input, adapter) {
  const plan = planDeployment(input);
  for (const name of ['stage', 'qualifyCandidate', 'retainPrevious', 'startCandidate', 'acceptLive', 'restorePrevious', 'inspectPrevious']) requireValue(typeof adapter?.[name] === 'function', `missing ${name} adapter`);
  let retained = false;
  let failure;
  try {
    await adapter.stage(plan);
    qualified(await adapter.qualifyCandidate(plan), plan);
    // The operation can mutate and then throw. Require restoration before
    // entering it; restorePrevious must be idempotent when no rename occurred.
    // inspectPrevious must independently verify the restored active revision.
    retained = true;
    await adapter.retainPrevious(plan);
    await adapter.startCandidate(plan);
    qualified(await adapter.acceptLive(plan), plan);
  } catch (error) {
    failure = error;
    if (retained) {
      try {
        await adapter.restorePrevious(plan);
        exactRevision(await adapter.inspectPrevious(plan), plan.previousRevision);
      } catch (rollbackError) {
        failure = new AggregateError([error, rollbackError], 'deployment failed and previous revision restoration is unproven');
      }
    }
  }
  if (failure) throw failure;
  return { revision: plan.revision, previousRevision: plan.previousRevision, qualified: true };
}
