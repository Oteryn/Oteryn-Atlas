import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { buildQualificationWorld } from '../../tools/verification/qualification-world.mjs';

import {
  classifyQualificationRepairStatuses,
  independentlyVerifyQualificationProduct,
  materializeQualificationFixtureOracleOverlay,
  resolveQualificationFixtureOracle,
  validateQualificationRepairProductRepin,
  validateQualificationRepairTransition,
} from '../../tools/verification/qualification-repair-policy.mjs';
const digest = (c) => `sha256:${c.repeat(64)}`;
const plan = { profile: 'full', requiredGroupIds: ['deterministic.core', 'e2e.full'], requiredDataCapabilities: ['qualification_fixture'], retryPolicy: { retries: 0 } };
function writeOracleProduct(root) {
  fs.mkdirSync(path.join(root, 'web/semantic-search'), { recursive: true });
  fs.mkdirSync(path.join(root, 'data/creatures'), { recursive: true });
  fs.mkdirSync(path.join(root, 'data/creatures/chunks/f-7'), { recursive: true });
  fs.mkdirSync(path.join(root, 'runtime-index/floors'), { recursive: true });
  fs.mkdirSync(path.join(root, 'animation'), { recursive: true });
  const at = (x, y) => ({ x, y, floor: -7 });
  const semantic = [
    { label: 'Fixture Harbor', capabilities: ['navigation'], position: at(32280, 32155) },
    ...[1, 2, 3, 4].map((value) => ({ label: `Point ${value}`, capabilities: ['overlay-point'], position: at(32280 + value, 32155 + value) })),
  ];
  const creatures = [
    { kind: 'npc', label: 'Fixture Guide', record_id: `npc:${'1'.repeat(32)}`, entity_id: `npc-entity:${'1'.repeat(32)}`, roles: ['shop', 'quest'], position: at(32280, 32155) },
    { kind: 'npc', label: 'Fixture Wayfarer', record_id: `npc:${'2'.repeat(32)}`, entity_id: `npc-entity:${'2'.repeat(32)}`, roles: ['shop', 'quest', 'travel', 'trainer'], outfit_presentation: { outfit_presentation_id: 'outfit-presentation:npc' }, position: at(32282, 32155) },
    { kind: 'npc', label: 'Fixture Cartographer With A Deliberately Long Name', record_id: `npc:${'3'.repeat(32)}`, entity_id: `npc-entity:${'3'.repeat(32)}`, roles: [], position: at(32284, 32155) },
    { kind: 'monster', label: 'Fixture Sentinel', record_id: `monster:${'a'.repeat(32)}`, entity_id: `monster-entity:${'a'.repeat(32)}`, outfit_presentation: { outfit_presentation_id: 'outfit-presentation:monster' }, position: at(32280, 32158) },
    ...['b', 'c', 'd'].map((value) => ({ kind: 'monster', label: `Raider ${value}`, record_id: `monster:${value.repeat(32)}`, entity_id: `monster-entity:${value.repeat(32)}`, position: at(32283, 32158) })),
  ];
  fs.writeFileSync(path.join(root, 'web/semantic-search/index.json'), JSON.stringify({ records: semantic }));
  fs.writeFileSync(path.join(root, 'data/creatures/search.json'), JSON.stringify({ records: creatures }));
  const published = creatures.map(({ label, ...record }) => ({ ...record, name: label, presentation_resolution_state: record.outfit_presentation ? 'RESOLVED' : 'FALLBACK_MARKER' }));
  fs.writeFileSync(path.join(root, 'data/creatures/index.json'), JSON.stringify({ chunks: [{ path: 'chunks/f-7/fixture.json' }] }));
  fs.writeFileSync(path.join(root, 'data/creatures/chunks/f-7/fixture.json'), JSON.stringify({ records: published }));
  fs.writeFileSync(path.join(root, 'runtime-index/floors/f-7.json'), JSON.stringify({ bounds: { x_min: 32224, x_max_exclusive: 32512, y_min: 32096, y_max_exclusive: 32384 } }));
  const phase = (value) => `sha256:${value.repeat(64)}`;
  const program = (id, a, b) => ({ outfit_presentation_id: id, animation_program_id: `animation-program:${id}`, phase_count: 2, phase_content_ids: [a, b], width: 1, height: 1, displacement: { x: 0, y: 0 }, selection_policy: 'test', animation: { presentation_durations_ms: [100, 100], loop_type: 'infinite', synchronized: false, default_start_phase: 0, loop_count: 0 } });
  const programs = { profile: 'oteryn-atlas-animation-runtime-v1', creature_programs: [program('outfit-presentation:npc', phase('1'), phase('2')), program('outfit-presentation:monster', phase('3'), phase('4'))], blob_index: Object.fromEntries(['1', '2', '3', '4'].map((value) => [phase(value), { width: 1, height: 1, bytes: 4, bucket: 'test', offset: 0 }])), object_programs: [], sprite_index: {} };
  fs.writeFileSync(path.join(root, 'animation/manifest.json'), JSON.stringify({ programs: { path: 'programs.json' } }));
  fs.writeFileSync(path.join(root, 'animation/programs.json'), JSON.stringify(programs));
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

test('oracle rejects the historical narrow fixture without genuine animated NPC and monster programs', async () => {
  const root = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'atlas-oracle-real-')), 'product');
  await buildQualificationWorld(root);
  assert.throws(() => resolveQualificationFixtureOracle(root), /pixel-backed animated NPC/);
});

test('oracle rejects disagreement between search and published entity identity', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'atlas-oracle-identity-'));
  try {
    writeOracleProduct(root);
    const file = path.join(root, 'data/creatures/chunks/f-7/fixture.json');
    const publication = JSON.parse(fs.readFileSync(file, 'utf8'));
    publication.records[0].entity_id = `npc-entity:${'9'.repeat(32)}`;
    fs.writeFileSync(file, JSON.stringify(publication));
    assert.throws(() => resolveQualificationFixtureOracle(root), /publication disagree/);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('identity repin preserves the complete protected mirror', () => {
  const protectedIdentities = { qualification_fixture: { id: 'atlas-qualification-world-v2', digest: digest('1') }, bounded_real_world: { id: 'real', digest: digest('2') } };
  const candidateIdentities = structuredClone(protectedIdentities); candidateIdentities.qualification_fixture.digest = digest('3');
  const protectedMirrorText = `assert.equal(identity.digest, '${digest('1')}');\n`;
  const candidateMirrorText = protectedMirrorText.replace(digest('1'), digest('3'));
  assert.equal(validateQualificationRepairProductRepin({ protectedIdentities, candidateIdentities, rebuiltProductDigest: digest('3'), protectedMirrorText, candidateMirrorText }).productDigest, digest('3'));
  assert.throws(() => validateQualificationRepairProductRepin({ protectedIdentities, candidateIdentities, rebuiltProductDigest: digest('3'), protectedMirrorText, candidateMirrorText: `// ${digest('3')}` }), /mirror/);
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
  const visual = fs.readFileSync(path.join(e2eRoot, 'tests/visual-desktop.spec.mjs'), 'utf8');
  assert.match(visual, /CREATURE_ONLY_PLAYBACK_ENTRY[\s\S]*creatures=monster/);
  assert.match(visual, /NPC_ONLY_PLAYBACK_ENTRY[\s\S]*creatures=npc/);
  for (const oracleSource of ['animationRectangles', 'comparePngOutsideRects', 'changedOutside', 'world animation overlay blanked during playback']) assert.match(visual, new RegExp(oracleSource));
  assert.doesNotMatch(visual, /assertCreatureFamilyPlaybackChangesPixels\(page, CREATURE_ONLY_PLAYBACK_ENTRY, 'monster'\);\n  return;/);
});

test('oracle rejects missing, fallback, single-phase, and visually static animation programs', () => {
  const mutate = (change, pattern) => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'atlas-oracle-animation-'));
    writeOracleProduct(root);
    change(root);
    assert.throws(() => resolveQualificationFixtureOracle(root), pattern);
  };
  mutate((root) => fs.rmSync(path.join(root, 'animation/programs.json')), /ENOENT/);
  mutate((root) => { const file = path.join(root, 'data/creatures/chunks/f-7/fixture.json'); const value = JSON.parse(fs.readFileSync(file)); value.records.find((r) => r.kind === 'npc' && r.outfit_presentation).presentation_resolution_state = 'FALLBACK_MARKER'; fs.writeFileSync(file, JSON.stringify(value)); }, /pixel-backed animated NPC/);
  for (const mode of ['single', 'same']) mutate((root) => { const file = path.join(root, 'animation/programs.json'); const value = JSON.parse(fs.readFileSync(file)); const entry = value.creature_programs[0]; if (mode === 'single') { entry.phase_count = 1; entry.phase_content_ids = entry.phase_content_ids.slice(0, 1); entry.animation.presentation_durations_ms = [100]; } else entry.phase_content_ids[1] = entry.phase_content_ids[0]; fs.writeFileSync(file, JSON.stringify(value)); }, /pixel-backed animated NPC/);
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

test('candidate runtime repair paths remain byte-identical during qualification overlay', (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'atlas-oracle-runtime-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const e2eRoot = path.join(root, 'e2e');
  const productRoot = path.join(root, 'product');
  fs.cpSync(path.resolve('e2e'), e2eRoot, { recursive: true, filter: (source) => !source.includes('node_modules') });
  fs.cpSync(path.resolve('web'), path.join(root, 'web'), { recursive: true });
  fs.appendFileSync(path.join(root, 'web/fullworld-search.mjs'), '\n// admitted runtime repair\n');
  fs.mkdirSync(path.join(root, 'src/browser'), { recursive: true });
  fs.copyFileSync('src/browser/semantic-search.mjs', path.join(root, 'src/browser/semantic-search.mjs'));
  fs.appendFileSync(path.join(root, 'src/browser/semantic-search.mjs'), '\n// admitted runtime repair\n');
  writeOracleProduct(productRoot);
  const runtimePaths = ['web/fullworld-search.mjs', 'src/browser/semantic-search.mjs'];
  const before = runtimePaths.map((relative) => fs.readFileSync(path.join(root, relative)));
  assert.equal(materializeQualificationFixtureOracleOverlay({ e2eRoot, productRoot }).dataCapability, 'qualification_fixture');
  runtimePaths.forEach((relative, index) => {
    assert.deepEqual(fs.readFileSync(path.join(root, relative)), before[index], `${relative} must be the exact candidate bytes`);
  });
});

for (const obligation of ['screenshot baselines', 'visible edge label', 'coordinate navigation', 'coordinate input grammar', 'literal publication labels']) {
  test(`qualification overlay preserves protected ${obligation} obligations`, (t) => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'atlas-oracle-obligations-'));
    t.after(() => fs.rmSync(root, { recursive: true, force: true }));
    const e2eRoot = path.join(root, 'e2e');
    const productRoot = path.join(root, 'product');
    fs.cpSync(path.resolve('e2e'), e2eRoot, { recursive: true, filter: (source) => !source.includes('node_modules') });
    fs.cpSync(path.resolve('web'), path.join(root, 'web'), { recursive: true });
    fs.mkdirSync(path.join(root, 'src/browser'), { recursive: true });
    fs.copyFileSync('src/browser/semantic-search.mjs', path.join(root, 'src/browser/semantic-search.mjs'));
    writeOracleProduct(productRoot);
    const specialLabel = "Quoted 'label' / path $& $' $`\nnext line";
    if (obligation === 'literal publication labels') {
      const semanticPath = path.join(productRoot, 'web/semantic-search/index.json');
      const semantic = JSON.parse(fs.readFileSync(semanticPath));
      semantic.records[0].label = specialLabel;
      fs.writeFileSync(semanticPath, JSON.stringify(semantic));
      for (const relative of ['data/creatures/search.json', 'data/creatures/chunks/f-7/fixture.json']) {
        const file = path.join(productRoot, relative);
        const data = JSON.parse(fs.readFileSync(file));
        for (const record of data.records.filter((record) => record.kind === 'monster' && !record.outfit_presentation)) {
          if (relative.includes('search')) record.label = specialLabel;
          else record.name = specialLabel;
        }
        fs.writeFileSync(file, JSON.stringify(data));
      }
    }
    const read = (relative) => fs.readFileSync(path.join(e2eRoot, 'tests', relative), 'utf8');
    const originalAudit = read('audit-desktop.spec.mjs');
    const originalVisuals = ['visual-desktop.spec.mjs', 'visual-mobile.spec.mjs'].map(read);
    materializeQualificationFixtureOracleOverlay({ e2eRoot, productRoot });
    if (obligation === 'screenshot baselines') {
      ['visual-desktop.spec.mjs', 'visual-mobile.spec.mjs'].forEach((relative, index) => {
        const baselines = (source) => [...source.matchAll(/\.toHaveScreenshot\('([^']+)'/g)].map((match) => match[1]);
        const expected = baselines(originalVisuals[index]);
        assert.ok(expected.length > 0);
        assert.deepEqual(baselines(read(relative)), expected, `${relative} must retain every protected visual comparison`);
      });
    } else if (obligation === 'visible edge label') {
      const source = read('creature-presentation-desktop.spec.mjs');
      assert.ok(source.includes('expect(longLabel.suppressed).toBe(false);'));
      assert.ok(source.includes("assertCssRect(longLabel.rect, await viewportSize(page), 'long-name edge label');"));
      assert.ok(!source.includes('expect(longLabel.rect).toBeNull();'));
    } else if (obligation === 'literal publication labels') {
      const source = read('creature-interaction-desktop.spec.mjs');
      assert.ok(source.includes(`label: ${JSON.stringify(specialLabel)},`), 'publication label must be one serialized JavaScript string');
      assert.ok(source.includes(`.toContainText(${JSON.stringify(specialLabel)})`));
      for (const relative of ['desktop.spec.mjs', 'mobile.spec.mjs', 'creature-interaction-desktop.spec.mjs']) {
        const result = spawnSync(process.execPath, ['--check', path.join(e2eRoot, 'tests', relative)], { encoding: 'utf8' });
        assert.equal(result.status, 0, result.stderr);
      }
    } else if (obligation === 'coordinate input grammar') {
      for (const relative of ['audit-desktop.spec.mjs', 'state-desktop.spec.mjs']) {
        assert.match(read(relative), /\.fill\('\d+ \d+ -?\d+'\)/, `${relative} must still exercise unkeyed coordinate input`);
      }
      assert.ok(read('race-desktop.spec.mjs').includes('.fill(`${x} ${y} ${floor}`)'));
    } else {
      const source = read('audit-desktop.spec.mjs');
      const count = (text, literal) => text.split(literal).length - 1;
      assert.equal(count(source, 'await gotoAtlas('), count(originalAudit, 'await gotoAtlas('), 'the oracle must not repair a failed user navigation');
      assert.equal(count(source, ".fill('')"), count(originalAudit, ".fill('')"), 'the oracle must not hide search results by clearing the input');
    }
  });
}
