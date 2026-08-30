import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import { buildProtectedExecutionEnvironmentIdentity } from '../../tools/verification/protected-execution-environment.mjs';
import { stableIdAlgorithm } from '../../tools/verification/stable-id.mjs';
import { buildProtectedHostedPlan } from '../../tools/verification/protected-hosted-plan.mjs';
import { buildVerificationAuthorityIdentity } from '../../tools/verification/verification-authority.mjs';

const authorityManifest = {
  schemaVersion: 1,
  authorityId: 'atlas-protected-verification-authority-v1',
  components: [{ id: 'planner', path: 'tools/verification/protected-hosted-plan.mjs' }],
};
const authorityIdentity = await buildVerificationAuthorityIdentity({
  manifest: authorityManifest,
  readFile: async () => 'planner-v1\n',
});
const changedAuthorityIdentity = await buildVerificationAuthorityIdentity({
  manifest: authorityManifest,
  readFile: async () => 'planner-v2\n',
});
const environmentConfig = JSON.parse(await readFile(
  new URL('../../tools/verification/protected-execution-environment.json', import.meta.url),
  'utf8',
));
const environmentIdentity = buildProtectedExecutionEnvironmentIdentity(environmentConfig);
const changedEnvironmentIdentity = buildProtectedExecutionEnvironmentIdentity({
  ...environmentConfig,
  execution: { ...environmentConfig.execution, timeoutSeconds: 121 },
});

const baseId = 'desktop-chromium::e2e/tests/desktop.spec.mjs::base contract survives';
const productDigest = `sha256:${'1'.repeat(64)}`;

function catalog() {
  return {
    schemaVersion: 2,
    groups: {
      'deterministic.core': {
        specs: ['tests/verification/*.test.mjs'],
        projects: [],
        resourceClass: 'cpu-light',
        evidence: 'machine-summary',
        capabilities: {
          browser: false,
          hosted: true,
          requiresPublication: false,
          dataCapability: 'qualification_fixture',
          visualReview: false,
          specialistReason: null,
        },
        fullSafetyNet: true,
      },
      'e2e.full': {
        specs: ['e2e/tests/desktop.spec.mjs'],
        projects: ['desktop-chromium'],
        resourceClass: 'browser-full',
        evidence: 'machine-summary',
        capabilities: {
          browser: true,
          hosted: true,
          requiresPublication: true,
          dataCapability: 'qualification_fixture',
          visualReview: false,
          specialistReason: null,
        },
        fullSafetyNet: true,
      },
    },
  };
}

function impact() {
  return {
    schemaVersion: 2,
    entries: [{
      pathPrefix: 'src/',
      domains: ['browser-runtime'],
      minimumProfile: 'full',
      requiredGroups: ['deterministic.core', 'e2e.full'],
    }],
    crossDomainEscalations: [],
  };
}

function census(ids) {
  return { schemaVersion: 1, stableIdAlgorithm, stableTestIds: ids };
}

function input(overrides = {}) {
  const candidateHeadSha = overrides.candidateHeadSha ?? 'b'.repeat(40);
  return {
    repository: 'Oteryn/Oteryn-Atlas',
    prNumber: 272,
    protectedBaseSha: 'a'.repeat(40),
    candidateHeadSha,
    mergeBaseSha: 'c'.repeat(40),
    changedFiles: [{ path: 'src/browser/app.mjs' }],
    trustedImpactManifest: impact(),
    candidateImpactManifest: impact(),
    trustedVerificationCatalog: catalog(),
    candidateVerificationCatalog: catalog(),
    protectedCensus: census([baseId]),
    candidateCensus: {
      schemaVersion: 1,
      status: 'success',
      candidateHeadSha,
      sandboxPolicyId: 'atlas-candidate-census-sandbox-v1',
      census: census([baseId]),
    },
    productIdentities: {
      qualification_fixture: { id: 'atlas-qualification-world-v2', digest: productDigest },
    },
    authorityIdentity,
    environmentIdentity,
    ...overrides,
  };
}

function build(overrides = {}) {
  return buildProtectedHostedPlan(input(overrides));
}

test('protected plan emits distinct semantic and forensic instance identities', () => {
  const plan = build();
  assert.equal(plan.schemaVersion, 3);
  assert.equal(plan.controller.id, 'atlas-protected-hosted-controller-v3');
  assert.equal(plan.authorityDigest, authorityIdentity.authorityDigest);
  assert.equal(plan.environmentDigest, environmentIdentity.environmentDigest);
  assert.match(plan.changeSetDigest, /^sha256:[a-f0-9]{64}$/);
  assert.match(plan.planSemanticDigest, /^sha256:[a-f0-9]{64}$/);
  assert.match(plan.planInstanceDigest, /^sha256:[a-f0-9]{64}$/);
  assert.notEqual(plan.planSemanticDigest, plan.planInstanceDigest);
  assert.equal(plan.planDigest, undefined);
});

test('unrelated protected base and PR-instance movement changes only planInstanceDigest', () => {
  const first = build();
  const second = build({
    prNumber: 999,
    protectedBaseSha: 'd'.repeat(40),
    mergeBaseSha: 'e'.repeat(40),
  });
  assert.equal(first.planSemanticDigest, second.planSemanticDigest);
  assert.notEqual(first.planInstanceDigest, second.planInstanceDigest);
});

test('candidate, authority and environment changes alter semantic identity', () => {
  const baseline = build();
  assert.notEqual(build({ candidateHeadSha: 'f'.repeat(40) }).planSemanticDigest, baseline.planSemanticDigest);
  assert.notEqual(build({ authorityIdentity: changedAuthorityIdentity }).planSemanticDigest, baseline.planSemanticDigest);
  assert.notEqual(build({ environmentIdentity: changedEnvironmentIdentity }).planSemanticDigest, baseline.planSemanticDigest);
});

test('missing or tampered authority/environment identity fails closed', () => {
  assert.throws(() => build({ authorityIdentity: undefined }), /authority/i);
  assert.throws(() => build({ environmentIdentity: undefined }), /environment/i);
  assert.throws(
    () => build({ authorityIdentity: { ...authorityIdentity, authorityDigest: `sha256:${'0'.repeat(64)}` } }),
    /authority/i,
  );
});

test('protected plan controller source is always the protected base', () => {
  const baseline = build();
  assert.equal(baseline.controller.sourceSha, baseline.protectedBaseSha);
  assert.throws(() => build({ controllerSourceSha: 'b'.repeat(40) }), /controller.*protected base/i);
});
