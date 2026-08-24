import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const evidence = JSON.parse(fs.readFileSync(new URL('../../docs/evidence/hunt-intelligence/upstream-readiness-2026-08-24.json', import.meta.url), 'utf8').replace(/^\uFEFF/, ''));

test('current upstream evidence is exact-revision and fail-closed', () => {
  assert.match(evidence.game.revision, /^[0-9a-f]{40}$/);
  assert.equal(evidence.game.mutation, false);
  assert.equal(evidence.capabilities['hunt-catalog-v1'].state, 'UPSTREAM_BLOCKED');
  assert.equal(evidence.capabilities['hunt-performance-v1'].state, 'UPSTREAM_BLOCKED');
  assert.equal(evidence.atlas_effect.recommender, 'UPSTREAM_BLOCKED');
});

test('upstream evidence contains no fabricated production Hunt or metric payloads', () => {
  const serialized = JSON.stringify(evidence);
  for (const forbidden of ['"hunts"', '"observations"', '"metrics"', 'exp_per_hour', 'profit_per_hour']) {
    assert.equal(serialized.includes(forbidden), false, `unexpected production-like field ${forbidden}`);
  }
  assert.equal(evidence.atlas_effect.invented_production_hunts, false);
  assert.equal(evidence.atlas_effect.invented_production_metrics, false);
});
