import assert from 'node:assert/strict';
import test from 'node:test';

import { classifyScenario, normalizeSummaryScenario } from '../../e2e/summary-reporter.mjs';

test('summary reporter classifies verification-specific specs deterministically', () => {
  assert.equal(classifyScenario('e2e/tests/geometry-desktop.spec.mjs', []), 'geometry');
  assert.equal(classifyScenario('e2e/tests/render-probes-desktop.spec.mjs', []), 'render');
  assert.equal(classifyScenario('e2e/tests/stress-desktop.spec.mjs', []), 'stress');
  assert.equal(classifyScenario('e2e/tests/performance-desktop.spec.mjs', []), 'performance');
  assert.equal(classifyScenario('e2e/tests/desktop.spec.mjs', []), 'e2e');
  assert.equal(classifyScenario('anything.spec.mjs', [{ type: 'category', description: 'accessibility' }]), 'accessibility');
});

test('summary scenario preserves seed, first failure and explicit skip reason', () => {
  const scenario = normalizeSummaryScenario({
    project: 'desktop-chromium',
    file: 'e2e/tests/stress-desktop.spec.mjs',
    title: 'seed 85',
    annotations: [
      { type: 'seed', description: '85' },
      { type: 'first-failing-action', description: '3' },
      { type: 'skip-reason', description: 'optional publication absent' },
    ],
    status: 'skipped',
    durationMs: 12,
    retry: 0,
    evidence: ['action-log.json'],
    error: null,
  });
  assert.equal(scenario.category, 'stress');
  assert.equal(scenario.seed, 85);
  assert.equal(scenario.firstFailingActionIndex, 3);
  assert.equal(scenario.skipReason, 'optional publication absent');
  assert(Object.isFrozen(scenario));
});