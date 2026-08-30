import { canonicalJson } from './verification-plan-schema.mjs';
import { validateEvidenceManifest } from './evidence-manifest.mjs';

function reject(reason) {
  return Object.freeze({ reusable: false, reason });
}

function exactArrayEqual(left, right) {
  return canonicalJson([...left].sort()) === canonicalJson([...right].sort());
}

export function resolveReusableEvidence(expected, candidateEvidence) {
  let evidence;
  try {
    evidence = validateEvidenceManifest(candidateEvidence);
  } catch (error) {
    return reject(`INVALID MANIFEST: ${error.message}`);
  }
  if (!expected || typeof expected !== 'object' || Array.isArray(expected)) return reject('EXPECTED_IDENTITY_INVALID');
  if (evidence.result !== 'SUCCESS') return reject('RESULT_NOT_SUCCESS');
  if (evidence.evidenceId !== expected.evidenceId) return reject('EVIDENCE_ID_MISMATCH');
  if (evidence.candidateHeadSha !== expected.candidateHeadSha) return reject('CANDIDATE_HEAD_MISMATCH');
  if (evidence.planSemanticDigest !== expected.planSemanticDigest) return reject('SEMANTIC_PLAN_MISMATCH');
  if (evidence.authorityDigest !== expected.authorityDigest) return reject('AUTHORITY_IDENTITY_MISMATCH');
  if (evidence.environmentDigest !== expected.environmentDigest) return reject('ENVIRONMENT_IDENTITY_MISMATCH');
  if (canonicalJson(evidence.productIdentities) !== canonicalJson(expected.productIdentities ?? {})) {
    return reject('PRODUCT_IDENTITY_MISMATCH');
  }
  if (!Array.isArray(expected.stableTestIds) || !exactArrayEqual(evidence.stableTestIds, expected.stableTestIds)) {
    return reject('STABLE_TEST_SET_MISMATCH');
  }
  if (evidence.executionPolicyDigest !== expected.executionPolicyDigest) return reject('EXECUTION_POLICY_MISMATCH');
  const now = Date.parse(expected.now);
  if (!Number.isFinite(now)) return reject('EXPECTED_TIME_INVALID');
  if (evidence.availability.revoked) return reject('EVIDENCE_REVOKED');
  if (Date.parse(evidence.availability.expiresAt) <= now) return reject('EVIDENCE_EXPIRED');
  if (Object.hasOwn(expected, 'availableEvidenceDigests')) {
    if (!Array.isArray(expected.availableEvidenceDigests)
      || !expected.availableEvidenceDigests.includes(evidence.evidenceDigest)) {
      return reject('EVIDENCE_BYTES_UNAVAILABLE');
    }
  }
  if (Array.isArray(expected.affectedEvidenceIds) && expected.affectedEvidenceIds.includes(evidence.evidenceId)) {
    return reject('EVIDENCE_AFFECTED_BY_BASE_ADVANCE');
  }
  return Object.freeze({ reusable: true, reason: 'MATCH' });
}
