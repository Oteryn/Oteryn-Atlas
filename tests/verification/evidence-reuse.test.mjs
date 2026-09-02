import assert from 'node:assert/strict';
import test from 'node:test';

import { buildEvidenceManifest } from '../../tools/verification/evidence-manifest.mjs';
import { resolveReusableEvidence } from '../../tools/verification/evidence-reuse.mjs';

const sha = 'a'.repeat(40);
const semantic = `sha256:${'1'.repeat(64)}`;
const instance = `sha256:${'2'.repeat(64)}`;
const authority = `sha256:${'3'.repeat(64)}`;
const environment = `sha256:${'4'.repeat(64)}`;
const product = `sha256:${'5'.repeat(64)}`;
const policy = `sha256:${'6'.repeat(64)}`;
const stableTestIds = ['desktop-chromium::e2e/tests/desktop.spec.mjs::loads fixture'];

function evidence(overrides = {}) {
  return buildEvidenceManifest({
    evidenceId: 'hosted.qualification-fixture', evidenceType: 'HOSTED_FUNCTIONAL_PARTITION',
    result: 'SUCCESS', disposition: 'EXECUTED', candidateHeadSha: sha,
    planSemanticDigest: semantic, planInstanceDigest: instance, authorityDigest: authority,
    environmentDigest: environment,
    productIdentities: { qualification_fixture: { id: 'atlas-qualification-world-v2', digest: product } },
    stableTestIds, executionPolicyDigest: policy,
    runProvenance: { repository: 'Oteryn/Oteryn-Atlas', runId: 100, runAttempt: 1, jobName: 'hosted-shards', artifactName: 'hosted-shard-1' },
    dependencies: { evidenceDigests: [], evidenceSemanticDigests: [], paths: ['e2e/', 'src/browser/'], dataCapabilities: ['qualification_fixture'] },
    availability: { expiresAt: '2099-01-01T00:00:00.000Z', revoked: false },
    ...overrides,
  });
}

function expected(overrides = {}, source = evidence()) {
  return {
    evidenceId: source.evidenceId, candidateHeadSha: sha, planSemanticDigest: semantic,
    evidenceSemanticDigest: source.evidenceSemanticDigest, authorityDigest: authority,
    environmentDigest: environment, productIdentities: source.productIdentities,
    stableTestIds: source.stableTestIds, executionPolicyDigest: policy,
    dependencies: source.dependencies, now: '2026-08-30T00:00:00.000Z', ...overrides,
  };
}

test('all exact dependency identities plus successful available bytes are reusable', () => {
  const source = evidence();
  const result = resolveReusableEvidence(expected({ availableEvidenceDigests: [source.evidenceDigest] }, source), source);
  assert.equal(result.reusable, true);
  assert.equal(result.reason, 'MATCH');
});

test('same semantic evidence remains reusable across candidate SHA provenance changes', () => {
  const source = evidence();
  const result = resolveReusableEvidence(expected({
    candidateHeadSha: 'b'.repeat(40),
    availableEvidenceDigests: [source.evidenceDigest],
  }, source), source);
  assert.equal(result.reusable, true);
  assert.equal(result.reason, 'MATCH');
});

test('authority, environment, policy and stable-ID mismatches are rejected', () => {
  const source = evidence();
  const cases = [
    [{ authorityDigest: `sha256:${'8'.repeat(64)}` }, /authority/i],
    [{ environmentDigest: `sha256:${'8'.repeat(64)}` }, /environment/i],
    [{ executionPolicyDigest: `sha256:${'8'.repeat(64)}` }, /policy/i],
    [{ stableTestIds: ['desktop-chromium::e2e/tests/other.spec.mjs::other'] }, /stable|test.set/i],
  ];
  for (const [overrides, pattern] of cases) {
    const result = resolveReusableEvidence(expected(overrides, source), source);
    assert.equal(result.reusable, false);
    assert.match(result.reason, pattern);
  }
});

test('product mismatch rejects only the node that declares that product dependency', () => {
  const source = evidence();
  const mismatch = resolveReusableEvidence(expected({
    productIdentities: { qualification_fixture: { id: 'atlas-qualification-world-v2', digest: `sha256:${'9'.repeat(64)}` } },
  }, source), source);
  assert.equal(mismatch.reusable, false);
  assert.match(mismatch.reason, /product/i);
  const productIndependent = evidence({
    evidenceId: 'deterministic.core', evidenceType: 'DETERMINISTIC', productIdentities: {},
    dependencies: { evidenceDigests: [], evidenceSemanticDigests: [], paths: ['tools/'], dataCapabilities: [] },
  });
  assert.equal(resolveReusableEvidence(expected({ evidenceId: 'deterministic.core', productIdentities: {} }, productIndependent), productIndependent).reusable, true);
});

test('dependency semantic mismatch or unavailable dependency/source bytes fail closed', () => {
  const dependencyDigest = `sha256:${'7'.repeat(64)}`;
  const dependencySemanticDigest = `sha256:${'8'.repeat(64)}`;
  const source = evidence({ dependencies: {
    evidenceDigests: [dependencyDigest], evidenceSemanticDigests: [dependencySemanticDigest],
    paths: ['e2e/', 'src/browser/'], dataCapabilities: ['qualification_fixture'],
  } });
  const mismatch = resolveReusableEvidence(expected({ dependencies: {
    ...source.dependencies, evidenceSemanticDigests: [`sha256:${'9'.repeat(64)}`],
  } }, source), source);
  assert.equal(mismatch.reusable, false);
  assert.match(mismatch.reason, /dependency.semantic/i);
  const unavailable = resolveReusableEvidence(expected({ availableEvidenceDigests: [source.evidenceDigest] }, source), source);
  assert.equal(unavailable.reusable, false);
  assert.match(unavailable.reason, /dependency.evidence.bytes/i);
  const executed = evidence();
  const reused = evidence({ disposition: 'REUSED', sourceEvidenceDigest: executed.evidenceDigest, compatibilityDigest: `sha256:${'a'.repeat(64)}` });
  const missingSource = resolveReusableEvidence(expected({
    evidenceSemanticDigest: reused.evidenceSemanticDigest, availableEvidenceDigests: [reused.evidenceDigest],
  }, reused), reused);
  assert.equal(missingSource.reusable, false);
  assert.match(missingSource.reason, /source.evidence.bytes/i);
});

test('expired, unavailable, revoked, failed or affected evidence is rejected', () => {
  assert.equal(resolveReusableEvidence(expected(), evidence({ availability: { expiresAt: '2020-01-01T00:00:00.000Z', revoked: false } })).reusable, false);
  assert.equal(resolveReusableEvidence(expected(), evidence({ availability: { expiresAt: '2099-01-01T00:00:00.000Z', revoked: true } })).reusable, false);
  assert.equal(resolveReusableEvidence(expected({ availableEvidenceDigests: [] }), evidence()).reusable, false);
  assert.equal(resolveReusableEvidence(expected({ affectedEvidenceIds: ['hosted.qualification-fixture'] }), evidence()).reusable, false);
  assert.equal(resolveReusableEvidence(expected(), evidence({ result: 'FAILURE', failureClass: 'ENVIRONMENT_FAILURE' })).reusable, false);
});

test('reuse compares validated manifest bytes, not an ambient green GitHub check', () => {
  const candidate = evidence();
  const result = resolveReusableEvidence(expected({}, candidate), { ...candidate, planSemanticDigest: `sha256:${'0'.repeat(64)}` });
  assert.equal(result.reusable, false);
  assert.match(result.reason, /invalid manifest/i);
});