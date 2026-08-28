import assert from 'node:assert/strict';
import test from 'node:test';

import { stableIdAlgorithm } from '../../tools/verification/stable-id.mjs';
import { buildProtectedHostedPlan } from '../../tools/verification/protected-hosted-plan.mjs';

const protectedBaseSha = 'a'.repeat(40);
const candidateHeadSha = 'b'.repeat(40);
const mergeBaseSha = 'c'.repeat(40);
const productDigest = `sha256:${'1'.repeat(64)}`;

const baseId = 'desktop-chromium::e2e/tests/desktop.spec.mjs::base contract survives';
const candidateId = 'desktop-chromium::e2e/tests/candidate-new-desktop.spec.mjs::candidate adds coverage';

function group(specs = ['e2e/tests/desktop.spec.mjs']) {
  return {
    specs,
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
  };
}

function catalog(specs) {
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
      'e2e.full': group(specs),
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

function candidateCensus(ids, overrides = {}) {
  return {
    schemaVersion: 1,
    status: 'success',
    candidateHeadSha,
    sandboxPolicyId: 'atlas-candidate-census-sandbox-v1',
    census: census(ids),
    ...overrides,
  };
}

function build(overrides = {}) {
  const trustedCatalog = catalog(['e2e/tests/desktop.spec.mjs']);
  const candidateCatalog = catalog(['e2e/tests/desktop.spec.mjs', 'e2e/tests/candidate-new-desktop.spec.mjs']);
  return buildProtectedHostedPlan({
    repository: 'Oteryn/Oteryn-Atlas',
    prNumber: 179,
    protectedBaseSha,
    candidateHeadSha,
    mergeBaseSha,
    changedFiles: [{ path: 'src/browser/app.mjs' }],
    trustedImpactManifest: impact(),
    candidateImpactManifest: impact(),
    trustedVerificationCatalog: trustedCatalog,
    candidateVerificationCatalog: candidateCatalog,
    protectedCensus: census([baseId]),
    candidateCensus: candidateCensus([baseId, candidateId]),
    productIdentities: {
      qualification_fixture: { id: 'atlas-qualification-world-v2', digest: productDigest },
    },
    ...overrides,
  });
}

test('protected hosted plan preserves protected IDs and accepts candidate additions only as widening', () => {
  const plan = build();
  assert.equal(plan.controller.id, 'atlas-protected-hosted-controller-v2');
  assert.equal(plan.controller.sourceSha, protectedBaseSha);
  assert.equal(plan.protectedBaseSha, protectedBaseSha);
  assert.equal(plan.candidateHeadSha, candidateHeadSha);
  assert.equal(plan.mergeBaseSha, mergeBaseSha);
  assert.equal(plan.profile, 'full');
  assert.equal(plan.selectiveExecution, false);
  assert.equal(plan.retryPolicy.retries, 0);
  assert.equal(plan.requiresRealFullWorld, false);
  assert.deepEqual(plan.workerPolicy, {
    id: 'atlas-protected-hosted-workers-v1',
    version: 1,
    hostedShards: 1,
    workersPerShard: 1,
  });
  assert.equal(plan.workerPolicyId, 'atlas-protected-hosted-workers-v1');
  assert.deepEqual(plan.stableTestIds, [baseId, candidateId].sort());
  assert.deepEqual(plan.candidateStableIdAdditions, [candidateId]);
  assert.deepEqual(plan.productIdentities, {
    qualification_fixture: { id: 'atlas-qualification-world-v2', digest: productDigest },
  });
  for (const field of [
    'changedPathsDigest', 'trustedImpactManifestDigest', 'candidateImpactManifestDigest',
    'trustedVerificationCatalogDigest', 'candidateVerificationCatalogDigest',
    'stableIdAlgorithmDigest', 'protectedCensusDigest', 'candidateCensusDigest',
    'workerPolicyDigest', 'productIdentitiesDigest', 'expectedStableTestIdsDigest',
    'executionPolicyDigest', 'planDigest',
  ]) assert.match(plan[field], /^sha256:[a-f0-9]{64}$/, field);
});

test('candidate deletion or replacement cannot remove the protected-base stable ID', () => {
  const plan = build({ candidateCensus: candidateCensus([candidateId]) });
  assert.deepEqual(plan.stableTestIds, [baseId, candidateId].sort());
});

test('candidate census duplicate IDs fail closed', () => {
  assert.throws(() => build({ candidateCensus: candidateCensus([candidateId, candidateId]) }), /duplicate/i);
});

test('candidate census IDs outside catalogued projects or specs fail closed', () => {
  const unsupportedProject = 'mobile-chromium::e2e/tests/candidate-new-desktop.spec.mjs::unsupported project';
  const unsupportedSpec = 'desktop-chromium::e2e/tests/not-catalogued.spec.mjs::unsupported spec';
  assert.throws(() => build({ candidateCensus: candidateCensus([unsupportedProject]) }), /unsupported.*project|catalog/i);
  assert.throws(() => build({ candidateCensus: candidateCensus([unsupportedSpec]) }), /unsupported.*spec|catalog/i);
});

test('failed or mismatched candidate sandbox census cannot produce an authoritative plan', () => {
  assert.throws(() => build({ candidateCensus: candidateCensus([], { status: 'failed' }) }), /sandbox|census/i);
  assert.throws(() => build({ candidateCensus: candidateCensus([candidateId], { candidateHeadSha: 'd'.repeat(40) }) }), /candidate.*head/i);
  assert.throws(() => build({ candidateCensus: candidateCensus([candidateId], { sandboxPolicyId: 'candidate-controlled' }) }), /sandbox/i);
});

test('every required publication capability must have an exact product identity', () => {
  assert.throws(() => build({ productIdentities: {} }), /product.*qualification_fixture/i);
  assert.throws(() => build({ productIdentities: { qualification_fixture: { id: 'fixture', digest: 'not-a-digest' } } }), /product.*digest/i);
});
