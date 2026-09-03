import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

import {
  validateImpactManifest,
  validateVerificationCatalog,
} from '../../tools/verification/verification-plan-schema.mjs';

const catalog = {
  schemaVersion: 2,
  groups: {
    'deterministic.core': {
      specs: ['tests/verification/*.test.mjs'],
      projects: [],
      resourceClass: 'cpu-light',
      evidence: 'machine-summary',
      capabilities: { browser: false, hosted: true, requiresPublication: false, dataCapability: 'qualification_fixture', visualReview: false, specialistReason: null },
    },
    'e2e.common-smoke': {
      specs: ['e2e/tests/desktop.spec.mjs', 'e2e/tests/mobile.spec.mjs'],
      projects: ['desktop-chromium', 'mobile-chromium'],
      resourceClass: 'browser-targeted',
      evidence: 'machine-summary',
      capabilities: { browser: true, hosted: true, requiresPublication: true, dataCapability: 'qualification_fixture', visualReview: false, specialistReason: null },
    },
  },
};

const v2Manifest = {
  schemaVersion: 2,
  entries: [
    {
      pathPrefix: 'src/browser/feature/',
      domains: ['feature-ui'],
      minimumProfile: 'targeted',
      requiredGroups: ['deterministic.core'],
    },
    {
      pathPrefix: 'tools/dyn-atlas-semantic/',
      domains: ['generator'],
      minimumProfile: 'focused',
      requiredGroups: ['deterministic.core'],
    },
  ],
  crossDomainEscalations: [{
    whenDomains: ['feature-ui', 'generator'],
    minimumProfile: 'broad',
    requiredGroups: ['e2e.common-smoke'],
  }],
};

test('impact manifest accepts explicit cross-domain escalation rules with allowlisted groups', () => {
  const manifest = validateImpactManifest(v2Manifest, catalog);

  assert.equal(manifest.schemaVersion, 2);
  assert.deepEqual(manifest.entries[0].requiredGroups, ['deterministic.core']);
  assert.deepEqual(manifest.crossDomainEscalations, [{
    whenDomains: ['feature-ui', 'generator'],
    minimumProfile: 'broad',
    requiredGroups: ['e2e.common-smoke'],
  }]);
  assert(Object.isFrozen(manifest));
});

test('repository policy keeps verification test bodies deterministic-only while executable verification authority remains full', () => {
  const manifest = JSON.parse(fs.readFileSync(new URL('../../tools/verification/impact-manifest.json', import.meta.url), 'utf8'));
  const rule = (pathPrefix) => manifest.entries.find((entry) => entry.pathPrefix === pathPrefix);

  assert.deepEqual(rule('tests/verification/'), {
    pathPrefix: 'tests/verification/',
    domains: ['verification-governance'],
    minimumProfile: 'focused',
    requiredGroups: ['deterministic.core'],
  });
  for (const pathPrefix of ['tools/verification/', '.github/workflows/']) {
    assert.deepEqual(rule(pathPrefix), {
      pathPrefix,
      domains: ['verification-governance'],
      minimumProfile: 'full',
      requiredGroups: ['deterministic.core', 'e2e.full'],
    });
  }
});

test('impact manifest rejects malformed path rules and cross-domain escalations', () => {
  const invalidCandidates = [
    { ...v2Manifest, entries: [{ pathPrefix: 'src/../browser/', domains: ['runtime'], minimumProfile: 'broad', requiredGroups: ['deterministic.core'] }] },
    { ...v2Manifest, entries: [{ pathPrefix: 'src/browser/', domains: ['runtime'], minimumProfile: 'broad', requiredGroups: ['not-catalogued'] }] },
    { ...v2Manifest, entries: [
      { pathPrefix: 'src/browser/', domains: ['runtime'], minimumProfile: 'broad', requiredGroups: ['deterministic.core'] },
      { pathPrefix: 'src/browser/', domains: ['runtime'], minimumProfile: 'broad', requiredGroups: ['deterministic.core'] },
    ] },
    { ...v2Manifest, crossDomainEscalations: [{ whenDomains: ['feature-ui'], minimumProfile: 'broad', requiredGroups: ['e2e.common-smoke'] }] },
    { ...v2Manifest, crossDomainEscalations: [{ whenDomains: ['feature-ui', 'feature-ui'], minimumProfile: 'broad', requiredGroups: ['e2e.common-smoke'] }] },
    { ...v2Manifest, crossDomainEscalations: [{ whenDomains: ['feature-ui', 'generator'], minimumProfile: 'impossible', requiredGroups: ['e2e.common-smoke'] }] },
    { ...v2Manifest, crossDomainEscalations: [{ whenDomains: ['feature-ui', 'generator'], minimumProfile: 'broad', requiredGroups: ['not-catalogued'] }] },
    { ...v2Manifest, crossDomainEscalations: [
      { whenDomains: ['feature-ui', 'generator'], minimumProfile: 'broad', requiredGroups: ['e2e.common-smoke'] },
      { whenDomains: ['generator', 'feature-ui'], minimumProfile: 'broad', requiredGroups: ['e2e.common-smoke'] },
    ] },
  ];
  for (const candidate of invalidCandidates) {
    assert.throws(() => validateImpactManifest(candidate, catalog), /impact manifest/i);
  }
});

test('impact manifest rejects arbitrary legacy schema v1 rather than silently bypassing v2 escalation policy', () => {
  assert.throws(() => validateImpactManifest({
    schemaVersion: 1,
    entries: [{ pathPrefix: 'src/browser/', domains: ['runtime'], minimumProfile: 'none', requiredGroups: [] }],
  }, catalog), /legacy|schemaVersion|impact manifest/i);
});

test('verification catalog rejects arbitrary commands and unsafe resource metadata', () => {
  assert.throws(() => validateVerificationCatalog({
    schemaVersion: 1,
    groups: {
      unsafe: {
        specs: ['e2e/tests/desktop.spec.mjs; rm -rf /'],
        projects: ['desktop-chromium'],
        resourceClass: 'browser-targeted',
        evidence: 'machine-summary', capabilities: { browser: true, hosted: true, requiresPublication: true, visualReview: false, specialistReason: null },
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

test('verification catalog requires semantic execution capability rather than name-derived browser inference', () => {
  assert.throws(() => validateVerificationCatalog({
    schemaVersion: 2,
    groups: {
      misleading: {
        specs: ['e2e/tests/desktop.spec.mjs'], projects: ['desktop-chromium'], resourceClass: 'cpu-light', evidence: 'machine-summary',
      },
    },
  }), /capabilit|schemaVersion/i);
});

test('verification catalog rejects a real_fullworld group that could run on GitHub-hosted infrastructure', () => {
  const invalid = structuredClone(catalog);
  invalid.groups['e2e.common-smoke'].capabilities.dataCapability = 'real_fullworld';
  assert.throws(() => validateVerificationCatalog(invalid), /real_fullworld.*specialist/i);
});
