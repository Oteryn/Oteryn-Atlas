import {
  canonicalDigest,
  deepFreeze,
  exactDigest,
  exactSha,
  isPlainObject,
  nonEmptyString,
  safeRepositoryPath,
  sortedUniqueStrings,
  stableId,
} from './anti-loop-common.mjs';
import { FAILURE_CLASSES } from './verification-failure-classification.mjs';

const EVIDENCE_TYPE = /^[A-Z][A-Z0-9_]*$/;
const RESULTS = new Set(['SUCCESS', 'FAILURE']);
const DISPOSITIONS = new Set(['EXECUTED', 'REUSED']);

function normalizeProductIdentities(value) {
  if (!isPlainObject(value)) throw new TypeError('evidence productIdentities must be an object');
  return Object.fromEntries(Object.entries(value).sort(([left], [right]) => left.localeCompare(right)).map(([capability, identity]) => {
    if (typeof capability !== 'string' || capability.length === 0 || !isPlainObject(identity)
      || typeof identity.id !== 'string' || identity.id.length === 0) {
      throw new TypeError(`evidence product identity is invalid: ${capability}`);
    }
    return [capability, { id: identity.id, digest: exactDigest(identity.digest, `${capability} product digest`) }];
  }));
}

function normalizeRunProvenance(value) {
  if (!isPlainObject(value)
    || typeof value.repository !== 'string' || !/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(value.repository)
    || !Number.isSafeInteger(value.runId) || value.runId < 1
    || !Number.isSafeInteger(value.runAttempt) || value.runAttempt < 1) {
    throw new TypeError('evidence run provenance is invalid');
  }
  return {
    repository: value.repository,
    runId: value.runId,
    runAttempt: value.runAttempt,
    jobName: nonEmptyString(value.jobName, 'evidence provenance jobName'),
    artifactName: nonEmptyString(value.artifactName, 'evidence provenance artifactName'),
  };
}

function normalizeDependencies(value) {
  if (!isPlainObject(value)) throw new TypeError('evidence dependencies are invalid');
  return {
    evidenceDigests: sortedUniqueStrings(value.evidenceDigests ?? [], 'evidence dependency digests', {
      validate: (candidate) => /^sha256:[a-f0-9]{64}$/.test(candidate),
    }),
    evidenceSemanticDigests: sortedUniqueStrings(
      value.evidenceSemanticDigests ?? [],
      'evidence dependency semantic digests',
      { validate: (candidate) => /^sha256:[a-f0-9]{64}$/.test(candidate) },
    ),
    paths: sortedUniqueStrings(value.paths ?? [], 'evidence dependency paths', {
      validate: (candidate) => safeRepositoryPath(candidate),
    }),
    dataCapabilities: sortedUniqueStrings(value.dataCapabilities ?? [], 'evidence data capabilities'),
  };
}

function normalizeAvailability(value) {
  if (!isPlainObject(value) || typeof value.expiresAt !== 'string'
    || Number.isNaN(Date.parse(value.expiresAt)) || typeof value.revoked !== 'boolean') {
    throw new TypeError('evidence availability is invalid');
  }
  const canonicalTime = new Date(value.expiresAt).toISOString();
  if (canonicalTime !== value.expiresAt) throw new TypeError('evidence availability expiresAt must be canonical ISO-8601');
  return { expiresAt: canonicalTime, revoked: value.revoked };
}

function semanticCore({
  evidenceId,
  evidenceType,
  authorityDigest,
  environmentDigest,
  productIdentities,
  stableTestIdsDigest,
  executionPolicyDigest,
  dependencies,
}) {
  return {
    schemaVersion: 1,
    evidenceId,
    evidenceType,
    authorityDigest,
    environmentDigest,
    productIdentities,
    stableTestIdsDigest,
    executionPolicyDigest,
    dependencySemanticDigests: dependencies.evidenceSemanticDigests,
    dependencyPaths: dependencies.paths,
    dataCapabilities: dependencies.dataCapabilities,
  };
}

export function buildEvidenceSemanticDigest(input) {
  if (!isPlainObject(input)
    || typeof input.evidenceId !== 'string' || input.evidenceId.length === 0
    || typeof input.evidenceType !== 'string' || !EVIDENCE_TYPE.test(input.evidenceType)) {
    throw new TypeError('evidence semantic identity/type is invalid');
  }
  const stableTestIds = sortedUniqueStrings(input.stableTestIds ?? [], 'evidence stable test IDs', { validate: stableId });
  const dependencies = normalizeDependencies(input.dependencies ?? {});
  return canonicalDigest(semanticCore({
    evidenceId: input.evidenceId,
    evidenceType: input.evidenceType,
    candidateHeadSha: exactSha(input.candidateHeadSha, 'evidence candidate head SHA'),
    authorityDigest: exactDigest(input.authorityDigest, 'evidence authority digest'),
    environmentDigest: input.environmentDigest === null
      ? null
      : exactDigest(input.environmentDigest, 'evidence environment digest'),
    productIdentities: normalizeProductIdentities(input.productIdentities ?? {}),
    stableTestIdsDigest: canonicalDigest(stableTestIds),
    executionPolicyDigest: exactDigest(input.executionPolicyDigest, 'evidence execution policy digest'),
    dependencies,
  }));
}

function normalizeCore(input) {
  if (!isPlainObject(input)
    || typeof input.evidenceId !== 'string' || input.evidenceId.length === 0
    || typeof input.evidenceType !== 'string' || !EVIDENCE_TYPE.test(input.evidenceType)
    || !RESULTS.has(input.result) || !DISPOSITIONS.has(input.disposition)) {
    throw new TypeError('evidence manifest identity/type/result/disposition is invalid');
  }
  const result = input.result;
  if (result === 'FAILURE' && !FAILURE_CLASSES.includes(input.failureClass)) {
    throw new TypeError('failed evidence requires an exact failureClass');
  }
  if (result === 'SUCCESS' && input.failureClass !== undefined) {
    throw new TypeError('successful evidence must not carry failureClass');
  }
  if (input.disposition === 'REUSED') {
    exactDigest(input.sourceEvidenceDigest, 'reused sourceEvidenceDigest');
    exactDigest(input.compatibilityDigest, 'reused compatibilityDigest');
  } else if (input.sourceEvidenceDigest !== undefined || input.compatibilityDigest !== undefined) {
    throw new TypeError('executed evidence must not carry reuse provenance');
  }

  const stableTestIds = sortedUniqueStrings(input.stableTestIds ?? [], 'evidence stable test IDs', { validate: stableId });
  const stableTestIdsDigest = canonicalDigest(stableTestIds);
  const dependencies = normalizeDependencies(input.dependencies);
  const candidateHeadSha = exactSha(input.candidateHeadSha, 'evidence candidate head SHA');
  const authorityDigest = exactDigest(input.authorityDigest, 'evidence authority digest');
  const environmentDigest = input.environmentDigest === null
    ? null
    : exactDigest(input.environmentDigest, 'evidence environment digest');
  const productIdentities = normalizeProductIdentities(input.productIdentities ?? {});
  const executionPolicyDigest = exactDigest(input.executionPolicyDigest, 'evidence execution policy digest');
  const evidenceSemanticDigest = canonicalDigest(semanticCore({
    evidenceId: input.evidenceId,
    evidenceType: input.evidenceType,
    candidateHeadSha,
    authorityDigest,
    environmentDigest,
    productIdentities,
    stableTestIdsDigest,
    executionPolicyDigest,
    dependencies,
  }));
  const core = {
    schemaVersion: 2,
    evidenceId: input.evidenceId,
    evidenceType: input.evidenceType,
    result,
    disposition: input.disposition,
    candidateHeadSha,
    planSemanticDigest: exactDigest(input.planSemanticDigest, 'evidence semantic plan digest'),
    planInstanceDigest: exactDigest(input.planInstanceDigest, 'evidence instance plan digest'),
    authorityDigest,
    environmentDigest,
    productIdentities,
    stableTestIds,
    stableTestIdsDigest,
    executionPolicyDigest,
    evidenceSemanticDigest,
    runProvenance: normalizeRunProvenance(input.runProvenance),
    dependencies,
    availability: normalizeAvailability(input.availability),
    ...(result === 'FAILURE' ? { failureClass: input.failureClass } : {}),
    ...(input.disposition === 'REUSED' ? {
      sourceEvidenceDigest: input.sourceEvidenceDigest,
      compatibilityDigest: input.compatibilityDigest,
    } : {}),
  };
  return core;
}

export function buildEvidenceManifest(input) {
  const core = normalizeCore(input);
  return deepFreeze({ ...core, evidenceDigest: canonicalDigest(core) });
}

export function validateEvidenceManifest(candidate) {
  if (!isPlainObject(candidate) || candidate.schemaVersion !== 2) throw new TypeError('evidence manifest schema is invalid');
  const rebuilt = buildEvidenceManifest(candidate);
  const evidenceDigest = exactDigest(candidate.evidenceDigest, 'evidenceDigest');
  const evidenceSemanticDigest = exactDigest(candidate.evidenceSemanticDigest, 'evidenceSemanticDigest');
  if (rebuilt.evidenceDigest !== evidenceDigest) throw new TypeError('evidenceDigest mismatch');
  if (rebuilt.evidenceSemanticDigest !== evidenceSemanticDigest) throw new TypeError('evidenceSemanticDigest mismatch');
  if (candidate.stableTestIdsDigest !== rebuilt.stableTestIdsDigest) throw new TypeError('evidence stable test-set digest mismatch');
  return rebuilt;
}

export function validateEvidenceStableIdUnion(expectedStableTestIds, manifests) {
  const expected = sortedUniqueStrings(expectedStableTestIds, 'expected stable test IDs', { validate: stableId });
  if (!Array.isArray(manifests)) throw new TypeError('fan-in evidence manifests must be an array');
  const validated = manifests.map(validateEvidenceManifest);
  const evidenceIds = validated.map(({ evidenceId }) => evidenceId);
  if (new Set(evidenceIds).size !== evidenceIds.length) throw new TypeError('fan-in contains duplicate evidence manifests');
  const actual = validated.flatMap(({ stableTestIds }) => stableTestIds);
  if (new Set(actual).size !== actual.length) throw new TypeError('fan-in contains duplicate stable test IDs');
  actual.sort();
  const expectedSet = new Set(expected);
  const actualSet = new Set(actual);
  const missing = expected.filter((id) => !actualSet.has(id));
  const unexpected = actual.filter((id) => !expectedSet.has(id));
  if (missing.length > 0 || unexpected.length > 0) {
    throw new TypeError(`fan-in stable-ID union is not exact; missing=${missing.join(',')}; unexpected=${unexpected.join(',')}`);
  }
  return deepFreeze([...expected]);
}
