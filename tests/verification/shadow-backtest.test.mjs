import assert from 'node:assert/strict';
import test from 'node:test';

import {
  assertExactFullSafeCoverage,
  evaluateMatrixCardinality,
  evaluateStableIdSelection,
} from '../../tools/verification/shadow-backtest.mjs';

const A = 'desktop-chromium::e2e/tests/a.spec.mjs::alpha';
const B = 'desktop-chromium::e2e/tests/b.spec.mjs::beta';
const C = 'mobile-chromium::e2e/tests/c.spec.mjs::gamma';

test('classifies exact false negatives and over-selection from stable-ID truth', () => {
  const result = evaluateStableIdSelection({
    selectedStableTestIds: [C, A],
    requiredTruthStableTestIds: [B, A],
    fullSafeStableTestIds: [A, B, C],
  });
  assert.equal(result.status, 'BLOCKED_UNDER_SELECTION');
  assert.deepEqual(result.falseNegativeStableTestIds, [B]);
  assert.deepEqual(result.overSelectedStableTestIds, [C]);
  assert.deepEqual(result.selectedStableTestIds, [A, C]);
  assert.deepEqual(result.requiredTruthStableTestIds, [A, B]);
});

test('over-selection is telemetry when no required truth ID is missed', () => {
  const result = evaluateStableIdSelection({
    selectedStableTestIds: [A, C],
    requiredTruthStableTestIds: [A],
    fullSafeStableTestIds: [A, B, C],
  });
  assert.equal(result.status, 'SAFE');
  assert.deepEqual(result.falseNegativeStableTestIds, []);
  assert.deepEqual(result.overSelectedStableTestIds, [C]);
});

test('selection and truth must be unique subsets of the full-safe universe', () => {
  assert.throws(() => evaluateStableIdSelection({
    selectedStableTestIds: [A, A],
    requiredTruthStableTestIds: [A],
    fullSafeStableTestIds: [A, B],
  }), /selectedStableTestIds contains duplicate/);
  assert.throws(() => evaluateStableIdSelection({
    selectedStableTestIds: [C],
    requiredTruthStableTestIds: [A],
    fullSafeStableTestIds: [A, B],
  }), /selected stable ID is outside full-safe universe/);
  assert.throws(() => evaluateStableIdSelection({
    selectedStableTestIds: [A],
    requiredTruthStableTestIds: [C],
    fullSafeStableTestIds: [A, B],
  }), /truth stable ID is outside full-safe universe/);
});

test('full-safe coverage requires exact stable-ID set equality', () => {
  const exact = assertExactFullSafeCoverage({ expectedStableTestIds: [B, A], observedStableTestIds: [A, B] });
  assert.equal(exact.status, 'EXACT');
  assert.deepEqual(exact.stableTestIds, [A, B]);
  assert.throws(() => assertExactFullSafeCoverage({ expectedStableTestIds: [A, B], observedStableTestIds: [A] }), /missing stable IDs/);
  assert.throws(() => assertExactFullSafeCoverage({ expectedStableTestIds: [A], observedStableTestIds: [A, B] }), /unexpected stable IDs/);
});

test('matrix cardinality is caller-bounded and never chooses a policy threshold', () => {
  const result = evaluateMatrixCardinality({
    axes: { browser: ['chromium'], viewport: ['desktop', 'mobile'], dpr: [1, 2] },
    maxCombinations: 4,
  });
  assert.equal(result.cardinality, 4);
  assert.equal(result.maxCombinations, 4);
  assert.throws(() => evaluateMatrixCardinality({
    axes: { browser: ['chromium'], viewport: ['desktop', 'mobile'], dpr: [1, 2] },
    maxCombinations: 3,
  }), /matrix cardinality 4 exceeds allowed 3/);
  assert.throws(() => evaluateMatrixCardinality({ axes: { browser: [] }, maxCombinations: 1 }), /non-empty array/);
  assert.throws(() => evaluateMatrixCardinality({ axes: { browser: ['chromium'] } }), /maxCombinations/);
});

test('explicit specialist stable IDs may extend the hosted full-safe comparison universe', () => {
  const specialist = 'desktop-chromium::e2e/tests/fullworld-animation-census-desktop.spec.mjs::complete census';
  const result = evaluateStableIdSelection({
    selectedStableTestIds: [A, specialist],
    requiredTruthStableTestIds: [specialist],
    fullSafeStableTestIds: [A, B, C],
    allowedAdditionalStableTestIds: [specialist],
  });
  assert.equal(result.status, 'SAFE');
  assert.deepEqual(result.falseNegativeStableTestIds, []);
  assert.deepEqual(result.allowedAdditionalStableTestIds, [specialist]);
});
