import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import { buildVerificationPlan } from '../../tools/verification/build-verification-plan.mjs';

const catalog = {
  schemaVersion: 2,
  groups: {
    'deterministic.core': { specs: ['tests/verification/*.test.mjs'], projects: [], resourceClass: 'cpu-light', evidence: 'machine-summary', capabilities: { browser: false, hosted: true, requiresPublication: false, dataCapability: 'qualification_fixture', visualReview: false, specialistReason: null } },
    'e2e.common-smoke': { specs: ['e2e/tests/desktop.spec.mjs', 'e2e/tests/mobile.spec.mjs'], projects: ['desktop-chromium', 'mobile-chromium'], resourceClass: 'browser-targeted', evidence: 'machine-summary', capabilities: { browser: true, hosted: true, requiresPublication: true, dataCapability: 'qualification_fixture', visualReview: false, specialistReason: null } },
    'e2e.creatures': { specs: ['e2e/tests/creatures-desktop.spec.mjs'], projects: ['desktop-chromium'], resourceClass: 'browser-targeted', evidence: 'machine-summary', capabilities: { browser: true, hosted: true, requiresPublication: true, dataCapability: 'qualification_fixture', visualReview: false, specialistReason: null } },
    'visual.creatures': { specs: ['e2e/tests/visual-desktop.spec.mjs'], projects: ['desktop-chromium'], resourceClass: 'browser-targeted', evidence: 'restricted-visual-review', capabilities: { browser: true, hosted: false, requiresPublication: true, dataCapability: 'bounded_real_world', visualReview: true, specialistReason: 'private-visual' } },
    'e2e.full': { specs: ['e2e/tests/*.spec.mjs'], projects: ['desktop-chromium', 'mobile-chromium'], resourceClass: 'browser-full', evidence: 'machine-summary', capabilities: { browser: true, hosted: true, requiresPublication: true, dataCapability: 'qualification_fixture', visualReview: false, specialistReason: null } },
  },
};

const trustedImpactManifest = {
  schemaVersion: 2,
  entries: [
    { pathPrefix: 'docs/', domains: ['documentation'], minimumProfile: 'none', requiredGroups: [] },
    { pathPrefix: 'tools/dyn-atlas-semantic/', domains: ['generator'], minimumProfile: 'focused', requiredGroups: ['deterministic.core'] },
    { pathPrefix: 'src/browser/creature-', domains: ['creatures'], minimumProfile: 'targeted', requiredGroups: ['deterministic.core', 'e2e.common-smoke', 'e2e.creatures', 'visual.creatures'] },
    { pathPrefix: 'src/browser/', domains: ['browser-runtime'], minimumProfile: 'broad', requiredGroups: ['deterministic.core', 'e2e.common-smoke'] },
    { pathPrefix: 'tools/verification/', domains: ['verification-governance'], minimumProfile: 'full', requiredGroups: ['deterministic.core', 'e2e.full'] },
  ],
  crossDomainEscalations: [],
};

function build(changedFiles, candidateImpactManifest = trustedImpactManifest) {
  return buildVerificationPlan({
    repository: 'Oteryn/Oteryn-Atlas',
    headSha: 'a'.repeat(40),
    integrationBaseSha: 'b'.repeat(40),
    mergeBaseSha: 'c'.repeat(40),
    changedFiles,
    trustedImpactManifest,
    candidateImpactManifest,
    verificationCatalog: catalog,
  });
}

test('planner selects a deterministic targeted union across current and rename-source paths', () => {
  const plan = build([
    { path: 'src/browser/creature-interaction.mjs', previousPath: 'tools/dyn-atlas-semantic/legacy.mjs' },
  ]);

  assert.equal(plan.profile, 'broad');
  assert.deepEqual(plan.requiredGroupIds, [
    'deterministic.core', 'e2e.common-smoke', 'e2e.creatures', 'visual.creatures',
  ]);
  assert.deepEqual(plan.impactDomains, ['browser-runtime', 'creatures', 'generator']);
  assert.deepEqual(plan.appliedCrossDomainEscalations, []);
  assert.equal(plan.shadowOnly, true);
  assert.match(plan.changedPathsDigest, /^sha256:[a-f0-9]{64}$/);
  assert.match(plan.impactPolicyDigest, /^sha256:[a-f0-9]{64}$/);
  assert.match(plan.verificationCatalogDigest, /^sha256:[a-f0-9]{64}$/);
  assert(Object.isFrozen(plan));
});

test('planner composes every overlapping rule and expands declared dependency closure', () => {
  const compositionalCatalog = structuredClone(catalog);
  compositionalCatalog.groups['e2e.runtime'] = {
    specs: ['e2e/tests/state-desktop.spec.mjs'], projects: ['desktop-chromium'], resourceClass: 'browser-broad', evidence: 'machine-summary', capabilities: { browser: true, hosted: true, requiresPublication: true, dataCapability: 'qualification_fixture', visualReview: false, specialistReason: null },
  };
  compositionalCatalog.groups['e2e.geometry'] = {
    specs: ['e2e/tests/geometry-desktop.spec.mjs'], projects: ['desktop-chromium'], resourceClass: 'render-geometry', evidence: 'machine-summary', capabilities: { browser: true, hosted: true, requiresPublication: true, dataCapability: 'qualification_fixture', visualReview: false, specialistReason: null },
  };
  compositionalCatalog.groups['e2e.creatures'].dependsOnGroups = ['e2e.geometry'];
  const compositionalManifest = structuredClone(trustedImpactManifest);
  compositionalManifest.entries[2].requiredGroups = ['deterministic.core', 'e2e.creatures'];
  compositionalManifest.entries[3].requiredGroups = ['e2e.runtime'];

  const plan = buildVerificationPlan({
    repository: 'Oteryn/Oteryn-Atlas',
    headSha: 'a'.repeat(40), integrationBaseSha: 'b'.repeat(40), mergeBaseSha: 'c'.repeat(40),
    changedFiles: [{ path: 'src/browser/creature-interaction.mjs' }],
    trustedImpactManifest: compositionalManifest,
    candidateImpactManifest: compositionalManifest,
    verificationCatalog: compositionalCatalog,
  });

  assert.deepEqual(plan.requiredGroupIds, ['deterministic.core', 'e2e.creatures', 'e2e.geometry', 'e2e.runtime']);
  assert.equal(plan.profile, 'broad');
});

test('data capability is independent from verification profile and only real_fullworld routes to specialist execution', () => {
  const capabilityCatalog = structuredClone(catalog);
  for (const group of Object.values(capabilityCatalog.groups)) group.capabilities.dataCapability = 'qualification_fixture';
  capabilityCatalog.groups['e2e.full'].capabilities.dataCapability = 'qualification_fixture';
  capabilityCatalog.groups['e2e.real-world'] = {
    specs: ['e2e/tests/overview-scale-desktop.spec.mjs'], projects: ['desktop-chromium'], resourceClass: 'browser-full', evidence: 'machine-summary',
    capabilities: { browser: true, hosted: false, requiresPublication: true, dataCapability: 'real_fullworld', visualReview: false, specialistReason: 'lan-hardware' },
  };
  const capabilityManifest = structuredClone(trustedImpactManifest);
  capabilityManifest.entries.push({ pathPrefix: 'tools/fullworld-generator/', domains: ['fullworld-generator'], minimumProfile: 'full', requiredGroups: ['deterministic.core', 'e2e.real-world'] });

  const hostedFull = buildVerificationPlan({
    repository: 'Oteryn/Oteryn-Atlas', headSha: 'a'.repeat(40), integrationBaseSha: 'b'.repeat(40), mergeBaseSha: 'c'.repeat(40),
    changedFiles: [{ path: 'tools/verification/classify-pr-changes.mjs' }], trustedImpactManifest: capabilityManifest, candidateImpactManifest: capabilityManifest,
    verificationCatalog: capabilityCatalog,
  });
  assert.equal(hostedFull.profile, 'full');
  assert.equal(hostedFull.requiresRealFullWorld, false);
  assert.deepEqual(hostedFull.requiredDataCapabilities, ['qualification_fixture']);

  const specialist = buildVerificationPlan({
    repository: 'Oteryn/Oteryn-Atlas', headSha: 'a'.repeat(40), integrationBaseSha: 'b'.repeat(40), mergeBaseSha: 'c'.repeat(40),
    changedFiles: [{ path: 'tools/fullworld-generator/change.mjs' }], trustedImpactManifest: capabilityManifest, candidateImpactManifest: capabilityManifest,
    verificationCatalog: capabilityCatalog,
  });
  assert.equal(specialist.requiresRealFullWorld, true);
  assert.deepEqual(specialist.requiredDataCapabilities, ['qualification_fixture', 'real_fullworld']);
});

test('planner fails closed to full for unknown, empty, malformed and governance evidence', () => {
  for (const changedFiles of [
    [],
    [{ path: 'new-runtime-surface/index.mjs' }],
    [{ path: 'src/../browser/app.mjs' }],
    [{ path: 'tools/verification/classify-pr-changes.mjs' }],
  ]) {
    const plan = build(changedFiles);
    assert.equal(plan.profile, 'full');
    assert.deepEqual(plan.requiredGroupIds, ['deterministic.core', 'e2e.full']);
  }
});

test('candidate policy cannot narrow trusted-base requirements', () => {
  const narrowedCandidate = {
    schemaVersion: 2,
    entries: [{
      pathPrefix: 'src/browser/creature-', domains: ['creatures'], minimumProfile: 'none', requiredGroups: [],
    }],
    crossDomainEscalations: [],
  };
  const plan = build([{ path: 'src/browser/creature-interaction.mjs' }], narrowedCandidate);

  assert.equal(plan.profile, 'broad');
  assert.deepEqual(plan.requiredGroupIds, [
    'deterministic.core', 'e2e.common-smoke', 'e2e.creatures', 'visual.creatures',
  ]);
});

test('candidate catalog cannot narrow a trusted stable group definition', () => {
  const narrowedCandidateCatalog = structuredClone(catalog);
  narrowedCandidateCatalog.groups['e2e.full'].specs = ['e2e/tests/desktop.spec.mjs'];
  narrowedCandidateCatalog.groups['e2e.full'].projects = ['desktop-chromium'];
  const plan = buildVerificationPlan({
    repository: 'Oteryn/Oteryn-Atlas',
    headSha: 'a'.repeat(40),
    integrationBaseSha: 'b'.repeat(40),
    mergeBaseSha: 'c'.repeat(40),
    changedFiles: [{ path: 'tools/verification/classify-pr-changes.mjs' }],
    trustedImpactManifest,
    candidateImpactManifest: trustedImpactManifest,
    trustedVerificationCatalog: catalog,
    candidateVerificationCatalog: narrowedCandidateCatalog,
  });

  const full = plan.groups.find((group) => group.id === 'e2e.full');
  assert.deepEqual(full.specs, ['e2e/tests/*.spec.mjs', 'e2e/tests/desktop.spec.mjs']);
  assert.deepEqual(full.projects, ['desktop-chromium', 'mobile-chromium']);
});

test('planner output is byte-stable for equivalent ordered changed-file evidence', () => {
  const first = JSON.stringify(build([{ path: 'src/browser/creature-interaction.mjs' }]));
  const second = JSON.stringify(build([{ path: 'src/browser/creature-interaction.mjs' }]));
  assert.equal(first, second);
});

test('planner binds merge-base and diff identity to the exact candidate', () => {
  const plan = buildVerificationPlan({
    repository: 'Oteryn/Oteryn-Atlas',
    headSha: 'a'.repeat(40),
    integrationBaseSha: 'b'.repeat(40),
    mergeBaseSha: 'c'.repeat(40),
    changedFiles: [{ path: 'src/browser/creature-interaction.mjs' }],
    trustedImpactManifest,
    candidateImpactManifest: trustedImpactManifest,
    verificationCatalog: catalog,
  });

  assert.equal(plan.mergeBaseSha, 'c'.repeat(40));
  assert.match(plan.diffIdentity, /^sha256:[a-f0-9]{64}$/);
  assert.match(plan.workerPolicyDigest, /^sha256:[a-f0-9]{64}$/);
});

test('full plan binds the exact protected stable-ID set and its recoverable digest', () => {
  const protectedStableTestIds = [
    'desktop-chromium::e2e/tests/desktop.spec.mjs::desktop fullworld',
    'mobile-chromium::e2e/tests/mobile.spec.mjs::mobile fullworld',
  ];
  const plan = buildVerificationPlan({
    repository: 'Oteryn/Oteryn-Atlas',
    headSha: 'a'.repeat(40), integrationBaseSha: 'b'.repeat(40), mergeBaseSha: 'c'.repeat(40),
    changedFiles: [{ path: 'tools/verification/classify-pr-changes.mjs' }],
    trustedImpactManifest,
    candidateImpactManifest: trustedImpactManifest,
    verificationCatalog: catalog,
    protectedStableTestIds,
  });

  assert.equal(plan.profile, 'full');
  assert.deepEqual(plan.stableTestIds, protectedStableTestIds);
  assert.match(plan.expectedStableTestIdsDigest, /^sha256:[a-f0-9]{64}$/);
  assert.equal(plan.stableIdAlgorithm.id, 'atlas-stable-id-v2');
});

test('planner CLI emits a canonical shadow plan from explicit trusted and candidate inputs', () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'atlas-plan-'));
  const files = {
    changed: path.join(directory, 'changed.json'),
    trusted: path.join(directory, 'trusted.json'),
    candidate: path.join(directory, 'candidate.json'),
    catalog: path.join(directory, 'catalog.json'),
  };
  fs.writeFileSync(files.changed, JSON.stringify([{ path: 'src/browser/creature-interaction.mjs' }]));
  fs.writeFileSync(files.trusted, JSON.stringify(trustedImpactManifest));
  fs.writeFileSync(files.candidate, JSON.stringify(trustedImpactManifest));
  fs.writeFileSync(files.catalog, JSON.stringify(catalog));
  const planner = fileURLToPath(new URL('../../tools/verification/build-verification-plan.mjs', import.meta.url));
  const result = spawnSync(process.execPath, [
    planner,
    '--changed-files', files.changed,
    '--trusted-impact', files.trusted,
    '--candidate-impact', files.candidate,
    '--catalog', files.catalog,
    '--repository', 'Oteryn/Oteryn-Atlas',
    '--head-sha', 'a'.repeat(40),
    '--integration-base-sha', 'b'.repeat(40),
    '--merge-base-sha', 'c'.repeat(40),
  ], { encoding: 'utf8' });

  assert.equal(result.status, 0, result.stderr);
  const plan = JSON.parse(result.stdout);
  assert.equal(plan.profile, 'broad');
  assert.equal(plan.shadowOnly, true);
  fs.rmSync(directory, { recursive: true, force: true });
});
