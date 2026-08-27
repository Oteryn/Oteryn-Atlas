import assert from 'node:assert/strict';
import test from 'node:test';

import { buildVerificationPlan } from '../../tools/verification/build-verification-plan.mjs';
import { validateVerificationCatalog } from '../../tools/verification/verification-plan-schema.mjs';

const catalog = {
  schemaVersion: 1,
  groups: {
    'deterministic.core': {
      specs: ['tests/verification/*.test.mjs'],
      projects: [],
      resourceClass: 'cpu-light',
      evidence: 'machine-summary',
      capabilities: ['deterministic'],
    },
    'e2e.full': {
      specs: ['e2e/tests/*.spec.mjs'],
      projects: ['desktop-chromium'],
      resourceClass: 'browser-full',
      evidence: 'machine-summary',
      capabilities: ['browser-functional', 'native-gpu'],
    },
  },
};

const manifest = {
  schemaVersion: 1,
  entries: [{
    pathPrefix: 'runtime/',
    domains: ['browser-runtime'],
    minimumProfile: 'full',
    requiredGroups: ['deterministic.core', 'e2e.full'],
  }],
};

test('planner exposes semantic capabilities and derives native-hardware truth from capability metadata', () => {
  const plan = buildVerificationPlan({
    repository: 'Oteryn/Oteryn-Atlas',
    headSha: 'a'.repeat(40),
    integrationBaseSha: 'b'.repeat(40),
    mergeBaseSha: 'c'.repeat(40),
    changedFiles: [{ path: 'runtime/app.mjs' }],
    trustedImpactManifest: manifest,
    candidateImpactManifest: manifest,
    verificationCatalog: catalog,
  });

  assert.deepEqual(plan.requiredCapabilities, ['browser-functional', 'deterministic', 'native-gpu']);
  assert.equal(plan.requiresNativeHardware, true);
});

test('catalog rejects unknown semantic capability metadata fail closed', () => {
  const invalid = structuredClone(catalog);
  invalid.groups['e2e.full'].capabilities.push('mystery-capability');
  assert.throws(() => validateVerificationCatalog(invalid), /capabilit/i);
});
