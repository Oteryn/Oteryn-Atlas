import assert from 'node:assert/strict';
import test from 'node:test';

import { buildVerificationPlan } from '../../tools/verification/build-verification-plan.mjs';

const capabilities = { browser: true, hosted: true, requiresPublication: true, dataCapability: 'qualification_fixture', visualReview: false, specialistReason: null };
const catalog = {
  schemaVersion: 2,
  groups: {
    'deterministic.core': {
      specs: ['tests/verification/*.test.mjs'], projects: [], resourceClass: 'cpu-light', evidence: 'machine-summary',
      capabilities: { ...capabilities, browser: false, requiresPublication: false },
    },
    'e2e.common-smoke': {
      specs: ['e2e/tests/desktop.spec.mjs'], projects: ['desktop-chromium'], resourceClass: 'browser-targeted', evidence: 'machine-summary', capabilities,
    },
    'e2e.geometry': {
      specs: ['e2e/tests/geometry-desktop.spec.mjs'], projects: ['desktop-chromium'], resourceClass: 'render-geometry', evidence: 'machine-summary', capabilities,
    },
    'e2e.cross-domain': {
      specs: ['e2e/tests/state-desktop.spec.mjs'], projects: ['desktop-chromium'], resourceClass: 'browser-broad', evidence: 'machine-summary', capabilities,
      dependsOnGroups: ['e2e.geometry'],
    },
    'e2e.full': {
      specs: ['e2e/tests/desktop.spec.mjs'], projects: ['desktop-chromium'], resourceClass: 'browser-full', evidence: 'machine-summary', capabilities,
    },
  },
};

const entries = [
  { pathPrefix: 'src/browser/feature/', domains: ['feature-ui'], minimumProfile: 'targeted', requiredGroups: ['e2e.common-smoke'] },
  { pathPrefix: 'tools/dyn-atlas-semantic/', domains: ['generator'], minimumProfile: 'focused', requiredGroups: ['deterministic.core'] },
];
const trustedImpactManifest = {
  schemaVersion: 2,
  entries,
  crossDomainEscalations: [{
    whenDomains: ['feature-ui', 'generator'], minimumProfile: 'broad', requiredGroups: ['e2e.cross-domain'],
  }],
};

function plan(candidateImpactManifest) {
  return buildVerificationPlan({
    repository: 'Oteryn/Oteryn-Atlas',
    headSha: 'a'.repeat(40), integrationBaseSha: 'b'.repeat(40), mergeBaseSha: 'c'.repeat(40),
    changedFiles: [
      { path: 'src/browser/feature/controller.mjs' },
      { path: 'tools/dyn-atlas-semantic/compiler.py' },
    ],
    trustedImpactManifest,
    candidateImpactManifest,
    verificationCatalog: catalog,
  });
}

test('trusted cross-domain escalation survives candidate narrowing and expands dependencies afterwards', () => {
  const candidateImpactManifest = { schemaVersion: 2, entries, crossDomainEscalations: [] };
  const result = plan(candidateImpactManifest);

  assert.equal(result.profile, 'broad');
  assert.deepEqual(result.impactDomains, ['feature-ui', 'generator']);
  assert.deepEqual(result.requiredGroupIds, [
    'deterministic.core', 'e2e.common-smoke', 'e2e.cross-domain', 'e2e.geometry',
  ]);
});

test('candidate cross-domain escalation may widen but never narrow protected requirements', () => {
  const candidateImpactManifest = {
    schemaVersion: 2,
    entries,
    crossDomainEscalations: [{
      whenDomains: ['feature-ui', 'generator'], minimumProfile: 'full', requiredGroups: ['e2e.full'],
    }],
  };
  const result = plan(candidateImpactManifest);

  assert.equal(result.profile, 'full');
  assert.deepEqual(result.requiredGroupIds, [
    'deterministic.core', 'e2e.common-smoke', 'e2e.cross-domain', 'e2e.full', 'e2e.geometry',
  ]);
});
