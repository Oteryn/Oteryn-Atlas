import assert from 'node:assert/strict';
import test from 'node:test';

import {
  validateImpactManifest,
  validateVerificationCatalog,
} from '../../tools/verification/verification-plan-schema.mjs';

const catalog = {
  schemaVersion: 1,
  groups: {
    'deterministic.core': {
      specs: ['tests/verification/*.test.mjs'],
      projects: [],
      resourceClass: 'cpu-light',
      evidence: 'machine-summary',
    },
    'e2e.common-smoke': {
      specs: ['e2e/tests/desktop.spec.mjs', 'e2e/tests/mobile.spec.mjs'],
      projects: ['desktop-chromium', 'mobile-chromium'],
      resourceClass: 'browser-targeted',
      evidence: 'machine-summary',
    },
  },
};

test('impact manifest accepts versioned known-domain entries with allowlisted groups', () => {
  const manifest = validateImpactManifest({
    schemaVersion: 1,
    entries: [{
      pathPrefix: 'src/browser/feature/',
      domains: ['feature-ui'],
      minimumProfile: 'targeted',
      requiredGroups: ['deterministic.core', 'e2e.common-smoke'],
    }],
  }, catalog);

  assert.equal(manifest.schemaVersion, 1);
  assert.deepEqual(manifest.entries[0].requiredGroups, ['deterministic.core', 'e2e.common-smoke']);
  assert(Object.isFrozen(manifest));
});

test('impact manifest rejects unknown group, malformed prefix and duplicate entry', () => {
  for (const entries of [
    [{ pathPrefix: 'src/../browser/', domains: ['runtime'], minimumProfile: 'broad', requiredGroups: ['deterministic.core'] }],
    [{ pathPrefix: 'src/browser/', domains: ['runtime'], minimumProfile: 'broad', requiredGroups: ['not-catalogued'] }],
    [
      { pathPrefix: 'src/browser/', domains: ['runtime'], minimumProfile: 'broad', requiredGroups: ['deterministic.core'] },
      { pathPrefix: 'src/browser/', domains: ['runtime'], minimumProfile: 'broad', requiredGroups: ['deterministic.core'] },
    ],
  ]) {
    assert.throws(() => validateImpactManifest({ schemaVersion: 1, entries }, catalog), /impact manifest/i);
  }
});

test('verification catalog rejects arbitrary commands and unsafe resource metadata', () => {
  assert.throws(() => validateVerificationCatalog({
    schemaVersion: 1,
    groups: {
      unsafe: {
        specs: ['e2e/tests/desktop.spec.mjs; rm -rf /'],
        projects: ['desktop-chromium'],
        resourceClass: 'browser-targeted',
        evidence: 'machine-summary',
      },
    },
  }), /verification catalog/i);

  assert.throws(() => validateVerificationCatalog({
    schemaVersion: 1,
    groups: {
      unsafe: {
        specs: ['e2e/tests/desktop.spec.mjs'],
        projects: ['desktop-chromium'],
        resourceClass: 'arbitrary-shell',
        evidence: 'machine-summary',
      },
    },
  }), /verification catalog/i);
});
