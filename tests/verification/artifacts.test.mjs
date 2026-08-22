import assert from 'node:assert/strict';
import { mkdtemp, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';

import {
  normalizeScenarioEvidence,
  writeScenarioEvidence,
} from '../../e2e/support/artifacts.mjs';

test('scenario evidence normalizes a bounded machine-readable failure', () => {
  const value = normalizeScenarioEvidence({
    scenarioId: 'geometry.creature-drift.pan',
    category: 'geometry',
    status: 'fail',
    targetMode: 'checkout-overlay',
    browserProfile: 'desktop-chromium',
    atlasRevision: 'a'.repeat(40),
    durationMs: 123.5,
    seed: 85,
    firstFailingActionIndex: 2,
    artifacts: ['renderer-before.json', 'renderer-after.json'],
  });
  assert.equal(value.category, 'geometry');
  assert.equal(value.status, 'fail');
  assert.equal(value.seed, 85);
  assert.equal(value.firstFailingActionIndex, 2);
  assert(Object.isFrozen(value));
  assert(Object.isFrozen(value.artifacts));
});

test('scenario evidence rejects traversal and unexplained skips', () => {
  assert.throws(() => normalizeScenarioEvidence({
    scenarioId: 'x', category: 'e2e', status: 'skip', durationMs: 0,
  }), /skip reason/i);
  assert.throws(() => normalizeScenarioEvidence({
    scenarioId: 'x', category: 'e2e', status: 'fail', durationMs: 0,
    artifacts: ['../escape.json'],
  }), /artifact path/i);
});

test('scenario evidence writer persists canonical JSON below the artifact root', async () => {
  const root = await mkdtemp(path.join(tmpdir(), 'atlas-evidence-'));
  const result = await writeScenarioEvidence(root, {
    scenarioId: 'stress.seed-85', category: 'stress', status: 'pass',
    durationMs: 42, seed: 85, artifacts: [],
  });
  assert.equal(path.dirname(result.path), root);
  assert.deepEqual(JSON.parse(await readFile(result.path, 'utf8')), result.evidence);
});