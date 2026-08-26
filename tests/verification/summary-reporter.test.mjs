import assert from 'node:assert/strict';
import test from 'node:test';

import AtlasSummaryReporter, {
  buildFailureManifest,
  classifyScenario,
  normalizeSummaryScenario,
} from '../../e2e/summary-reporter.mjs';

test('summary reporter classifies verification-specific specs deterministically', () => {
  assert.equal(classifyScenario('e2e/tests/geometry-desktop.spec.mjs', []), 'geometry');
  assert.equal(classifyScenario('e2e/tests/render-probes-desktop.spec.mjs', []), 'render');
  assert.equal(classifyScenario('e2e/tests/stress-desktop.spec.mjs', []), 'stress');
  assert.equal(classifyScenario('e2e/tests/performance-desktop.spec.mjs', []), 'performance');
  assert.equal(classifyScenario('e2e/tests/accessibility-desktop.spec.mjs', []), 'accessibility');
  assert.equal(classifyScenario('e2e/tests/accessibility-mobile.spec.mjs', []), 'accessibility');
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

test('summary scenario emits a path-normalized stable test identity', () => {
  const scenario = normalizeSummaryScenario({
    project: 'desktop-chromium',
    file: 'C:\\work\\Oteryn-Atlas\\e2e\\tests\\geometry-desktop.spec.mjs',
    title: 'geometry stays synchronized',
    status: 'passed',
    durationMs: 12,
    retry: 0,
  });

  assert.equal(scenario.specPath, 'e2e/tests/geometry-desktop.spec.mjs');
  assert.equal(
    scenario.stableTestId,
    'desktop-chromium::e2e/tests/geometry-desktop.spec.mjs::geometry stays synchronized',
  );
  assert(Object.isFrozen(scenario));
});

test('summary stable IDs preserve bounded long-component identity with digest suffixes', () => {
  const scenario = normalizeSummaryScenario({
    project: 'desktop-chromium',
    file: `e2e/tests/${'nested/'.repeat(80)}long-boundary.spec.mjs`,
    title: `scenario ${'x'.repeat(700)}`,
    status: 'passed',
    durationMs: 1,
    retry: 0,
  });

  assert(scenario.stableTestId.length <= 1156);
  assert.match(scenario.stableTestId, /~sha256:[a-f0-9]{64}/);
});

test('Playwright reporter excludes project and spec path from the stable scenario title', () => {
  const reporter = new AtlasSummaryReporter();
  reporter.onBegin({ metadata: {}, projects: [] });
  reporter.onTestEnd({
    parent: { project: () => ({ name: 'desktop-chromium' }) },
    location: { file: 'C:\\work\\Oteryn-Atlas\\e2e\\tests\\accessibility-desktop.spec.mjs' },
    titlePath: () => [
      '',
      'desktop-chromium',
      'accessibility-desktop.spec.mjs',
      'desktop critical controls expose truthful accessible names and disabled states',
    ],
    annotations: [],
  }, {
    status: 'passed',
    duration: 12,
    retry: 0,
    attachments: [],
  });

  assert.equal(
    reporter.scenarios[0].stableTestId,
    'desktop-chromium::e2e/tests/accessibility-desktop.spec.mjs::desktop critical controls expose truthful accessible names and disabled states',
  );
});

test('Playwright reporter keeps nested titles in the same delimiter form as the test list', () => {
  const reporter = new AtlasSummaryReporter();
  reporter.onBegin({ metadata: {}, projects: [] });
  reporter.onTestEnd({
    parent: { project: () => ({ name: 'desktop-chromium' }) },
    location: { file: 'e2e/tests/desktop.spec.mjs' },
    titlePath: () => ['', 'desktop-chromium', 'desktop.spec.mjs', 'search drawer', 'restores result state'],
    annotations: [],
  }, {
    status: 'passed',
    duration: 12,
    retry: 0,
    attachments: [],
  });

  assert.equal(
    reporter.scenarios[0].stableTestId,
    'desktop-chromium::e2e/tests/desktop.spec.mjs::search drawer › restores result state',
  );
});

test('failed browser runs produce a bounded machine-readable failure manifest', () => {
  const failed = normalizeSummaryScenario({
    project: 'desktop-chromium',
    file: 'e2e/tests/stress-desktop.spec.mjs',
    title: 'seeded stress',
    annotations: [
      { type: 'seed', description: '133' },
      { type: 'first-failing-action', description: '7' },
    ],
    status: 'failed',
    durationMs: 42,
    retry: 0,
    evidence: ['test-results/stress/trace.zip', 'action-log.json'],
    error: 'geometry drift',
  });
  const passed = normalizeSummaryScenario({
    project: 'desktop-chromium',
    file: 'e2e/tests/geometry-desktop.spec.mjs',
    title: 'geometry',
    status: 'passed',
    durationMs: 12,
    retry: 0,
  });
  const manifest = buildFailureManifest({
    status: 'failed',
    metadata: { expectedRevision: 'abc123', browserContainer: 'sha256:browser' },
    projects: [{ name: 'desktop-chromium', viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 }],
    scenarios: [passed, failed],
  });

  assert.equal(manifest.version, 1);
  assert.equal(manifest.status, 'failed');
  assert.equal(manifest.atlasRevision, 'abc123');
  assert.equal(manifest.failures.length, 1);
  assert.equal(manifest.failures[0].seed, 133);
  assert.equal(
    manifest.failures[0].stableTestId,
    'desktop-chromium::e2e/tests/stress-desktop.spec.mjs::seeded stress',
  );
  assert.equal(manifest.failures[0].firstFailingActionIndex, 7);
  assert.deepEqual(manifest.failures[0].evidence, ['test-results/stress/trace.zip', 'action-log.json']);
  assert(Object.isFrozen(manifest));
});
