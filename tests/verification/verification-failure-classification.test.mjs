import assert from 'node:assert/strict';
import test from 'node:test';

import {
  FAILURE_CLASSES,
  classifyVerificationFailure,
} from '../../tools/verification/verification-failure-classification.mjs';

const sha = 'a'.repeat(40);
const semantic = `sha256:${'1'.repeat(64)}`;
const authority = `sha256:${'2'.repeat(64)}`;
const environment = `sha256:${'3'.repeat(64)}`;

function failure(overrides = {}) {
  return {
    stage: 'EXECUTION',
    code: 'ASSERTION_FAILED',
    expectedCandidateHeadSha: sha,
    currentCandidateHeadSha: sha,
    planSemanticDigest: semantic,
    authorityDigest: authority,
    environmentDigest: environment,
    sourceOwnership: 'candidate',
    ...overrides,
  };
}

test('failure classifier exposes the complete bounded owner-class enum', () => {
  assert.deepEqual([...FAILURE_CLASSES].sort(), [
    'AUTHORITY_FAILURE',
    'CANDIDATE_FAILURE',
    'ENVIRONMENT_FAILURE',
    'EXTERNAL_FAILURE',
    'INTEGRATION_INCOMPATIBILITY',
    'PRODUCT_FAILURE',
    'STALE_CANDIDATE',
  ]);
});

test('representative failures map to exact machine-readable owners', () => {
  const cases = [
    [{ sourceOwnership: 'candidate' }, 'CANDIDATE_FAILURE', 'candidate'],
    [{ stage: 'AUTHORITY_PREFLIGHT', sourceOwnership: 'authority' }, 'AUTHORITY_FAILURE', 'protected-authority'],
    [{ stage: 'ENVIRONMENT_QUALIFICATION', code: 'PYTHON_COMPATIBILITY_MISSING', sourceOwnership: 'environment' }, 'ENVIRONMENT_FAILURE', 'protected-environment'],
    [{ stage: 'ENVIRONMENT_QUALIFICATION', code: 'READ_ONLY_DEPENDENCY_LINK_FAILED', sourceOwnership: 'environment' }, 'ENVIRONMENT_FAILURE', 'protected-environment'],
    [{ stage: 'PRODUCT_QUALIFICATION', sourceOwnership: 'product' }, 'PRODUCT_FAILURE', 'protected-product'],
    [{ stage: 'EXTERNAL', sourceOwnership: 'external' }, 'EXTERNAL_FAILURE', 'external'],
  ];
  for (const [overrides, expectedClass, expectedOwner] of cases) {
    const result = classifyVerificationFailure(failure(overrides));
    assert.equal(result.failureClass, expectedClass);
    assert.equal(result.owner, expectedOwner);
    assert.match(result.failureSignature, /^sha256:[a-f0-9]{64}$/);
  }
});

test('stale candidate and integration incompatibility have precedence over stage ownership', () => {
  const stale = classifyVerificationFailure(failure({ currentCandidateHeadSha: 'b'.repeat(40) }));
  assert.equal(stale.failureClass, 'STALE_CANDIDATE');
  assert.equal(stale.candidateMutationAllowed, false);

  const incompatible = classifyVerificationFailure(failure({ integrationCompatible: false }));
  assert.equal(incompatible.failureClass, 'INTEGRATION_INCOMPATIBILITY');
  assert.equal(incompatible.candidateMutationAllowed, true);
});

test('authority/environment/product failures cannot recommend candidate mutation', () => {
  for (const sourceOwnership of ['authority', 'environment', 'product', 'external']) {
    const result = classifyVerificationFailure(failure({ sourceOwnership }));
    assert.equal(result.candidateMutationAllowed, false);
    assert.equal(result.retryable, false);
  }
});

test('ambiguous execution ownership fails closed instead of blaming the candidate', () => {
  assert.throws(
    () => classifyVerificationFailure(failure({ sourceOwnership: undefined })),
    /ownership/i,
  );
});
