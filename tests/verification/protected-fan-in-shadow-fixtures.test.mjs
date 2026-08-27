import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

import { validateProtectedFanIn } from '../../tools/verification/protected-fan-in-bootstrap.mjs';

const fixtures = JSON.parse(fs.readFileSync('tools/verification/shadow-fan-in-negative-fixtures.json', 'utf8'));

test('shadow negative fan-in fixtures are versioned and cover stale/cancelled/exact-set failures', () => {
  assert.equal(fixtures.schemaVersion, 1);
  assert.deepEqual(new Set(fixtures.cases.map((entry) => entry.id)), new Set([
    'cancelled-summary',
    'stale-old-head-success',
    'duplicate-across-shards',
    'missing-planned-id',
    'unexpected-id',
  ]));
  for (const fixture of fixtures.cases) {
    assert.throws(
      () => validateProtectedFanIn(fixtures.plan, fixture.summaries),
      (error) => error instanceof TypeError && error.message.includes(fixture.expectedError),
      fixture.id,
    );
  }
});

test('same interface accepts exact complete current-head evidence', () => {
  const summary = {
    status: 'success',
    candidateHeadSha: fixtures.plan.candidateHeadSha,
    planDigest: fixtures.plan.planDigest,
    executedStableTestIds: [...fixtures.plan.stableTestIds].reverse(),
  };
  const result = validateProtectedFanIn(fixtures.plan, [summary]);
  assert.equal(result.status, 'success');
  assert.deepEqual(result.executedStableTestIds, [...fixtures.plan.stableTestIds].sort());
});
