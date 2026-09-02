import assert from 'node:assert/strict';
import test from 'node:test';

import { buildEvidenceManifest } from '../../tools/verification/evidence-manifest.mjs';
import {
  availableVerificationEvidenceDigests,
  buildProtectedVerificationState,
  validateProtectedVerificationState,
  verificationStateArtifactName,
} from '../../tools/verification/protected-verification-state.mjs';

const sha = 'a'.repeat(40);
const digest = (character) => `sha256:${character.repeat(64)}`;

function manifest(overrides = {}) {
  return buildEvidenceManifest({
    evidenceId: 'ENVIRONMENT_QUALIFICATION', evidenceType: 'ENVIRONMENT_QUALIFICATION',
    result: 'SUCCESS', disposition: 'EXECUTED', candidateHeadSha: sha,
    planSemanticDigest: digest('1'), planInstanceDigest: digest('2'), authorityDigest: digest('3'),
    environmentDigest: digest('4'), productIdentities: {}, stableTestIds: [],
    executionPolicyDigest: digest('5'),
    runProvenance: { repository: 'Oteryn/Oteryn-Atlas', runId: 10, runAttempt: 1, jobName: 'environment', artifactName: 'environment' },
    dependencies: { evidenceDigests: [], evidenceSemanticDigests: [], paths: [], dataCapabilities: [] },
    availability: { expiresAt: '2099-01-01T00:00:00.000Z', revoked: false },
    ...overrides,
  });
}

function state(overrides = {}) {
  return buildProtectedVerificationState({
    repository: 'Oteryn/Oteryn-Atlas', prNumber: 273, candidateHeadSha: sha,
    plan: { schemaVersion: 3, repository: 'Oteryn/Oteryn-Atlas', prNumber: 273, candidateHeadSha: sha,
      planSemanticDigest: digest('1'), planInstanceDigest: digest('2'), authorityDigest: digest('3'), environmentDigest: digest('4') },
    execution: { schemaVersion: 2, candidateHeadSha: sha },
    lifecycle: { schemaVersion: 1, disposition: 'FULL_RERUN', candidateHeadSha: sha },
    progress: { schemaVersion: 1, status: 'QUALIFIED', history: [] },
    evidenceManifests: [manifest()], evidenceArchive: [],
    environmentQualification: { schemaVersion: 1, status: 'QUALIFIED' },
    producer: { repository: 'Oteryn/Oteryn-Atlas', runId: 10, runAttempt: 1,
      workflowPath: '.github/workflows/protected-hosted-executor.yml', event: 'pull_request' },
    ...overrides,
  });
}

test('state artifact binds plan, lifecycle, progress and exact evidence bytes', () => {
  const value = state();
  assert.deepEqual(value, validateProtectedVerificationState(value));
  assert.match(value.stateDigest, /^sha256:[a-f0-9]{64}$/);
  assert.deepEqual(availableVerificationEvidenceDigests(value), [value.evidenceManifests[0].evidenceDigest]);
  assert.equal(verificationStateArtifactName(273, sha), `protected-verification-state-pr-273-${sha}`);
});

test('tampering or non-authoritative producer metadata fails closed', () => {
  const value = state();
  assert.throws(() => validateProtectedVerificationState({ ...value, prNumber: 274 }), /digest|mismatch/i);
  assert.throws(() => state({ producer: { ...value.producer, workflowPath: '.github/workflows/ci.yml' } }), /workflow path/i);
});

test('protected executor workflow_dispatch producer is accepted while unrelated events fail closed', () => {
  const base = state();
  const dispatched = state({ producer: { ...base.producer, event: 'workflow_dispatch' } });
  assert.equal(validateProtectedVerificationState(dispatched).producer.event, 'workflow_dispatch');
  assert.throws(() => state({ producer: { ...base.producer, event: 'repository_dispatch' } }), /producer event/i);
});

test('dependency and reused source bytes must be archived, not merely named', () => {
  const source = manifest();
  const reused = manifest({
    disposition: 'REUSED', sourceEvidenceDigest: source.evidenceDigest,
    compatibilityDigest: digest('6'),
    runProvenance: { repository: 'Oteryn/Oteryn-Atlas', runId: 11, runAttempt: 1, jobName: 'reuse', artifactName: 'reuse' },
  });
  assert.throws(() => state({ evidenceManifests: [reused], evidenceArchive: [] }), /source evidence bytes/i);
  const valid = state({ evidenceManifests: [reused], evidenceArchive: [source] });
  assert.equal(valid.evidenceArchive.length, 2);

  const dependent = manifest({
    evidenceId: 'HOSTED_FUNCTIONAL:SHARD_1', evidenceType: 'HOSTED_FUNCTIONAL',
    dependencies: { evidenceDigests: [source.evidenceDigest], evidenceSemanticDigests: [source.evidenceSemanticDigest], paths: [], dataCapabilities: [] },
  });
  assert.throws(() => state({ evidenceManifests: [dependent], evidenceArchive: [] }), /dependency evidence bytes/i);
  assert.equal(state({ evidenceManifests: [dependent], evidenceArchive: [source] }).evidenceArchive.length, 2);
});
