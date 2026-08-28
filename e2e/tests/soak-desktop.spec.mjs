import { writeFile } from 'node:fs/promises';

import { expect, test } from '@playwright/test';

import {
  assertStructuralBudgets,
  captureRuntimeEvidence,
  detectMonotonicGrowth,
  deterministicSoakCycleActions,
  executeAtlasPerformanceAction,
  findDuplicates,
  installPerformanceProbe,
  stopPerformanceProbe,
} from '../support/performance.mjs';
import { waitForCreatureAlignedToBase, waitForCreatureCommit, waitForRendererCommit } from '../support/diagnostics.mjs';
import { assertNoRuntimeFailures, captureRuntimeFailures, gotoAtlas, waitForAtlas } from './runtime.mjs';
import { DENSE_MONSTER_SCENE, sceneEntry } from '../support/qualification-fixture-scenarios.mjs';

const ENTRY = sceneEntry(DENSE_MONSTER_SCENE, { animation: 'off' });
const SOAK_CYCLES = 4;
const STRUCTURAL_GROWTH_FIELDS = Object.freeze(['retainedChunks', 'retainedGroups', 'rangeCacheBytes', 'creatureCacheChunks']);

test.setTimeout(420_000);

async function attachJson(testInfo, name, value) {
  const outputPath = testInfo.outputPath(name);
  await writeFile(outputPath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
  await testInfo.attach(name, { path: outputPath, contentType: 'application/json' });
  return outputPath;
}

function assertSnapshotInvariants(snapshot) {
  assertStructuralBudgets(snapshot);
  expect(findDuplicates(snapshot.creatureAnchorIds), 'duplicate creature anchors retained in one committed overlay').toEqual([]);
  if (snapshot.creatureDrawnRecords != null && snapshot.creatureVisibleRecords != null) {
    expect(snapshot.creatureDrawnRecords, 'drawn creature records exceed visible factual records').toBeLessThanOrEqual(snapshot.creatureVisibleRecords);
  }
}

function analyzeStructuralGrowth(endpoints) {
  const result = {};
  for (const field of STRUCTURAL_GROWTH_FIELDS) {
    const values = endpoints.map((snapshot) => snapshot[field]);
    if (values.every(Number.isFinite)) result[field] = detectMonotonicGrowth(values, { warmup: 1, minPoints: 3 });
    else result[field] = { growing: null, observed: values, deltas: [], reason: 'metric unavailable in one or more samples' };
  }
  return result;
}

async function currentView(page) {
  return page.evaluate(() => globalThis.__OTERYN_ATLAS_VIEW__);
}

test('bounded repeated interaction cycle does not retain monotonically growing structural state', async ({ page }, testInfo) => {
  const runtime = captureRuntimeFailures(page);
  const cycleActions = deterministicSoakCycleActions();
  await gotoAtlas(page, ENTRY);
  const qualification = await waitForAtlas(page);
  await waitForRendererCommit(page);
  await page.waitForFunction(() => globalThis.__OTERYN_ATLAS_CREATURES__?.status === 'PASS', null, { timeout: 30_000 });
  await waitForCreatureCommit(page);
  await waitForCreatureAlignedToBase(page, false);

  const startView = await currentView(page);
  const endpoints = [await captureRuntimeEvidence(page, 'cycle-0-baseline')];
  assertSnapshotInvariants(endpoints[0]);
  await installPerformanceProbe(page);

  const cycles = [];
  for (let cycle = 1; cycle <= SOAK_CYCLES; cycle += 1) {
    const executions = [];
    for (const action of cycleActions) {
      executions.push(await executeAtlasPerformanceAction(page, action));
      assertNoRuntimeFailures(runtime);
    }
    const snapshot = await captureRuntimeEvidence(page, `cycle-${cycle}`);
    assertSnapshotInvariants(snapshot);
    const view = await currentView(page);
    expect(view.floor).toBe(startView.floor);
    expect(view.mode).toBe(startView.mode);
    expect(view.animation).toBe(startView.animation);
    expect(view.x).toBeCloseTo(startView.x, 9);
    expect(view.y).toBeCloseTo(startView.y, 9);
    expect(view.zoom).toBeCloseTo(startView.zoom, 9);
    endpoints.push(snapshot);
    cycles.push({ cycle, executions, snapshot });
  }

  const structuralGrowth = analyzeStructuralGrowth(endpoints);
  for (const field of STRUCTURAL_GROWTH_FIELDS) {
    if (structuralGrowth[field].growing != null) {
      expect(structuralGrowth[field].growing, `${field} grew strictly on every post-warmup soak endpoint`).toBe(false);
    }
  }

  const heapValues = endpoints.map((snapshot) => snapshot.jsHeapBytes);
  const heapTrend = heapValues.every(Number.isFinite)
    ? detectMonotonicGrowth(heapValues, { warmup: 1, minPoints: 3 })
    : { growing: null, observed: heapValues, deltas: [], reason: 'reliable page heap signal unavailable' };
  const probe = await stopPerformanceProbe(page);
  expect(probe.frameIntervals.length, 'soak probe captured no frame intervals').toBeGreaterThan(0);
  expect(probe.renderSamples.length, 'soak probe captured no committed renderer samples').toBeGreaterThan(0);

  const evidence = {
    schemaVersion: 1,
    classification: 'BOUNDED_SOAK_EVIDENCE_NOT_HEAP_SLO',
    atlasRevision: process.env.ATLAS_EXPECTED_REVISION ?? process.env.ATLAS_CODE_REVISION ?? null,
    targetMode: process.env.ATLAS_PUBLICATION_ORIGIN ? 'checkout-overlay' : 'direct-preview',
    profile: qualification.performanceProfile,
    cycles: SOAK_CYCLES,
    cycleActions,
    endpoints,
    structuralGrowth,
    heapTrend: { ...heapTrend, blocking: false },
    probe,
  };
  await attachJson(testInfo, 'soak-evidence.json', evidence);
  assertNoRuntimeFailures(runtime);
});
