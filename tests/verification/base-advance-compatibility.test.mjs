import assert from 'node:assert/strict';
import test from 'node:test';

import { classifyBaseAdvance } from '../../tools/verification/base-advance-compatibility.mjs';

const oldBaseSha = 'a'.repeat(40);
const newBaseSha = 'b'.repeat(40);
const auth = `sha256:${'1'.repeat(64)}`;
const env = `sha256:${'2'.repeat(64)}`;
const fixture = `sha256:${'3'.repeat(64)}`;
const changedFixture = `sha256:${'4'.repeat(64)}`;

function input(overrides = {}) {
  return {
    oldBaseSha,
    newBaseSha,
    changedPaths: ['README.md'],
    mergeStatus: 'clean',
    previousIdentities: {
      authorityDigest: auth,
      environmentDigest: env,
      products: { qualification_fixture: fixture },
    },
    currentIdentities: {
      authorityDigest: auth,
      environmentDigest: env,
      products: { qualification_fixture: fixture },
    },
    authorityPaths: ['tools/verification/', '.github/workflows/protected-'],
    candidateRequiredPaths: ['src/browser/runtime.mjs'],
    evidence: [
      {
        id: 'environment',
        dependencyPaths: [],
        dependsOnAuthority: true,
        dependsOnEnvironment: true,
        productCapabilities: [],
      },
      {
        id: 'hosted-fixture',
        dependencyPaths: ['src/browser/'],
        dependsOnAuthority: true,
        dependsOnEnvironment: true,
        productCapabilities: ['qualification_fixture'],
      },
      {
        id: 'deterministic',
        dependencyPaths: ['tools/dyn-atlas-semantic/'],
        dependsOnAuthority: true,
        dependsOnEnvironment: false,
        productCapabilities: [],
      },
    ],
    ...overrides,
  };
}

test('README-only and unrelated protected base advances reuse all evidence without candidate churn', () => {
  for (const changedPaths of [['README.md'], ['docs/operations/note.md'], ['unrelated/asset.txt']]) {
    const result = classifyBaseAdvance(input({ changedPaths }));
    assert.equal(result.disposition, 'REUSE');
    assert.deepEqual(result.affectedEvidenceIds, []);
    assert.equal(result.oldBaseSha, oldBaseSha);
    assert.equal(result.newBaseSha, newBaseSha);
    assert.match(result.compatibilityDigest, /^sha256:[a-f0-9]{64}$/);
  }
});

test('one selected dependency change schedules only its exact evidence node', () => {
  const result = classifyBaseAdvance(input({ changedPaths: ['src/browser/search.mjs'] }));
  assert.equal(result.disposition, 'PARTIAL_RERUN');
  assert.deepEqual(result.affectedEvidenceIds, ['hosted-fixture']);
});

test('authority, stable-ID or environment identity changes invalidate all dependent evidence', () => {
  const authorityResult = classifyBaseAdvance(input({
    changedPaths: ['tools/verification/stable-id.mjs'],
    currentIdentities: {
      authorityDigest: `sha256:${'9'.repeat(64)}`,
      environmentDigest: env,
      products: { qualification_fixture: fixture },
    },
  }));
  assert.equal(authorityResult.disposition, 'FULL_RERUN');
  assert.deepEqual(authorityResult.affectedEvidenceIds, ['deterministic', 'environment', 'hosted-fixture']);

  const environmentResult = classifyBaseAdvance(input({
    changedPaths: ['.github/workflows/protected-hosted-executor.yml'],
    currentIdentities: {
      authorityDigest: auth,
      environmentDigest: `sha256:${'8'.repeat(64)}`,
      products: { qualification_fixture: fixture },
    },
  }));
  assert.equal(environmentResult.disposition, 'FULL_RERUN');
  assert.deepEqual(environmentResult.affectedEvidenceIds, ['environment', 'hosted-fixture']);
});

test('product identity changes invalidate only evidence that consumes that product', () => {
  const result = classifyBaseAdvance(input({
    changedPaths: ['tools/verification/qualification-world.mjs'],
    currentIdentities: {
      authorityDigest: auth,
      environmentDigest: env,
      products: { qualification_fixture: changedFixture },
    },
  }));
  assert.equal(result.disposition, 'PARTIAL_RERUN');
  assert.deepEqual(result.affectedEvidenceIds, ['hosted-fixture']);
});

test('merge conflict or candidate-required source movement is the only normal base reason to reintegrate', () => {
  const conflict = classifyBaseAdvance(input({ mergeStatus: 'conflict' }));
  assert.equal(conflict.disposition, 'REINTEGRATE');

  const requiredSource = classifyBaseAdvance(input({ changedPaths: ['src/browser/runtime.mjs'] }));
  assert.equal(requiredSource.disposition, 'REINTEGRATE');
  assert.ok(requiredSource.reasons.some((reason) => /candidate-required/i.test(reason)));
});

test('authority-scoped movement without an authority digest change fails closed', () => {
  assert.throws(() => classifyBaseAdvance(input({
    changedPaths: ['tools/verification/unlisted-controller-helper.mjs'],
  })), /authority closure escaped/i);
});
