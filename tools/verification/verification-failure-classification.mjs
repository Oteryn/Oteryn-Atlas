import {
  canonicalDigest,
  deepFreeze,
  exactDigest,
  exactSha,
  isPlainObject,
  nonEmptyString,
} from './anti-loop-common.mjs';

export const FAILURE_CLASSES = deepFreeze([
  'CANDIDATE_FAILURE',
  'AUTHORITY_FAILURE',
  'ENVIRONMENT_FAILURE',
  'PRODUCT_FAILURE',
  'EXTERNAL_FAILURE',
  'STALE_CANDIDATE',
  'INTEGRATION_INCOMPATIBILITY',
]);

const OWNERS = Object.freeze({
  candidate: ['CANDIDATE_FAILURE', 'candidate'],
  authority: ['AUTHORITY_FAILURE', 'protected-authority'],
  environment: ['ENVIRONMENT_FAILURE', 'protected-environment'],
  product: ['PRODUCT_FAILURE', 'protected-product'],
  external: ['EXTERNAL_FAILURE', 'external'],
});

export function classifyVerificationFailure(input) {
  if (!isPlainObject(input)) throw new TypeError('verification failure input is invalid');
  const stage = nonEmptyString(input.stage, 'verification failure stage');
  const code = nonEmptyString(input.code, 'verification failure code');
  const expectedCandidateHeadSha = exactSha(input.expectedCandidateHeadSha, 'expected candidate head SHA');
  const currentCandidateHeadSha = exactSha(input.currentCandidateHeadSha, 'current candidate head SHA');
  const planSemanticDigest = exactDigest(input.planSemanticDigest, 'failure plan semantic digest');
  const authorityDigest = exactDigest(input.authorityDigest, 'failure authority digest');
  const environmentDigest = exactDigest(input.environmentDigest, 'failure environment digest');

  let failureClass;
  let owner;
  if (currentCandidateHeadSha !== expectedCandidateHeadSha) {
    failureClass = 'STALE_CANDIDATE';
    owner = 'candidate-lifecycle';
  } else if (input.integrationCompatible === false) {
    failureClass = 'INTEGRATION_INCOMPATIBILITY';
    owner = 'candidate-integration';
  } else {
    if (!Object.hasOwn(OWNERS, input.sourceOwnership)) {
      throw new TypeError('verification failure ownership is missing or ambiguous');
    }
    [failureClass, owner] = OWNERS[input.sourceOwnership];
  }

  const candidateMutationAllowed = failureClass === 'CANDIDATE_FAILURE'
    || failureClass === 'INTEGRATION_INCOMPATIBILITY';
  const signatureCore = {
    schemaVersion: 1,
    stage,
    code,
    expectedCandidateHeadSha,
    currentCandidateHeadSha,
    planSemanticDigest,
    authorityDigest,
    environmentDigest,
    failureClass,
    owner,
  };
  return deepFreeze({
    ...signatureCore,
    retryable: false,
    candidateMutationAllowed,
    failureSignature: canonicalDigest(signatureCore),
  });
}
