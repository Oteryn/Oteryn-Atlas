import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const modulePath = '../../tools/verification/selective-execution.mjs';
const rolloutPath = 'tools/verification/selective-rollout.json';

function plan(profile, groups = []) {
  return { schemaVersion: 1, profile, requiredGroupIds: groups, stableTestIds: ['desktop-chromium::tests/x.spec.mjs::x'], retryPolicy: { retries: 0 } };
}

test('rollout contract is versioned and cannot activate without calibration evidence', async () => {
  assert.equal(fs.existsSync(rolloutPath), true, `${rolloutPath} is missing`);
  const rollout = JSON.parse(fs.readFileSync(rolloutPath, 'utf8'));
  assert.equal(rollout.schemaVersion, 1);
  assert.equal(typeof rollout.enabled, 'boolean');
  assert.match(rollout.workerPolicyDigest ?? '', /^sha256:[a-f0-9]{64}$/);
  assert.match(rollout.calibrationEvidenceDigest ?? '', /^sha256:[a-f0-9]{64}$/);
});

test('disabled rollout preserves legacy full-heavy authority and force-full only widens', async () => {
  const { decideSelectiveExecution } = await import(modulePath);
  const rollout = { schemaVersion: 1, enabled: false };
  const disabled = decideSelectiveExecution({ plan: plan('none'), rollout, forceFull: false });
  assert.equal(disabled.executionProfile, 'full');
  assert.equal(disabled.requiresHeavyBrowser, true);
  const forced = decideSelectiveExecution({ plan: plan('targeted', ['e2e.common-smoke']), rollout: { ...rollout, enabled: true }, forceFull: true });
  assert.equal(forced.executionProfile, 'full');
  assert.equal(forced.requiresHeavyBrowser, true);
});

test('enabled rollout follows exact plan profiles while unknown/malformed input fails closed', async () => {
  const { decideSelectiveExecution } = await import(modulePath);
  const rollout = { schemaVersion: 1, enabled: true };
  assert.equal(decideSelectiveExecution({ plan: plan('none'), rollout }).requiresHeavyBrowser, false);
  assert.equal(decideSelectiveExecution({ plan: plan('focused', ['deterministic.core']), rollout }).requiresHeavyBrowser, false);
  assert.equal(decideSelectiveExecution({ plan: plan('targeted', ['e2e.common-smoke']), rollout }).executionProfile, 'targeted');
  assert.equal(decideSelectiveExecution({ plan: plan('broad', ['e2e.common-smoke']), rollout }).executionProfile, 'broad');
  assert.equal(decideSelectiveExecution({ plan: plan('full', ['e2e.full']), rollout }).executionProfile, 'full');
  assert.equal(decideSelectiveExecution({ plan: { profile: 'mystery' }, rollout }).executionProfile, 'full');
  assert.equal(decideSelectiveExecution({ plan: null, rollout }).executionProfile, 'full');
});
