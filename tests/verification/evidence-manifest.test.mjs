import assert from 'node:assert/strict';
import test from 'node:test';

import {
  buildEvidenceManifest,
  validateEvidenceManifest,
  validateEvidenceStableIdUnion,
} from '../../tools/verification/evidence-manifest.mjs';

const sha = 'a'.repeat(40);
const digests = {
  semantic: `sha256:${'1'.repeat(64)}`,
  instance: `sha256:${'2'.repeat(64)}`,
  authority: `sha256:${'3'.repeat(64)}`,
  environment: `sha256:${'4'.repeat(64)}`,
  product: `sha256:${'5'.repeat(64)}`,
  policy: `sha256:${'6'.repeat(64)}`,
  dependency: `sha256:${'7'.repeat(64)}`,
};

function manifest(overrides = {}) {
  return buildEvidenceManifest({
    evidenceId: 'hosted.qualification-fixture',
    evidenceType: 'HOSTED_FUNCTIONAL_PARTITION',
    result: 'SUCCESS',
    disposition: 'EXECUTED',
    candidateHeadSha: sha,
    planSemanticDigest: digests.semantic,
    planInstanceDigest: digests.instance,
    authorityDigest: digests.authority,
    semanticDependencyDigest: digests.dependency,
    environmentDigest: digests.environment,
    productIdentities: {
      qualification_fixture: { id: 'atlas-qualification-world-v2', digest: digests.product },
    },
    stableTestIds: [
      'desktop-chromium::e2e/tests/desktop.spec.mjs::loads fixture',
      'mobile-chromium::e2e/tests/mobile.spec.mjs::loads fixture',
    ],
    executionPolicyDigest: digests.policy,
    runProvenance: {
      repository: 'Oteryn/Oteryn-Atlas',
      runId: 100,
      runAttempt: 1,
      jobName: 'hosted-shards',
      artifactName: 'hosted-shard-1',
    },
    dependencies: {
      evidenceDigests: [],
      evidenceSemanticDigests: [],
      paths: ['e2e/', 'src/browser/'],
      dataCapabilities: ['qualification_fixture'],
    },
    availability: { expiresAt: '2099-01-01T00:00:00.000Z', revoked: false },
    ...overrides,
  });
}

test('executed evidence binds semantic dependencies, authority provenance, environment, product, test-set and policy identities', () => {
  const evidence = manifest();
  assert.equal(evidence.schemaVersion, 2);
  assert.equal(evidence.disposition, 'EXECUTED');
  assert.equal(evidence.result, 'SUCCESS');
  assert.equal(evidence.semanticDependencyDigest, digests.dependency);
  assert.match(evidence.stableTestIdsDigest, /^sha256:[a-f0-9]{64}$/);
  assert.match(evidence.evidenceSemanticDigest, /^sha256:[a-f0-9]{64}$/);
  assert.match(evidence.evidenceDigest, /^sha256:[a-f0-9]{64}$/);
  assert.deepEqual(evidence, validateEvidenceManifest(evidence));
  assert.ok(Object.isFrozen(evidence));
});

test('candidate SHA changes execution provenance without changing evidence semantic identity', () => {
  const first = manifest();
  const second = manifest({
    candidateHeadSha: 'b'.repeat(40),
    planInstanceDigest: `sha256:${'8'.repeat(64)}`,
  });
  assert.equal(first.evidenceSemanticDigest, second.evidenceSemanticDigest);
  assert.notEqual(first.evidenceDigest, second.evidenceDigest);
});

test('global authority changes provenance without changing evidence semantic identity when semantic dependencies match', () => {
  const first = manifest();
  const second = manifest({ authorityDigest: `sha256:${'8'.repeat(64)}` });
  assert.equal(first.evidenceSemanticDigest, second.evidenceSemanticDigest);
  assert.notEqual(first.evidenceDigest, second.evidenceDigest);
});

test('semantic dependency changes invalidate evidence semantic identity', () => {
  const first = manifest();
  const second = manifest({ semanticDependencyDigest: `sha256:${'8'.repeat(64)}` });
  assert.notEqual(first.evidenceSemanticDigest, second.evidenceSemanticDigest);
});

test('reused evidence uses the same schema and carries source plus compatibility provenance', () => {
  const source = manifest();
  const reused = manifest({
    disposition: 'REUSED',
    sourceEvidenceDigest: source.evidenceDigest,
    compatibilityDigest: `sha256:${'8'.repeat(64)}`,
    runProvenance: {
      repository: 'Oteryn/Oteryn-Atlas',
      runId: 101,
      runAttempt: 1,
      jobName: 'base-compatibility',
      artifactName: 'reused-hosted-shard-1',
    },
  });
  assert.equal(validateEvidenceManifest(reused).disposition, 'REUSED');
});

test('tampered manifests and malformed reuse provenance fail closed', () => {
  const evidence = manifest();
  assert.throws(
    () => validateEvidenceManifest({ ...evidence, authorityDigest: `sha256:${'8'.repeat(64)}` }),
    /evidenceDigest|mismatch/i,
  );
  assert.throws(
    () => manifest({ disposition: 'REUSED' }),
    /sourceEvidenceDigest|compatibilityDigest/i,
  );
  assert.throws(
    () => manifest({ result: 'FAILURE' }),
    /failureClass/i,
  );
});

test('fan-in requires exact stable-ID union with no missing, unexpected or duplicate IDs', () => {
  const first = manifest({
    evidenceId: 'hosted.desktop',
    stableTestIds: ['desktop-chromium::e2e/tests/desktop.spec.mjs::loads fixture'],
  });
  const second = manifest({
    evidenceId: 'hosted.mobile',
    stableTestIds: ['mobile-chromium::e2e/tests/mobile.spec.mjs::loads fixture'],
  });
  const expected = [...first.stableTestIds, ...second.stableTestIds].sort();
  assert.deepEqual(validateEvidenceStableIdUnion(expected, [first, second]), expected);
  assert.throws(
    () => validateEvidenceStableIdUnion([...expected, 'desktop-chromium::e2e/tests/x.spec.mjs::new'], [first, second]),
    /missing|exact/i,
  );
  assert.throws(
    () => validateEvidenceStableIdUnion(first.stableTestIds, [first, second]),
    /unexpected|exact/i,
  );
  assert.throws(
    () => validateEvidenceStableIdUnion(expected, [first, first]),
    /duplicate/i,
  );
});
