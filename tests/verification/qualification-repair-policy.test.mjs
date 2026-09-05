import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { buildQualificationWorld } from '../../tools/verification/qualification-world.mjs';

import {
  classifyQualificationRepairStatuses,
  independentlyVerifyQualificationProduct,
  materializeQualificationFixtureOracleOverlay,
  validateQualificationRepairBootstrapPinRotations,
  validateQualificationRepairControlPlaneBootstrap,
  validateQualificationRepairProductRepin,
  validateQualificationRepairTransition,
} from '../../tools/verification/qualification-repair-policy.mjs';
const digest = (c) => `sha256:${c.repeat(64)}`;
const plan = { profile: 'full', requiredGroupIds: ['deterministic.core', 'e2e.full'], requiredDataCapabilities: ['qualification_fixture'], retryPolicy: { retries: 0 } };
const gitBlob = (text) => crypto.createHash('sha1').update(Buffer.concat([Buffer.from(`blob ${Buffer.byteLength(text)}\0`), Buffer.from(text)])).digest('hex');
function writeOracleProduct(root) {
  fs.mkdirSync(path.join(root, 'web/semantic-search'), { recursive: true });
  fs.mkdirSync(path.join(root, 'data/creatures'), { recursive: true });
  fs.mkdirSync(path.join(root, 'data/creatures/chunks/f-7'), { recursive: true });
  fs.mkdirSync(path.join(root, 'runtime-index/floors'), { recursive: true });
  const at = (x, y) => ({ x, y, floor: -7 });
  const semantic = [
    { label: 'Fixture Harbor', capabilities: ['navigation'], position: at(32280, 32155) },
    ...[1, 2, 3, 4].map((value) => ({ label: `Point ${value}`, capabilities: ['overlay-point'], position: at(32280 + value, 32155 + value) })),
  ];
  const creatures = [
    { kind: 'npc', label: 'Fixture Guide', record_id: `npc:${'1'.repeat(32)}`, entity_id: `npc-entity:${'1'.repeat(32)}`, roles: ['shop', 'quest'], position: at(32280, 32155) },
    { kind: 'npc', label: 'Fixture Wayfarer', record_id: `npc:${'2'.repeat(32)}`, entity_id: `npc-entity:${'2'.repeat(32)}`, roles: ['shop', 'quest', 'travel', 'trainer'], outfit_presentation: {}, position: at(32282, 32155) },
    { kind: 'npc', label: 'Fixture Cartographer With A Deliberately Long Name', record_id: `npc:${'3'.repeat(32)}`, entity_id: `npc-entity:${'3'.repeat(32)}`, roles: [], position: at(32284, 32155) },
    { kind: 'monster', label: 'Fixture Sentinel', record_id: `monster:${'a'.repeat(32)}`, entity_id: `monster-entity:${'a'.repeat(32)}`, outfit_presentation: {}, position: at(32280, 32158) },
    ...['b', 'c', 'd'].map((value) => ({ kind: 'monster', label: `Raider ${value}`, record_id: `monster:${value.repeat(32)}`, entity_id: `monster-entity:${value.repeat(32)}`, position: at(32283, 32158) })),
  ];
  fs.writeFileSync(path.join(root, 'web/semantic-search/index.json'), JSON.stringify({ records: semantic }));
  fs.writeFileSync(path.join(root, 'data/creatures/search.json'), JSON.stringify({ records: creatures }));
  const published = creatures.map(({ label, ...record }) => ({ ...record, name: label, presentation_resolution_state: record.outfit_presentation ? 'RESOLVED' : 'FALLBACK_MARKER' }));
  fs.writeFileSync(path.join(root, 'data/creatures/index.json'), JSON.stringify({ chunks: [{ path: 'chunks/f-7/fixture.json' }] }));
  fs.writeFileSync(path.join(root, 'data/creatures/chunks/f-7/fixture.json'), JSON.stringify({ records: published }));
  fs.writeFileSync(path.join(root, 'runtime-index/floors/f-7.json'), JSON.stringify({ bounds: { x_min: 32224, x_max_exclusive: 32512, y_min: 32096, y_max_exclusive: 32384 } }));
}

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
  const productDigest = `sha256:${crypto.createHash('sha256').update('[{\"bytes\":5,\"digest\":'+JSON.stringify(entry.digest)+',\"path\":\"data\"}]\n').digest('hex')}`;
  assert.equal(independentlyVerifyQualificationProduct(root, { files: [entry], productDigest }).productDigest, productDigest);
  fs.writeFileSync(path.join(root, 'data'), 'lie');
  assert.throws(() => independentlyVerifyQualificationProduct(root, { files: [entry], productDigest }), /independently/);
});

test('independent product proof hashes the exact canonical qualification-world bytes', async () => {
  const root = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'atlas-repair-canonical-')), 'product');
  await buildQualificationWorld(root);
  const manifest = JSON.parse(fs.readFileSync(path.join(root, 'fixture-manifest.json'), 'utf8'));
  assert.equal(independentlyVerifyQualificationProduct(root, manifest).productDigest, manifest.productDigest);
});

test('oracle resolves presentation sentinels and four anchors from the real narrow fixture', async () => {
  const root = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'atlas-oracle-real-')), 'product');
  await buildQualificationWorld(root);
  const oracle = (await import('../../tools/verification/qualification-repair-policy.mjs')).resolveQualificationFixtureOracle(root);
  assert.equal(typeof oracle.animatedNpc.presentation_resolution_state, 'string');
  assert.ok(oracle.animatedMonster.outfit_presentation);
  assert.equal(new Set(oracle.distinct.map(({ x, y, floor }) => `${x}:${y}:${floor}`)).size, 4);
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

test('protected qualification overlay adapts every unresolved oracle family from publication structure', async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'atlas-oracle-'));
  const e2eRoot = path.join(root, 'e2e');
  const productRoot = path.join(root, 'product');
  fs.cpSync(path.resolve('e2e'), e2eRoot, { recursive: true, filter: (source) => !source.includes('node_modules') });
  fs.cpSync(path.resolve('web'), path.join(root, 'web'), { recursive: true });
  fs.mkdirSync(path.join(root, 'src/browser'), { recursive: true });
  fs.copyFileSync('src/browser/semantic-search.mjs', path.join(root, 'src/browser/semantic-search.mjs'));
  writeOracleProduct(productRoot);
  const result = materializeQualificationFixtureOracleOverlay({ e2eRoot, productRoot });
  assert.equal(result.dataCapability, 'qualification_fixture');
  for (const expected of [
    'tests/runtime.mjs', 'tests/state-desktop.spec.mjs', 'tests/race-desktop.spec.mjs',
    'tests/desktop.spec.mjs', 'tests/visual-desktop.spec.mjs', 'tests/visual-mobile.spec.mjs',
    'tests/creatures-desktop.spec.mjs', 'tests/farm-explorer-desktop.spec.mjs',
    'tests/geometry-desktop.spec.mjs', 'tests/performance-desktop.spec.mjs',
    'tests/soak-desktop.spec.mjs', 'tests/stress-desktop.spec.mjs',
  ]) assert.ok(result.touched.includes(expected), expected);
  assert.doesNotMatch(fs.readFileSync(path.join(e2eRoot, 'tests/desktop.spec.mjs'), 'utf8'), /Thais/);
  assert.doesNotMatch(fs.readFileSync(path.join(e2eRoot, 'tests/farm-explorer-desktop.spec.mjs'), 'utf8'), /Cave Rat/);
});

test('protected qualification overlay fails closed on unknown protected source drift', async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'atlas-oracle-drift-'));
  const e2eRoot = path.join(root, 'e2e');
  const productRoot = path.join(root, 'product');
  fs.cpSync(path.resolve('e2e'), e2eRoot, { recursive: true, filter: (source) => !source.includes('node_modules') });
  fs.cpSync(path.resolve('web'), path.join(root, 'web'), { recursive: true });
  fs.mkdirSync(path.join(root, 'src/browser'), { recursive: true });
  fs.copyFileSync('src/browser/semantic-search.mjs', path.join(root, 'src/browser/semantic-search.mjs'));
  writeOracleProduct(productRoot);
  fs.writeFileSync(path.join(e2eRoot, 'tests/stress-desktop.spec.mjs'), 'unknown source\n');
  assert.throws(() => materializeQualificationFixtureOracleOverlay({ e2eRoot, productRoot }), /source (?:shape|fingerprint) drifted/);
});

test('candidate runtime repair paths are validated by shape rather than protected byte fingerprints', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'atlas-oracle-runtime-'));
  const e2eRoot = path.join(root, 'e2e');
  const productRoot = path.join(root, 'product');
  fs.cpSync(path.resolve('e2e'), e2eRoot, { recursive: true, filter: (source) => !source.includes('node_modules') });
  fs.cpSync(path.resolve('web'), path.join(root, 'web'), { recursive: true });
  fs.appendFileSync(path.join(root, 'web/fullworld-search.mjs'), '\n// admitted runtime repair\n');
  fs.mkdirSync(path.join(root, 'src/browser'), { recursive: true });
  fs.copyFileSync('src/browser/semantic-search.mjs', path.join(root, 'src/browser/semantic-search.mjs'));
  fs.appendFileSync(path.join(root, 'src/browser/semantic-search.mjs'), '\n// admitted runtime repair\n');
  writeOracleProduct(productRoot);
  assert.equal(materializeQualificationFixtureOracleOverlay({ e2eRoot, productRoot }).dataCapability, 'qualification_fixture');
});
