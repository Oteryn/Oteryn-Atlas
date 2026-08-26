const PROFILES = new Set(['none', 'focused', 'targeted', 'broad', 'full']);
const DIGEST = /^sha256:[a-f0-9]{64}$/;

function full(reason) {
  return Object.freeze({
    schemaVersion: 1,
    executionProfile: 'full',
    requiredGroupIds: Object.freeze(['deterministic.core', 'e2e.full']),
    requiresHeavyBrowser: true,
    reason,
  });
}

function validRollout(rollout) {
  if (!rollout || rollout.schemaVersion !== 1 || typeof rollout.enabled !== 'boolean') return false;
  if (!rollout.enabled) return rollout.workerPolicyDigest === null && rollout.calibrationEvidenceDigest === null;
  return DIGEST.test(rollout.workerPolicyDigest ?? '') && DIGEST.test(rollout.calibrationEvidenceDigest ?? '');
}

function validPlan(plan) {
  return Boolean(plan)
    && plan.schemaVersion === 1
    && PROFILES.has(plan.profile)
    && Array.isArray(plan.requiredGroupIds)
    && Array.isArray(plan.stableTestIds)
    && plan.retryPolicy?.retries === 0;
}

export function decideSelectiveExecution({ plan, rollout, forceFull = false } = {}) {
  if (forceFull) return full('force-full-widening');
  if (!validRollout(rollout)) return full('invalid-rollout-fail-closed');
  if (!rollout.enabled) return full('selective-rollout-disabled');
  if (!validPlan(plan)) return full('invalid-plan-fail-closed');

  const groups = [...new Set(plan.requiredGroupIds)].sort();
  if (plan.profile === 'none' || plan.profile === 'focused') {
    return Object.freeze({
      schemaVersion: 1,
      executionProfile: plan.profile,
      requiredGroupIds: Object.freeze(groups),
      requiresHeavyBrowser: false,
      reason: 'calibrated-selective-plan',
    });
  }
  if (plan.profile === 'targeted' || plan.profile === 'broad') {
    const heavy = groups.some((group) => group.startsWith('e2e.') || group.startsWith('visual.'));
    return Object.freeze({
      schemaVersion: 1,
      executionProfile: plan.profile,
      requiredGroupIds: Object.freeze(groups),
      requiresHeavyBrowser: heavy,
      reason: 'calibrated-selective-plan',
    });
  }
  return full('plan-requires-full');
}
