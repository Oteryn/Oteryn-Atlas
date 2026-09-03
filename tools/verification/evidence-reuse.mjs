import { canonicalJson } from './verification-plan-schema.mjs';
import { validateEvidenceManifest } from './evidence-manifest.mjs';

function reject(reason) {
  return Object.freeze({ reusable: false, reason });
}

function exactArrayEqual(left, right) {
  return Array.isArray(left) && Array.isArray(right)
    && canonicalJson([...left].sort()) === canonicalJson([...right].sort());
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
  if (expected.allowPlanSemanticRebinding !== true
    && evidence.planSemanticDigest !== expected.planSemanticDigest) return reject('SEMANTIC_PLAN_MISMATCH');
  const expectedSemanticDependencyDigest = expected.semanticDependencyDigest ?? expected.authorityDigest;
  if (!/^sha256:[a-f0-9]{64}$/.test(expectedSemanticDependencyDigest ?? '')) {
    return reject('EXPECTED_SEMANTIC_DEPENDENCY_IDENTITY_INVALID');
  }
  if (evidence.semanticDependencyDigest !== expectedSemanticDependencyDigest) {
    return reject('SEMANTIC_DEPENDENCY_IDENTITY_MISMATCH');
  }
  if (evidence.environmentDigest !== expected.environmentDigest) return reject('ENVIRONMENT_IDENTITY_MISMATCH');
  if (canonicalJson(evidence.productIdentities) !== canonicalJson(expected.productIdentities ?? {})) {
    return reject('PRODUCT_IDENTITY_MISMATCH');
  }
  if (!Array.isArray(expected.stableTestIds) || !exactArrayEqual(evidence.stableTestIds, expected.stableTestIds)) {
    return reject('STABLE_TEST_SET_MISMATCH');
  }
  if (evidence.executionPolicyDigest !== expected.executionPolicyDigest) return reject('EXECUTION_POLICY_MISMATCH');
  if (!/^sha256:[a-f0-9]{64}$/.test(expected.evidenceSemanticDigest ?? '')) {
    return reject('EXPECTED_EVIDENCE_SEMANTIC_IDENTITY_INVALID');
  }
  const expectedDependencies = expected.dependencies ?? {};
  if (!exactArrayEqual(evidence.dependencies.evidenceSemanticDigests, expectedDependencies.evidenceSemanticDigests ?? [])) {
    return reject('DEPENDENCY_SEMANTIC_IDENTITY_MISMATCH');
  }
  if (!exactArrayEqual(evidence.dependencies.paths, expectedDependencies.paths ?? [])) return reject('DEPENDENCY_PATH_MISMATCH');
  if (!exactArrayEqual(evidence.dependencies.dataCapabilities, expectedDependencies.dataCapabilities ?? [])) {
    return reject('DEPENDENCY_DATA_CAPABILITY_MISMATCH');
  }
  if (evidence.evidenceSemanticDigest !== expected.evidenceSemanticDigest) return reject('EVIDENCE_SEMANTIC_IDENTITY_MISMATCH');
  const now = Date.parse(expected.now);
  if (!Number.isFinite(now)) return reject('EXPECTED_TIME_INVALID');
  if (evidence.availability.revoked) return reject('EVIDENCE_REVOKED');
  if (Date.parse(evidence.availability.expiresAt) <= now) return reject('EVIDENCE_EXPIRED');
  if (Object.hasOwn(expected, 'availableEvidenceDigests')) {
    if (!Array.isArray(expected.availableEvidenceDigests)) return reject('AVAILABLE_EVIDENCE_INVALID');
    const available = new Set(expected.availableEvidenceDigests);
    if (!available.has(evidence.evidenceDigest)) return reject('EVIDENCE_BYTES_UNAVAILABLE');
    if (evidence.disposition === 'REUSED' && !available.has(evidence.sourceEvidenceDigest)) {
      return reject('SOURCE_EVIDENCE_BYTES_UNAVAILABLE');
    }
    if (evidence.dependencies.evidenceDigests.some((dependencyDigest) => !available.has(dependencyDigest))) {
      return reject('DEPENDENCY_EVIDENCE_BYTES_UNAVAILABLE');
    }
  }
  if (Array.isArray(expected.affectedEvidenceIds) && expected.affectedEvidenceIds.includes(evidence.evidenceId)) {
    return reject('EVIDENCE_AFFECTED_BY_BASE_ADVANCE');
  }
  return Object.freeze({
    reusable: true,
    reason: 'MATCH',
    sourceEvidenceDigest: evidence.evidenceDigest,
    evidenceSemanticDigest: evidence.evidenceSemanticDigest,
  });
}
