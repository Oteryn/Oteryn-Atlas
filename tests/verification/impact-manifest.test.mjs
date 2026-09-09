import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
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

function readRepositoryJson(relativePath) {
  return JSON.parse(readFileSync(new URL(relativePath, import.meta.url), 'utf8'));
}

function executionRowsFor(node, spec, rows = []) {
  if (Array.isArray(node)) {
    for (const value of node) executionRowsFor(value, spec, rows);
    return rows;
  }
  if (!node || typeof node !== 'object') return rows;
  if (node.spec === spec && typeof node.interpreter === 'string' && Array.isArray(node.argv)) rows.push(node);
  for (const value of Object.values(node)) executionRowsFor(value, spec, rows);
  return rows;
}

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

test('META provider governance consumers are exact-routed and execution-owned by protected verification', () => {
  const manifest = readRepositoryJson('../../tools/verification/impact-manifest.json');
  const canonicalCatalog = readRepositoryJson('../../tools/verification/verification-catalog.json');
  const exactRoutes = [
    'tools/governance/test_agent_prompt_lifecycle.mjs',
    'tools/governance/validate_meta_agent_policy.py',
  ];

  for (const path of exactRoutes) {
    const matches = manifest.entries.filter((entry) => entry.pathPrefix === path && entry.exactMatch === true);
    assert.equal(matches.length, 1, `${path} must have exactly one protected exact impact route`);
    assert.equal(matches[0].minimumProfile, 'focused', `${path} should require focused deterministic qualification`);
    assert.deepEqual(matches[0].requiredGroups, ['deterministic.core'], `${path} must route to deterministic.core`);
  }
  assert.equal(
    manifest.entries.some((entry) => entry.pathPrefix === 'tools/governance/' && entry.exactMatch !== true),
    false,
    'META adoption must not broaden all tools/governance paths into a permissive catch-all route',
  );

  const expectedOwners = [
    { spec: 'tools/governance/test_agent_prompt_lifecycle.mjs', interpreter: 'node', argv: ['--test', 'tools/governance/test_agent_prompt_lifecycle.mjs'] },
    { spec: 'tools/governance/test_validate_meta_agent_policy.py', interpreter: 'python3', argv: ['tools/governance/test_validate_meta_agent_policy.py'] },
  ];
  const coreSpecs = canonicalCatalog.groups['deterministic.core'].specs;
  for (const expected of expectedOwners) {
    assert(coreSpecs.includes(expected.spec), `${expected.spec} must be a deterministic.core spec`);
    const rows = executionRowsFor(canonicalCatalog, expected.spec);
    assert.equal(rows.length, 1, `${expected.spec} must have exactly one canonical execution owner`);
    assert.equal(rows[0].interpreter, expected.interpreter, `${expected.spec} interpreter must be explicit`);
    assert.deepEqual(rows[0].argv, expected.argv, `${expected.spec} argv must be exact`);
    assert.match(rows[0].sourceSha256 ?? '', /^[0-9a-f]{64}$/u, `${expected.spec} must carry exact source SHA-256 ownership`);
  }
});
