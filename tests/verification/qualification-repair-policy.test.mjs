import assert from 'node:assert/strict';
import test from 'node:test';

import {
  QUALIFICATION_REPAIR_ADAPTER_PATHS,
  validateQualificationRepairControlPlaneBootstrap,
  validateQualificationRepairProductRepin,
  validateQualificationRepairTransition,
} from '../../tools/verification/qualification-repair-policy.mjs';

const digest = (character) => `sha256:${character.repeat(64)}`;
const plan = { profile: 'full', requiredGroupIds: ['deterministic.core', 'e2e.full'], requiredDataCapabilities: ['qualification_fixture'], retryPolicy: { retries: 0 } };

test('qualification repair admits only the closed fixture-aware E2E adapter set', () => {
  assert.equal(QUALIFICATION_REPAIR_ADAPTER_PATHS.length, 19);
  for (const path of QUALIFICATION_REPAIR_ADAPTER_PATHS) {
    assert.equal(validateQualificationRepairTransition({ changedPaths: [path], protectedPlan: plan, candidatePlan: plan }).eligible, true);
  }
  assert.throws(() => validateQualificationRepairTransition({ changedPaths: ['e2e/tests/arbitrary.spec.mjs'], protectedPlan: plan, candidatePlan: plan }), /not eligible/);
});

test('qualification product repin is exactly the rebuilt digest and byte-equivalent otherwise', () => {
  const protectedIdentities = { qualification_fixture: { id: 'atlas-qualification-world-v2', digest: digest('1') }, bounded_real_world: { id: 'atlas-bounded-real-world-v1', digest: digest('2') } };
  const candidateIdentities = { ...protectedIdentities, qualification_fixture: { ...protectedIdentities.qualification_fixture, digest: digest('3') } };
  assert.equal(validateQualificationRepairProductRepin({ protectedIdentities, candidateIdentities, rebuiltProductDigest: digest('3'), mirrorDigest: digest('3') }).productDigest, digest('3'));
  assert.throws(() => validateQualificationRepairProductRepin({ protectedIdentities, candidateIdentities, rebuiltProductDigest: digest('4'), mirrorDigest: digest('3') }), /rebuilt/);
  assert.throws(() => validateQualificationRepairProductRepin({ protectedIdentities, candidateIdentities: { ...candidateIdentities, bounded_real_world: { ...candidateIdentities.bounded_real_world, id: 'changed' } }, rebuiltProductDigest: digest('3'), mirrorDigest: digest('3') }), /more than/);
});

test('control-plane bootstrap activates only for the exact narrow fixture and self-retires', () => {
  const changedPaths = ['.github/workflows/merge-authority-audit.yml', '.github/workflows/merge-group-gate.yml', '.github/workflows/protected-qualification-repair.yml', 'tools/governance/verify_extraction_provenance.py', 'tools/verification/qualification-repair-policy.mjs', 'tests/verification/qualification-repair-policy.test.mjs'];
  const narrow = { fixtureId: 'atlas-qualification-world-v2', creatureCount: 12, creatureRegionCount: 1, semanticRecordCount: 1 };
  assert.equal(validateQualificationRepairControlPlaneBootstrap({ changedPaths, protectedFixtureShape: narrow }).eligible, true);
  assert.throws(() => validateQualificationRepairControlPlaneBootstrap({ changedPaths, protectedFixtureShape: { ...narrow, creatureRegionCount: 2, semanticRecordCount: 3 } }), /no longer has/);
  assert.throws(() => validateQualificationRepairControlPlaneBootstrap({ changedPaths: [...changedPaths, 'web/fullworld-app.mjs'], protectedFixtureShape: narrow }), /closed control-plane/);
});
