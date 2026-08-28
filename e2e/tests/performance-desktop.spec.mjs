import { writeFile } from 'node:fs/promises';

import { expect, test } from '@playwright/test';

import {
  assertStructuralBudgets,
  captureRuntimeEvidence,
  deterministicPerformanceActions,
  executeAtlasPerformanceAction,
  findDuplicates,
  installPerformanceProbe,
  stopPerformanceProbe,
} from '../support/performance.mjs';
import { waitForCreatureAlignedToBase, waitForCreatureCommit, waitForRendererCommit } from '../support/diagnostics.mjs';
import { assertNoRuntimeFailures, captureRuntimeFailures, gotoAtlas, waitForAtlas } from './runtime.mjs';
import { DENSE_MONSTER_SCENE, sceneEntry } from '../support/qualification-fixture-scenarios.mjs';

const ENTRY = sceneEntry(DENSE_MONSTER_SCENE, { animation: 'off' });
const FRAME_EVIDENCE_THRESHOLD_MS = 1000 / 30;

test.setTimeout(300_000);

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

async function currentView(page) {
  return page.evaluate(() => globalThis.__OTERYN_ATLAS_VIEW__);
}

test('normalized desktop workload stays inside accepted structural budgets and records non-blocking timing evidence', async ({ page }, testInfo) => {
  const runtime = captureRuntimeFailures(page);
  const actions = deterministicPerformanceActions();
  await gotoAtlas(page, ENTRY);
  const qualification = await waitForAtlas(page);
  await waitForRendererCommit(page);
  await page.waitForFunction(() => globalThis.__OTERYN_ATLAS_CREATURES__?.status === 'PASS', null, { timeout: 30_000 });
  await waitForCreatureCommit(page);
  await waitForCreatureAlignedToBase(page, false);

  const startView = await currentView(page);
  const initial = await captureRuntimeEvidence(page, 'initial');
  assertSnapshotInvariants(initial);
  await installPerformanceProbe(page);

  const steps = [];
  for (let index = 0; index < actions.length; index += 1) {
    try {
      const execution = await executeAtlasPerformanceAction(page, actions[index]);
      const snapshot = await captureRuntimeEvidence(page, `step-${index}`);
      assertSnapshotInvariants(snapshot);
      steps.push({ index, execution, snapshot });
      assertNoRuntimeFailures(runtime);
    } catch (error) {
      testInfo.annotations.push({ type: 'first-failing-action', description: String(index) });
      await attachJson(testInfo, 'performance-partial-evidence.json', { actions, completedSteps: steps, firstFailingActionIndex: index, action: actions[index], error: String(error?.message ?? error) });
      throw new Error(`performance action ${index} ${JSON.stringify(actions[index])} failed: ${error.message}`);
    }
  }

  const probe = await stopPerformanceProbe(page);
  const final = await captureRuntimeEvidence(page, 'final');
  assertSnapshotInvariants(final);
  const endView = await currentView(page);

  expect(endView.floor).toBe(startView.floor);
  expect(endView.mode).toBe(startView.mode);
  expect(endView.animation).toBe(startView.animation);
  expect(endView.x).toBeCloseTo(startView.x, 9);
  expect(endView.y).toBeCloseTo(startView.y, 9);
  expect(endView.zoom).toBeCloseTo(startView.zoom, 9);
  expect(probe.frameIntervals.length, 'performance probe captured no frame intervals').toBeGreaterThan(0);
  expect(probe.renderSamples.length, 'performance probe captured no committed renderer samples').toBeGreaterThan(0);

  const animationOn = steps.find((step) => step.execution.action.type === 'animation' && step.execution.action.value === 'on');
  const animationOff = steps.find((step) => step.execution.action.type === 'animation' && step.execution.action.value === 'off');
  const evidence = {
    schemaVersion: 1,
    classification: 'PERFORMANCE_BASELINE_EVIDENCE_NOT_PRODUCT_SLO',
    atlasRevision: process.env.ATLAS_EXPECTED_REVISION ?? process.env.ATLAS_CODE_REVISION ?? null,
    targetMode: process.env.ATLAS_PUBLICATION_ORIGIN ? 'checkout-overlay' : 'direct-preview',
    profile: qualification.performanceProfile,
    structuralBudgetsBlocking: true,
    timingAndHeapBlocking: false,
    workload: actions,
    initial,
    final,
    steps,
    probe,
    frameEvidence: {
      thresholdMs: FRAME_EVIDENCE_THRESHOLD_MS,
      framesOverThreshold: probe.frameIntervals.filter((value) => value > FRAME_EVIDENCE_THRESHOLD_MS).length,
      blocking: false,
    },
    networkDeltas: {
      rangeRequests: (final.rangeRequests ?? 0) - (initial.rangeRequests ?? 0),
      rangeAuthenticatedBytes: (final.rangeAuthenticatedBytes ?? 0) - (initial.rangeAuthenticatedBytes ?? 0),
      rangeCacheBytes: (final.rangeCacheBytes ?? 0) - (initial.rangeCacheBytes ?? 0),
      pixelNetworkBytes: (final.pixelNetworkBytes ?? 0) - (initial.pixelNetworkBytes ?? 0),
    },
    animationComparison: {
      available: Boolean(animationOn && animationOff && !animationOn.execution.skipReason && !animationOff.execution.skipReason),
      onActionDurationMs: animationOn?.execution.durationMs ?? null,
      offActionDurationMs: animationOff?.execution.durationMs ?? null,
      onSkipReason: animationOn?.execution.skipReason ?? null,
      offSkipReason: animationOff?.execution.skipReason ?? null,
      blocking: false,
    },
  };
  await attachJson(testInfo, 'performance-evidence.json', evidence);
  assertNoRuntimeFailures(runtime);
});
