import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import {
  classifyQualificationRepairStatuses,
  independentlyVerifyQualificationProduct,
  validateQualificationRepairBootstrapPinRotations,
  validateQualificationRepairControlPlaneBootstrap,
  validateQualificationRepairProductRepin,
  validateQualificationRepairTransition,
} from '../../tools/verification/qualification-repair-policy.mjs';
const digest = (c) => `sha256:${c.repeat(64)}`;
const plan = { profile: 'full', requiredGroupIds: ['deterministic.core', 'e2e.full'], requiredDataCapabilities: ['qualification_fixture'], retryPolicy: { retries: 0 } };
const gitBlob = (text) => crypto.createHash('sha1').update(Buffer.concat([Buffer.from(`blob ${Buffer.byteLength(text)}\0`), Buffer.from(text)])).digest('hex');

test('candidate E2E is never admitted and product paths remain closed', () => {
  assert.throws(() => validateQualificationRepairTransition({ changedPaths: ['e2e/tests/desktop.spec.mjs'], protectedPlan: plan, candidatePlan: plan }), /not eligible/);
  assert.equal(validateQualificationRepairTransition({ changedPaths: ['tools/verification/qualification-world.mjs'], protectedPlan: plan, candidatePlan: plan }).eligible, true);
});

test('absent repair status is inapplicable while present malformed evidence fails closed', () => {
  assert.deepEqual(classifyQualificationRepairStatuses([]), { applicable: false });
  assert.equal(classifyQualificationRepairStatuses([{ context: 'atlas-protected-product-qualification', state: 'success' }]).applicable, true);
  assert.throws(() => classifyQualificationRepairStatuses([{ context: 'atlas-protected-product-qualification', state: 'pending' }]), /present/);
  assert.throws(() => classifyQualificationRepairStatuses([{ context: 'atlas-protected-product-qualification', state: 'success' }, { context: 'atlas-protected-product-qualification', state: 'success' }]), /one authoritative/);
});

test('independent product proof rejects tampered bytes and lying manifest', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'atlas-repair-'));
  fs.writeFileSync(path.join(root, 'data'), 'truth');
  const entry = { path: 'data', bytes: 5, digest: digest('0') };
  entry.digest = `sha256:${crypto.createHash('sha256').update('truth').digest('hex')}`;
  const productDigest = `sha256:${crypto.createHash('sha256').update('[{\"bytes\":5,\"digest\":'+JSON.stringify(entry.digest)+',\"path\":\"data\"}]').digest('hex')}`;
  assert.equal(independentlyVerifyQualificationProduct(root, { files: [entry], productDigest }).productDigest, productDigest);
  fs.writeFileSync(path.join(root, 'data'), 'lie');
  assert.throws(() => independentlyVerifyQualificationProduct(root, { files: [entry], productDigest }), /independently/);
});

test('identity repin preserves the complete protected mirror', () => {
  const protectedIdentities = { qualification_fixture: { id: 'atlas-qualification-world-v2', digest: digest('1') }, bounded_real_world: { id: 'real', digest: digest('2') } };
  const candidateIdentities = structuredClone(protectedIdentities); candidateIdentities.qualification_fixture.digest = digest('3');
  const protectedMirrorText = `assert.equal(identity.digest, '${digest('1')}');\n`;
  const candidateMirrorText = protectedMirrorText.replace(digest('1'), digest('3'));
  assert.equal(validateQualificationRepairProductRepin({ protectedIdentities, candidateIdentities, rebuiltProductDigest: digest('3'), protectedMirrorText, candidateMirrorText }).productDigest, digest('3'));
  assert.throws(() => validateQualificationRepairProductRepin({ protectedIdentities, candidateIdentities, rebuiltProductDigest: digest('3'), protectedMirrorText, candidateMirrorText: `// ${digest('3')}` }), /mirror/);
});

test('control-plane bootstrap activates only for narrow protected shape and retires', () => {
  const changedPaths = ['.github/workflows/merge-authority-audit.yml', '.github/workflows/merge-group-gate.yml', '.github/workflows/protected-qualification-repair.yml', 'tools/governance/verify_extraction_provenance.py', 'tools/verification/qualification-repair-policy.mjs', 'tests/verification/qualification-repair-policy.test.mjs'];
  const narrow = { fixtureId: 'atlas-qualification-world-v2', creatureCount: 12, creatureRegionCount: 1, semanticRecordCount: 1 };
  assert.equal(validateQualificationRepairControlPlaneBootstrap({ changedPaths, protectedFixtureShape: narrow }).eligible, true);
  assert.throws(() => validateQualificationRepairControlPlaneBootstrap({ changedPaths, protectedFixtureShape: { ...narrow, creatureRegionCount: 2 } }), /no longer/);
});

test('bootstrap pins permit only exact mechanical rotations', () => {
  const oldGate = '1'.repeat(40), gateText = 'gate\n', gateBlob = gitBlob(gateText);
  const protectedVerifierText = `MERGE_GROUP_GATE_BLOB = "${oldGate}"\n`; const candidateVerifierText = `MERGE_GROUP_GATE_BLOB = "${gateBlob}"\n`; const verifierBlob = gitBlob(candidateVerifierText);
  const protectedAuditText = `EXPECTED_MERGE_GROUP_GATE_BLOB: "${oldGate}"\nEXPECTED_PROVENANCE_VERIFIER_BLOB: "${'2'.repeat(40)}"\n`;
  const candidateAuditText = `EXPECTED_MERGE_GROUP_GATE_BLOB: "${gateBlob}"\nEXPECTED_PROVENANCE_VERIFIER_BLOB: "${verifierBlob}"\n`;
  const args = { protectedVerifierText, candidateVerifierText, protectedAuditText, candidateAuditText, candidateGateText: gateText, candidateGateBlob: gateBlob, candidateVerifierBlob: verifierBlob };
  assert.equal(validateQualificationRepairBootstrapPinRotations(args).eligible, true);
  assert.throws(() => validateQualificationRepairBootstrapPinRotations({ ...args, candidateAuditText: `${candidateAuditText}# x\n` }), /more than/);
  assert.throws(() => validateQualificationRepairBootstrapPinRotations({ ...args, candidateGateBlob: 'A'.repeat(40) }), /lowercase/);
});

