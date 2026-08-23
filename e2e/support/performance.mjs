import { waitForCreatureAlignedToBase, waitForCreatureCommit, waitForRendererCommit } from './diagnostics.mjs';

function freezeActions(actions) {
  return Object.freeze(actions.map((action) => Object.freeze({ ...action })));
}

export function deterministicPerformanceActions() {
  return freezeActions([
    { type: 'pan', dx: 64, dy: 24 },
    { type: 'pan', dx: -64, dy: -24 },
    { type: 'wheelZoom', direction: 'in' },
    { type: 'wheelZoom', direction: 'out' },
    { type: 'buttonZoom', direction: 'in' },
    { type: 'buttonZoom', direction: 'out' },
    { type: 'creatures', value: 'none' },
    { type: 'creatures', value: 'both' },
    { type: 'mode', value: 'minimap' },
    { type: 'mode', value: 'map' },
    { type: 'floor', direction: 'down' },
    { type: 'floor', direction: 'up' },
    { type: 'resize', width: 1280, height: 720 },
    { type: 'resize', width: 1440, height: 900 },
    { type: 'animation', value: 'on' },
    { type: 'animation', value: 'off' },
  ]);
}

export function deterministicSoakCycleActions() {
  return freezeActions([
    { type: 'pan', dx: 48, dy: 0 },
    { type: 'pan', dx: -48, dy: 0 },
    { type: 'wheelZoom', direction: 'in' },
    { type: 'wheelZoom', direction: 'out' },
    { type: 'creatures', value: 'none' },
    { type: 'creatures', value: 'both' },
    { type: 'mode', value: 'minimap' },
    { type: 'mode', value: 'map' },
    { type: 'floor', direction: 'down' },
    { type: 'floor', direction: 'up' },
    { type: 'resize', width: 1280, height: 720 },
    { type: 'resize', width: 1440, height: 900 },
  ]);
}

const STRUCTURAL_BUDGETS = Object.freeze([
  Object.freeze({ value: 'drawCalls', limit: 'drawCallTarget' }),
  Object.freeze({ value: 'retainedChunks', limit: 'maxLoadedChunks' }),
  Object.freeze({ value: 'retainedGroups', limit: 'maxLoadedGroups' }),
  Object.freeze({ value: 'gpuTextureAllocatedBytes', limit: 'gpuTextureBudgetBytes' }),
  Object.freeze({ value: 'rangeCacheBytes', limit: 'semanticCacheBytes' }),
]);

function finite(value) {
  return Number.isFinite(value);
}

function finiteOrNull(value) {
  return finite(value) ? Number(value) : null;
}

function nonNegativeOrNull(value) {
  const normalized = finiteOrNull(value);
  return normalized != null && normalized >= 0 ? normalized : null;
}

function frozenStrings(values) {
  return Object.freeze((values ?? []).filter((value) => typeof value === 'string').map(String));
}

export function runtimeResourceSnapshot(input = {}) {
  const fullworld = input.fullworld ?? {};
  const measured = fullworld.measured ?? {};
  const profile = fullworld.performanceProfile ?? {};
  const renderer = input.renderer ?? {};
  const creatures = input.creatures ?? {};
  const heap = input.heap ?? {};
  const creatureAnchors = creatures.render?.anchors ?? [];
  const snapshot = {
    label: typeof input.label === 'string' ? input.label : null,
    rendererGeneration: nonNegativeOrNull(renderer.generation),
    creatureGeneration: nonNegativeOrNull(creatures.render?.generation),
    drawCalls: nonNegativeOrNull(renderer.drawCalls ?? measured.drawCalls),
    drawCallTarget: nonNegativeOrNull(measured.drawCallTarget ?? profile.drawCallTarget),
    retainedChunks: nonNegativeOrNull(renderer.retainedChunks ?? measured.retainedChunkCount),
    maxLoadedChunks: nonNegativeOrNull(measured.maxLoadedChunks ?? profile.maxLoadedChunks),
    retainedGroups: nonNegativeOrNull(renderer.retainedGroups ?? measured.retainedRangeGroups),
    maxLoadedGroups: nonNegativeOrNull(measured.maxLoadedGroups ?? profile.maxLoadedGroups),
    gpuTextureAllocatedBytes: nonNegativeOrNull(measured.gpuTextureAllocatedBytes),
    gpuTextureBudgetBytes: nonNegativeOrNull(measured.gpuTextureBudgetBytes ?? profile.gpuTextureBudgetBytes),
    semanticCacheBytes: nonNegativeOrNull(profile.semanticCacheBytes),
    rendererRenderMs: nonNegativeOrNull(renderer.renderMs ?? measured.webglRenderMs),
    rendererGpuRenderMs: nonNegativeOrNull(renderer.gpuRenderMs ?? measured.gpuRenderMs),
    visiblePrimitives: nonNegativeOrNull(renderer.visiblePrimitives ?? measured.visiblePrimitives),
    retainedPrimitives: nonNegativeOrNull(renderer.retainedPrimitives ?? measured.retainedPrimitives),
    creatureCacheChunks: nonNegativeOrNull(creatures.cacheChunks),
    creatureVisibleRecords: nonNegativeOrNull(creatures.visibleRecords),
    creatureDrawnRecords: nonNegativeOrNull(creatures.drawnRecords),
    creaturePixelDrawnRecords: nonNegativeOrNull(creatures.pixelDrawnRecords),
    creatureMarkerDrawnRecords: nonNegativeOrNull(creatures.markerDrawnRecords),
    creatureNpcIcons: nonNegativeOrNull(creatures.drawnNpcIcons),
    creatureAnchorIds: frozenStrings(creatureAnchors.map((anchor) => anchor?.id)),
    jsHeapBytes: nonNegativeOrNull(measured.jsHeapBytes ?? heap.usedJSHeapSize),
    peakJsHeapBytes: nonNegativeOrNull(measured.peakJsHeapBytes),
    totalJsHeapBytes: nonNegativeOrNull(heap.totalJSHeapSize),
    rangeRequests: nonNegativeOrNull(measured.rangeRequests),
    rangeAuthenticatedBytes: nonNegativeOrNull(measured.rangeAuthenticatedBytes),
    rangeCacheBytes: nonNegativeOrNull(measured.rangeCacheBytes),
    pixelNetworkBytes: nonNegativeOrNull(measured.pixelNetworkBytes),
    residentPixelBytes: nonNegativeOrNull(measured.residentPixelBytes),
  };
  return Object.freeze(snapshot);
}

export function structuralBudgetViolations(sample) {
  const violations = [];
  for (const budget of STRUCTURAL_BUDGETS) {
    const value = sample?.[budget.value];
    const limit = sample?.[budget.limit];
    if (!finite(limit) || limit < 0) {
      violations.push(Object.freeze({ metric: budget.limit, reason: 'missing', value: limit ?? null, limit: null }));
      continue;
    }
    if (!finite(value) || value < 0) {
      violations.push(Object.freeze({ metric: budget.value, reason: 'missing', value: value ?? null, limit }));
      continue;
    }
    if (value > limit) violations.push(Object.freeze({ metric: budget.value, reason: 'exceeded', value, limit }));
  }
  return Object.freeze(violations);
}

export function assertStructuralBudgets(sample) {
  const violations = structuralBudgetViolations(sample);
  if (violations.length === 0) return sample;
  const message = violations.map((item) => item.reason === 'missing'
    ? `${item.metric} missing`
    : `${item.metric} ${item.value} exceeds ${item.limit}`).join('; ');
  throw new Error(`Atlas structural performance budget violation: ${message}`);
}

export function detectMonotonicGrowth(values, options = {}) {
  const warmup = Number.isSafeInteger(options.warmup) && options.warmup >= 0 ? options.warmup : 0;
  const minPoints = Number.isSafeInteger(options.minPoints) && options.minPoints >= 2 ? options.minPoints : 3;
  if (!Array.isArray(values)) throw new TypeError('growth series must be an array');
  if (values.some((value) => !finite(value))) throw new TypeError('growth series values must be finite');
  const observed = values.slice(warmup);
  if (observed.length < minPoints) throw new RangeError(`growth analysis requires at least ${minPoints} observed points`);
  const deltas = observed.slice(1).map((value, index) => value - observed[index]);
  return Object.freeze({
    growing: deltas.length > 0 && deltas.every((delta) => delta > 0),
    observed: Object.freeze([...observed]),
    deltas: Object.freeze(deltas),
  });
}

export function findDuplicates(values) {
  const seen = new Set();
  const duplicates = [];
  const duplicateSet = new Set();
  for (const value of values ?? []) {
    if (seen.has(value) && !duplicateSet.has(value)) {
      duplicateSet.add(value);
      duplicates.push(value);
    }
    seen.add(value);
  }
  return Object.freeze(duplicates);
}

function percentile(sorted, fraction) {
  if (sorted.length === 1) return sorted[0];
  const index = (sorted.length - 1) * fraction;
  const lower = Math.floor(index);
  const upper = Math.ceil(index);
  if (lower === upper) return sorted[lower];
  const weight = index - lower;
  return sorted[lower] + (sorted[upper] - sorted[lower]) * weight;
}

function rounded(value) {
  return Math.round(value * 1000) / 1000;
}

export function summarizeNumericSeries(values) {
  if (!Array.isArray(values) || values.length === 0) return null;
  if (values.some((value) => !finite(value))) throw new TypeError('numeric series values must be finite');
  const sorted = [...values].sort((a, b) => a - b);
  const mean = sorted.reduce((sum, value) => sum + value, 0) / sorted.length;
  return Object.freeze({
    count: sorted.length,
    min: rounded(sorted[0]),
    max: rounded(sorted[sorted.length - 1]),
    mean: rounded(mean),
    p50: rounded(percentile(sorted, 0.5)),
    p95: rounded(percentile(sorted, 0.95)),
  });
}

export async function installPerformanceProbe(page, options = {}) {
  const limits = {
    frameIntervals: Math.max(16, Math.min(2048, Number(options.maxFrameIntervals) || 512)),
    renders: Math.max(16, Math.min(1024, Number(options.maxRenderSamples) || 256)),
    creatures: Math.max(16, Math.min(1024, Number(options.maxCreatureSamples) || 256)),
    longTasks: Math.max(8, Math.min(256, Number(options.maxLongTasks) || 128)),
  };
  await page.evaluate((limits) => {
    const existing = globalThis.__OTERYN_ATLAS_PERFORMANCE_PROBE__;
    if (existing?.active) {
      existing.active = false;
      if (existing.rafId != null) cancelAnimationFrame(existing.rafId);
      existing.longTaskObserver?.disconnect?.();
    }
    performance.setResourceTimingBufferSize?.(4096);
    performance.clearResourceTimings?.();
    const probe = {
      active: true,
      startedAtMs: performance.now(),
      resourceStartIndex: 0,
      frameIntervals: [],
      renderSamples: [],
      creatureSamples: [],
      longTasks: [],
      previousFrameMs: null,
      rafId: null,
      longTaskObserver: null,
      limits,
    };
    const push = (array, value, limit) => {
      array.push(value);
      if (array.length > limit) array.splice(0, array.length - limit);
    };
    const onRenderer = (event) => {
      const value = event.detail ?? {};
      push(probe.renderSamples, {
        atMs: performance.now(),
        generation: value.generation ?? null,
        drawCalls: value.drawCalls ?? null,
        retainedChunks: value.retainedChunks ?? null,
        retainedGroups: value.retainedGroups ?? null,
        visiblePrimitives: value.visiblePrimitives ?? null,
        retainedPrimitives: value.retainedPrimitives ?? null,
        renderMs: value.renderMs ?? null,
        gpuRenderMs: value.gpuRenderMs ?? null,
      }, limits.renders);
    };
    const onCreature = (event) => {
      const value = event.detail ?? {};
      push(probe.creatureSamples, {
        atMs: performance.now(),
        generation: value.generation ?? null,
        baseGenerationAtCommit: value.baseGenerationAtCommit ?? null,
        anchors: (value.anchors ?? []).slice(0, 24).map((anchor) => anchor.id),
      }, limits.creatures);
    };
    const tick = (now) => {
      if (!probe.active) return;
      if (probe.previousFrameMs != null) push(probe.frameIntervals, now - probe.previousFrameMs, limits.frameIntervals);
      probe.previousFrameMs = now;
      probe.rafId = requestAnimationFrame(tick);
    };
    window.addEventListener('oteryn-atlas-render-committed', onRenderer);
    window.addEventListener('oteryn-atlas-creature-render-committed', onCreature);
    probe.cleanup = () => {
      window.removeEventListener('oteryn-atlas-render-committed', onRenderer);
      window.removeEventListener('oteryn-atlas-creature-render-committed', onCreature);
    };
    if (typeof PerformanceObserver === 'function' && PerformanceObserver.supportedEntryTypes?.includes('longtask')) {
      probe.longTaskObserver = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) push(probe.longTasks, { startTime: entry.startTime, duration: entry.duration }, limits.longTasks);
      });
      probe.longTaskObserver.observe({ type: 'longtask', buffered: false });
    }
    probe.rafId = requestAnimationFrame(tick);
    globalThis.__OTERYN_ATLAS_PERFORMANCE_PROBE__ = probe;
  }, limits);
}

export async function captureRuntimeEvidence(page, label = null) {
  const raw = await page.evaluate((label) => ({
    label,
    fullworld: globalThis.__OTERYN_ATLAS_FULLWORLD__ ?? null,
    renderer: globalThis.__OTERYN_ATLAS_RENDERER_DIAGNOSTICS__ ?? null,
    creatures: globalThis.__OTERYN_ATLAS_CREATURES__ ?? null,
    heap: performance.memory ? {
      usedJSHeapSize: performance.memory.usedJSHeapSize,
      totalJSHeapSize: performance.memory.totalJSHeapSize,
      jsHeapSizeLimit: performance.memory.jsHeapSizeLimit,
    } : null,
  }), label);
  return runtimeResourceSnapshot(raw);
}

export async function stopPerformanceProbe(page) {
  const raw = await page.evaluate(() => {
    const probe = globalThis.__OTERYN_ATLAS_PERFORMANCE_PROBE__;
    if (!probe) return null;
    probe.active = false;
    if (probe.rafId != null) cancelAnimationFrame(probe.rafId);
    probe.longTaskObserver?.disconnect?.();
    probe.cleanup?.();
    const resources = performance.getEntriesByType('resource').slice(probe.resourceStartIndex);
    const resourceTiming = resources.reduce((result, entry) => {
      result.count += 1;
      if (Number.isFinite(entry.transferSize)) result.transferSize += entry.transferSize;
      if (Number.isFinite(entry.encodedBodySize)) result.encodedBodySize += entry.encodedBodySize;
      if (Number.isFinite(entry.decodedBodySize)) result.decodedBodySize += entry.decodedBodySize;
      return result;
    }, { count: 0, transferSize: 0, encodedBodySize: 0, decodedBodySize: 0 });
    return {
      durationMs: performance.now() - probe.startedAtMs,
      frameIntervals: [...probe.frameIntervals],
      renderSamples: [...probe.renderSamples],
      creatureSamples: [...probe.creatureSamples],
      longTasks: [...probe.longTasks],
      resourceTiming,
      heap: performance.memory ? {
        usedJSHeapSize: performance.memory.usedJSHeapSize,
        totalJSHeapSize: performance.memory.totalJSHeapSize,
        jsHeapSizeLimit: performance.memory.jsHeapSizeLimit,
      } : null,
    };
  });
  if (!raw) throw new Error('Atlas performance probe is not installed');
  const renderMs = raw.renderSamples.map((sample) => sample.renderMs).filter(finite);
  const gpuRenderMs = raw.renderSamples.map((sample) => sample.gpuRenderMs).filter(finite);
  const longTaskMs = raw.longTasks.map((sample) => sample.duration).filter(finite);
  return Object.freeze({
    durationMs: rounded(raw.durationMs),
    frameIntervals: Object.freeze([...raw.frameIntervals]),
    frameIntervalSummary: summarizeNumericSeries(raw.frameIntervals),
    renderSamples: Object.freeze(raw.renderSamples.map((sample) => Object.freeze({ ...sample }))),
    renderMsSummary: summarizeNumericSeries(renderMs),
    gpuRenderMsSummary: summarizeNumericSeries(gpuRenderMs),
    creatureSamples: Object.freeze(raw.creatureSamples.map((sample) => Object.freeze({ ...sample, anchors: frozenStrings(sample.anchors) }))),
    longTasks: Object.freeze(raw.longTasks.map((sample) => Object.freeze({ ...sample }))),
    longTaskSummary: summarizeNumericSeries(longTaskMs),
    resourceTiming: Object.freeze({ ...raw.resourceTiming }),
    heap: raw.heap ? Object.freeze({ ...raw.heap }) : null,
  });
}

async function browserNow(page) {
  return page.evaluate(() => performance.now());
}

async function currentGenerations(page) {
  return page.evaluate(() => ({
    base: globalThis.__OTERYN_ATLAS_RENDERER_DIAGNOSTICS__?.generation ?? 0,
    creature: globalThis.__OTERYN_ATLAS_CREATURES__?.render?.generation ?? 0,
  }));
}

async function waitForCurrentQualifiedView(page) {
  await page.waitForFunction(() => {
    const qualification = globalThis.__OTERYN_ATLAS_FULLWORLD__;
    const view = globalThis.__OTERYN_ATLAS_VIEW__;
    if (!qualification?.view || !view) return false;
    const same = qualification.view.floor === view.floor
      && qualification.view.mode === view.mode
      && qualification.view.animation === view.animation
      && Math.abs(qualification.view.x - view.x) < 1e-9
      && Math.abs(qualification.view.y - view.y) < 1e-9
      && Math.abs(qualification.view.zoom - view.zoom) < 1e-9;
    return same && (qualification.status === 'PASS' || qualification.status === 'FAIL');
  }, null, { timeout: 90_000 });
  const result = await page.evaluate(() => globalThis.__OTERYN_ATLAS_FULLWORLD__);
  if (result?.status !== 'PASS') throw new Error(result?.error || `Atlas qualification=${result?.status}`);
  return result;
}

async function creatureProductAvailable(page) {
  return page.evaluate(() => globalThis.__OTERYN_ATLAS_CREATURES__?.status === 'PASS');
}

async function alignCreatureIfAvailable(page) {
  if (await creatureProductAvailable(page)) await waitForCreatureAlignedToBase(page, false);
}

async function canvasCenter(page) {
  const box = await page.locator('#atlas').boundingBox();
  if (!box) throw new Error('Atlas canvas has no bounding box');
  return Object.freeze({ x: box.x + box.width / 2, y: box.y + box.height / 2 });
}

export async function executeAtlasPerformanceAction(page, action) {
  if (!action || typeof action.type !== 'string') throw new TypeError('performance action type is required');
  const before = await currentGenerations(page);
  const startedAtMs = await browserNow(page);
  let baseExpected = false;
  let creatureExpected = false;
  let qualificationExpected = false;
  let skipReason = null;

  if (action.type === 'pan') {
    const center = await canvasCenter(page);
    await page.mouse.move(center.x, center.y);
    await page.mouse.down();
    await page.mouse.move(center.x + action.dx, center.y + action.dy);
    await page.mouse.up();
    baseExpected = true;
    qualificationExpected = true;
  } else if (action.type === 'wheelZoom') {
    const center = await canvasCenter(page);
    await page.mouse.move(center.x, center.y);
    await page.mouse.wheel(0, action.direction === 'in' ? -240 : 240);
    baseExpected = true;
    qualificationExpected = true;
  } else if (action.type === 'buttonZoom') {
    const control = page.locator(action.direction === 'in' ? '#zoom-in' : '#zoom-out');
    await control.scrollIntoViewIfNeeded();
    await control.click();
    baseExpected = true;
    qualificationExpected = true;
  } else if (action.type === 'creatures') {
    const npc = page.locator('input[data-creature-kind="npc"]');
    const monster = page.locator('input[data-creature-kind="monster"]');
    const wantedNpc = action.value === 'npc' || action.value === 'both';
    const wantedMonster = action.value === 'monster' || action.value === 'both';
    await npc.scrollIntoViewIfNeeded();
    if ((await npc.isChecked()) !== wantedNpc) await npc.setChecked(wantedNpc);
    if ((await monster.isChecked()) !== wantedMonster) await monster.setChecked(wantedMonster);
    await page.waitForFunction(({ npcEnabled, monsterEnabled }) => {
      const creatures = globalThis.__OTERYN_ATLAS_CREATURES__;
      return creatures?.status === 'PASS'
        && creatures.enabled?.npc === npcEnabled
        && creatures.enabled?.monster === monsterEnabled;
    }, { npcEnabled: wantedNpc, monsterEnabled: wantedMonster }, { timeout: 30_000 });
    creatureExpected = true;
  } else if (action.type === 'mode') {
    const control = page.locator(`#view-mode-control [data-mode="${action.value}"]`);
    await control.scrollIntoViewIfNeeded();
    await control.click();
    baseExpected = true;
    qualificationExpected = true;
  } else if (action.type === 'floor') {
    const control = page.locator(action.direction === 'up' ? '#floor-up' : '#floor-down');
    await control.scrollIntoViewIfNeeded();
    if (await control.isDisabled()) throw new Error(`floor ${action.direction} is unavailable for deterministic workload`);
    await control.click();
    baseExpected = true;
    qualificationExpected = true;
  } else if (action.type === 'resize') {
    await page.setViewportSize({ width: action.width, height: action.height });
    baseExpected = true;
  } else if (action.type === 'animation') {
    const control = page.locator('#animation-toggle');
    if (await control.isDisabled()) {
      skipReason = 'animation capability disabled by factual Atlas publication';
    } else {
      const wanted = action.value === 'on';
      if ((await control.isChecked()) !== wanted) await control.setChecked(wanted);
      baseExpected = true;
      qualificationExpected = true;
    }
  } else {
    throw new Error(`unsupported performance action ${action.type}`);
  }

  if (baseExpected) await waitForRendererCommit(page, before.base);
  if (creatureExpected) await waitForCreatureCommit(page, before.creature);
  if (qualificationExpected) await waitForCurrentQualifiedView(page);
  if (baseExpected && !skipReason) await alignCreatureIfAvailable(page);

  const finishedAtMs = await browserNow(page);
  return Object.freeze({
    action: Object.freeze({ ...action }),
    durationMs: rounded(finishedAtMs - startedAtMs),
    before: Object.freeze({ ...before }),
    after: Object.freeze(await currentGenerations(page)),
    skipReason,
  });
}
