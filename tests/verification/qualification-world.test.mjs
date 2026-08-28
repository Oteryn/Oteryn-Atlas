import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import {
  buildQualificationWorld,
  qualificationTrustDescriptor,
  verifyQualificationWorld,
} from '../../tools/verification/qualification-world.mjs';

function readJson(root, relative) {
  return JSON.parse(fs.readFileSync(path.join(root, relative), 'utf8'));
}

function scenarioTilePositions(root, scenario) {
  const floor = readJson(root, `publication/semantic/floors/f${scenario.position.floor}.json`);
  const positions = [];
  for (const chunk of floor.chunks) {
    const lines = fs.readFileSync(path.join(root, 'publication/semantic', chunk.path), 'utf8').trim().split('\n').filter(Boolean);
    for (const line of lines) positions.push(JSON.parse(line).position);
  }
  return positions;
}

test('qualification world is deterministic, complete for the 16-floor runtime contract, and rejects byte mutation', async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'atlas-qualification-world-'));
  const left = path.join(root, 'left');
  const right = path.join(root, 'right');
  const first = await buildQualificationWorld(left);
  const second = await buildQualificationWorld(right);

  assert.deepEqual(second, first);
  assert.equal(first.fixtureId, 'atlas-qualification-world-v2');
  assert.equal(first.semanticFloorCount, 16);
  assert.equal(first.runtimeFloorCount, 16);
  assert.equal(first.dataCapability, 'qualification_fixture');
  for (const field of ['publicationRoot', 'semanticRoot', 'runtimeIndexRoot', 'pixelRoot', 'pixelBucketRoot', 'overviewRoot', 'minimapRoot', 'productDigest']) {
    assert.match(first[field], /^sha256:[a-f0-9]{64}$/, `${field} must be content-addressed`);
  }
  assert.deepEqual(await verifyQualificationWorld(left), first);

  fs.appendFileSync(path.join(left, 'publication', 'semantic', 'chunks', 'f-7-r1008-c1004.jsonl'), 'forged');
  await assert.rejects(() => verifyQualificationWorld(left), /digest|identity|byte/i);
  fs.rmSync(root, { recursive: true, force: true });
});

test('qualification trust descriptor is the exact browser trust subset of the verified product manifest', async () => {
  const parent = fs.mkdtempSync(path.join(os.tmpdir(), 'atlas-qualification-trust-'));
  const root = path.join(parent, 'world');
  try {
    await buildQualificationWorld(root);
    const verified = await verifyQualificationWorld(root);
    const descriptor = qualificationTrustDescriptor(verified);
    assert.deepEqual(descriptor, {
      marker: 'oteryn-atlas-qualification-trust-v1',
      fixtureId: verified.fixtureId,
      dataCapability: verified.dataCapability,
      publicationRoot: verified.publicationRoot,
      semanticRoot: verified.semanticRoot,
      pixelRoot: verified.pixelRoot,
      runtimeIndexRoot: verified.runtimeIndexRoot,
      pixelBucketRoot: verified.pixelBucketRoot,
      overviewRoot: verified.overviewRoot,
      minimapRoot: verified.minimapRoot,
      sourceFingerprint: verified.sourceFingerprint,
      productDigest: verified.productDigest,
    });
    assert.equal(Object.isFrozen(descriptor), true);
  } finally {
    fs.rmSync(parent, { recursive: true, force: true });
  }
});

test('qualification fixture publishes named source-compatible scenarios for every protected Q oracle', async () => {
  const {
    ADJACENT_FLOOR, ANIMATED_MONSTER_SCENE, DENSE_MONSTER_SCENE, FARM_MONSTER,
    NAVIGATION_A, NAVIGATION_B, OVERLAP_MONSTERS, QUALIFICATION_TOPOLOGY_SCENARIOS,
  } = await import('../../e2e/support/qualification-fixture-scenarios.mjs');
  const scenarios = {
    desktopMobile: { position: QUALIFICATION_TOPOLOGY_SCENARIOS.defaultEntry, recordIds: [] },
    navigationA: { position: NAVIGATION_A.center, recordIds: [] },
    navigationB: { position: NAVIGATION_B.center, recordIds: [] },
    adjacentFloor: { position: ADJACENT_FLOOR.center, recordIds: [] },
    denseCreatures: { position: DENSE_MONSTER_SCENE.center, recordIds: DENSE_MONSTER_SCENE.recordIds },
    overlapCreatures: { position: OVERLAP_MONSTERS[0].position, recordIds: OVERLAP_MONSTERS.map((record) => record.record_id) },
    animatedCreature: { position: ANIMATED_MONSTER_SCENE.center, recordIds: [ANIMATED_MONSTER_SCENE.record.record_id] },
    farmMonster: { position: FARM_MONSTER.position, recordIds: [FARM_MONSTER.record_id] },
  };

  const parent = fs.mkdtempSync(path.join(os.tmpdir(), 'atlas-qualification-scenarios-'));
  const root = path.join(parent, 'world');
  try {
    await buildQualificationWorld(root);
    await verifyQualificationWorld(root);
    for (const [name, scenario] of Object.entries(scenarios)) {
      const positions = scenarioTilePositions(root, scenario);
      assert.ok(positions.some((position) => position.x === scenario.position.x
        && position.y === scenario.position.y && position.floor === scenario.position.floor),
      `fixture scenario ${name} must have source-compatible published tile bytes`);
    }

    const creatureIndex = readJson(root, 'data/creatures/index.json');
    const creatureRecords = creatureIndex.chunks.flatMap((chunk) => readJson(root, `data/creatures/${chunk.path}`).records);
    for (const [name, scenario] of Object.entries(scenarios)) {
      for (const id of scenario.recordIds) {
        assert.ok(creatureRecords.some((record) => record.record_id === id), `${name} requires trusted creature ${id}`);
      }
    }

    const animation = readJson(root, 'animation/programs.json');
    const animatedId = scenarios.animatedCreature.recordIds[0];
    const animated = creatureRecords.find((record) => record.record_id === animatedId);
    assert.ok(animated?.outfit_presentation?.outfit_presentation_id, 'animated scenario must declare a presentation');
    const program = animation.creature_programs.find((value) => value.outfit_presentation_id === animated.outfit_presentation.outfit_presentation_id);
    assert.ok(program && program.phase_count >= 2, 'animated scenario must use a multi-phase trusted animation program');
  } finally {
    fs.rmSync(parent, { recursive: true, force: true });
  }
});
