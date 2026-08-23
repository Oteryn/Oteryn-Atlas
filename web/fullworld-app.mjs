import {
  SemanticRangeStore,
  changeFloor,
  filterTilesForBounds,
  flattenRenderRecords,
  loadFullWorldPublication,
  loadRuntimeFloor,
  loadRuntimeWorld,
  loadSemanticFloor,
  loadSemanticWorld,
  parseCoordinateSearch,
  parseFullWorldViewState,
  selectRuntimeGroups,
  serializeFullWorldViewState,
  viewportTileBounds,
} from '../src/browser/fullworld.mjs';
import { FULLWORLD_CAPABILITIES, FULLWORLD_PATHS, FULLWORLD_TRUST } from '../src/browser/fullworld-trust.mjs';
import { loadFullWorldPixelCatalog } from '../src/browser/fullworld-pixels.mjs';
import { loadRuntimePixelBuckets, loadVerifiedPixelBucket, loadVerifiedPixelBundle, requiredRuntimePixelBuckets } from '../src/browser/fullworld-pixel-buckets.mjs';
import { recordsForResidentBuckets } from '../src/browser/fullworld-progressive.mjs';
import { createFullWorldWebGLRenderer } from '../src/browser/fullworld-webgl.mjs';
import { createRendererDiagnosticSnapshot } from '../src/browser/renderer-diagnostics.mjs';
import { resolvePerformanceProfile, profileSummary } from '../src/browser/fullworld-performance.mjs';
import { createFrameScheduler } from '../src/browser/frame-scheduler.mjs';
import { getAnimationRuntime } from '../src/browser/animation-runtime-service.mjs';
import { VerifiedContentCache } from '../src/browser/verified-content-cache.mjs';
import { loadOverviewChunk, loadOverviewFloor, loadOverviewWorld } from '../src/layers/overview.mjs';
import { LOD_POLICY, detailStreamWanted, lodBlend } from '../src/layers/minimap-lod.mjs';
import { createWorldQueryApi } from '../src/browser/world-query.mjs';

const bootStartedMs = performance.now();
const performanceProfile = resolvePerformanceProfile(location.search);
const PREFETCH_TILES = performanceProfile.prefetchTiles;
const GROUP_CONCURRENCY = performanceProfile.groupConcurrency;
const OVERVIEW_CONCURRENCY = performanceProfile.overviewConcurrency;
const PIXEL_BUCKET_CONCURRENCY = performanceProfile.pixelBucketConcurrency;
const $ = (selector) => document.querySelector(selector);
const canvas = $('#atlas');
const overlayCanvas = $('#overview-overlay');
const animationCanvas = $('#animation-overlay');
const minimapCanvas = $('#minimap');
const frame = $('#map-frame');
const qualification = $('#qualification-result');
const badge = $('#runtime-badge');
const detailBadge = $('#detail-badge');
const inspector = $('#inspector-content');
const selectionBox = $('#selection-box');

let publication;
let semanticWorld;
let runtimeWorld;
let overviewWorld;
let pixelCatalog;
let runtimePixelCatalog;
let renderer;
let semanticStore;
let view;
let sceneTiles = new Map();
let sceneRecords = [];
let sceneGroups = [];
let visibleSceneGroups = [];
let selected = null;
let renderStats = null;
let lastSceneLoadMs = null;
let initialLoadMs = null;
let peakJsHeapBytes = 0;
let pixelNetworkBytes = 0;
let loadedPixelBundleBytes = 0;
let pixelTransport = 'stable-buckets';
let refreshTimer = null;
let refreshEpoch = 0;
let refreshAbortController = null;
let dragging = null;
let frameScheduler = null;
let animationRuntime = null;
let animationRuntimeError = null;
let animationHandle = null;
let animationLogicalMs = 0;
let animationWallMs = null;
let animationEpoch = 0;
let persistentCache = null;
let worldQuery = null;
let detailReady = false;
let detailStreaming = false;
const floorBundles = new Map();
const overviewCellsByFloor = new Map();
const overviewChunksByFloor = new Map();
const loadedBucketBytes = new Map();

function formatBytes(value) {
  if (value == null || !Number.isFinite(value)) return 'N/A';
  const units = ['B', 'KiB', 'MiB', 'GiB'];
  let amount = value;
  let index = 0;
  while (amount >= 1024 && index < units.length - 1) { amount /= 1024; index += 1; }
  return `${amount >= 100 || index === 0 ? amount.toFixed(0) : amount.toFixed(1)} ${units[index]}`;
}

function formatMs(value) {
  return value == null || !Number.isFinite(value) ? 'N/A' : `${value.toFixed(1)} ms`;
}

function escapeHtml(value) {
  return String(value).replace(/[&<>'"]/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[char]));
}

function sameObject(a, b) {
  return JSON.stringify(a) === JSON.stringify(b);
}

async function mapLimit(items, limit, mapper) {
  const results = new Array(items.length);
  let cursor = 0;
  async function worker() {
    while (true) {
      const index = cursor;
      cursor += 1;
      if (index >= items.length) return;
      results[index] = await mapper(items[index], index);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, () => worker()));
  return results;
}

function floorEntry(world, floor) {
  const entry = world.floors.find((candidate) => candidate.floor === floor);
  if (!entry) throw new Error(`floor ${floor} is absent from verified world`);
  return entry;
}

async function loadFloorBundle(floor) {
  if (floorBundles.has(floor)) return floorBundles.get(floor);
  const promise = (async () => {
    const semanticEntry = floorEntry(semanticWorld, floor);
    const runtimeEntry = floorEntry(runtimeWorld, floor);
    const overviewEntry = floorEntry(overviewWorld, floor);
    const [semanticFloor, runtimeFloor, overviewFloor] = await Promise.all([
      loadSemanticFloor(new URL(FULLWORLD_PATHS.publication, location.href), publication, semanticWorld, semanticEntry),
      loadRuntimeFloor(new URL(FULLWORLD_PATHS.runtimeIndex, location.href), runtimeWorld, runtimeEntry),
      loadOverviewFloor(new URL(FULLWORLD_PATHS.overview, location.href), overviewWorld, overviewEntry),
    ]);
    if (!sameObject(semanticFloor.bounds, runtimeFloor.bounds) || !sameObject(semanticFloor.bounds, overviewFloor.bounds)) throw new Error(`floor ${floor} bounds diverge across verified products`);
    if (runtimeFloor.sourceFloorRoot !== semanticFloor.rootContentId || overviewFloor.sourceFloorRoot !== semanticFloor.rootContentId) throw new Error(`floor ${floor} source-root linkage mismatch`);
    if (runtimeFloor.counts.tiles !== semanticFloor.counts.tiles || overviewFloor.counts.tiles !== semanticFloor.counts.tiles) throw new Error(`floor ${floor} tile count linkage mismatch`);
    return Object.freeze({ overviewFloor, runtimeFloor, semanticFloor });
  })();
  floorBundles.set(floor, promise);
  try { return await promise; } catch (error) { floorBundles.delete(floor); throw error; }
}

async function ensureOverviewCells(floor, bundle) {
  if (overviewCellsByFloor.has(floor)) return overviewCellsByFloor.get(floor);
  const chunks = await mapLimit(bundle.overviewFloor.chunks, OVERVIEW_CONCURRENCY, (entry) => loadOverviewChunk(new URL(FULLWORLD_PATHS.overview, location.href), overviewWorld, bundle.overviewFloor, entry));
  const cells = new Map();
  for (const chunk of chunks) for (const cell of chunk.cells) {
    const key = `${cell.cell_x}:${cell.cell_y}`;
    if (cells.has(key)) throw new Error(`duplicate overview cell ${floor}:${key}`);
    cells.set(key, cell);
  }
  if (cells.size !== bundle.overviewFloor.counts.cells) throw new Error(`overview cell count mismatch for floor ${floor}`);
  overviewCellsByFloor.set(floor, cells);
  overviewChunksByFloor.set(floor, chunks.length);
  return cells;
}

function renderLayerRail() {
  const container = $('#semantic-layer-list');
  container.textContent = '';
  for (const layer of FULLWORLD_CAPABILITIES.layers.filter((item) => item.id !== 'minimap-overview')) {
    const row = document.createElement('label');
    row.className = `layer disabled ${layer.status.toLowerCase()}`;
    const input = document.createElement('input');
    input.type = 'checkbox';
    input.disabled = true;
    const name = document.createElement('span');
    name.className = 'layer-name';
    name.textContent = layer.label;
    const status = document.createElement('span');
    status.textContent = layer.status;
    row.append(input, name, status);
    container.append(row);
  }
}

function populateFloors() {
  const select = $('#floor-select');
  select.textContent = '';
  for (const entry of [...runtimeWorld.floors].sort((a, b) => b.floor - a.floor)) {
    const option = document.createElement('option');
    option.value = String(entry.floor);
    option.textContent = `Floor ${entry.floor}`;
    select.append(option);
  }
}

function clampView(next) {
  const entry = floorEntry(runtimeWorld, next.floor);
  const bounds = entry.bounds;
  const floor = next.floor;
  const selectedState = next.selected && next.selected.floor === floor
    ? { floor, x: Math.trunc(next.selected.x), y: Math.trunc(next.selected.y) }
    : null;
  return Object.freeze({
    animation: next.animation === 'on' ? 'on' : 'off',
    debugFlags: Object.freeze([...(next.debugFlags ?? [])].sort()),
    floor,
    layers: Object.freeze(next.overview ? ['minimap-overview'] : []),
    mode: next.mode ?? 'auto',
    overview: Boolean(next.overview),
    searchQuery: String(next.searchQuery ?? '').trim().replace(/\s+/g, ' '),
    selected: selectedState,
    x: Math.round(Math.min(bounds.x_max_exclusive - 0.0001, Math.max(bounds.x_min, next.x)) * 10000) / 10000,
    y: Math.round(Math.min(bounds.y_max_exclusive - 0.0001, Math.max(bounds.y_min, next.y)) * 10000) / 10000,
    zoom: Math.round(Math.min(16, Math.max(0.125, next.zoom)) * 10000) / 10000,
  });
}

function publishView() {
  const snapshot = Object.freeze({ ...view });
  globalThis.__OTERYN_ATLAS_VIEW__ = snapshot;
  window.dispatchEvent(new CustomEvent('oteryn-atlas-view', { detail: { view: snapshot, detailReady, detailStreaming } }));
}

function syncViewUi({ preserveExternalParams = false } = {}) {
  $('#coord-x').textContent = view.x.toFixed(2).replace(/\.00$/, '');
  $('#coord-y').textContent = view.y.toFixed(2).replace(/\.00$/, '');
  $('#coord-floor').textContent = String(view.floor);
  $('#zoom-output').textContent = `${view.zoom.toFixed(2).replace(/0+$/, '').replace(/\.$/, '')}×`;
  $('#floor-select').value = String(view.floor);
  $('#overview-toggle').checked = view.overview;
  $('#animation-toggle').checked = view.animation === 'on';
  $('#search-input').value = view.searchQuery ?? '';
  for (const button of document.querySelectorAll('#view-mode-control [data-mode]')) button.classList.toggle('active', button.dataset.mode === view.mode);
  const bounds = floorEntry(runtimeWorld, view.floor).bounds;
  $('#floor-bounds').textContent = `Verified bounds: X ${bounds.x_min}…${bounds.x_max_exclusive - 1}, Y ${bounds.y_min}…${bounds.y_max_exclusive - 1}`;
  const floors = [...runtimeWorld.floors].map((entry) => entry.floor).sort((a, b) => b - a);
  const index = floors.indexOf(view.floor);
  $('#floor-up').disabled = index <= 0;
  $('#floor-down').disabled = index < 0 || index >= floors.length - 1;
  const serializedView = new URLSearchParams(serializeFullWorldViewState(view, runtimeWorld).replace(/^\?/, ''));
  if (preserveExternalParams) {
    const current = new URLSearchParams(location.search);
    for (const [key, value] of current) if (!serializedView.has(key)) serializedView.append(key, value);
  }
  history.replaceState(null, '', `?${serializedView.toString()}`);
  publishView();
}

function setBadge(text, state = '') {
  badge.textContent = text;
  badge.className = `runtime-badge ${state}`.trim();
}

function anchorBoundsForScene(bundle) {
  const rect = canvas.getBoundingClientRect();
  const overscan = runtimeWorld.visualBounds.overscanTiles;
  const correctnessMargin = Math.max(overscan.left, overscan.right, overscan.top, overscan.bottom);
  return viewportTileBounds(view, rect.width, rect.height, PREFETCH_TILES + correctnessMargin, bundle.runtimeFloor.bounds);
}

function viewportBounds(bundle) {
  const rect = canvas.getBoundingClientRect();
  return viewportTileBounds(view, rect.width, rect.height, 0, bundle.runtimeFloor.bounds);
}

function rendererRecords(records) {
  if (view?.animation !== 'on' || !animationRuntime) return records;
  return records.filter((record) => !animationRuntime.hasObject(record));
}
function setRendererRecords(records) { renderer.setRecords(rendererRecords(records)); }

function committedRendererAnchors() {
  const anchors = [];
  const seen = new Set();
  for (const record of sceneRecords) {
    const id = record.tileRecordId ?? `${record.floor}:${record.x}:${record.y}`;
    if (seen.has(id)) continue;
    seen.add(id);
    anchors.push({ id, floor: record.floor, x: record.x, y: record.y });
    if (anchors.length >= 24) break;
  }
  return anchors;
}

function commitRenderer() {
  const nextStats = renderer.render(view);
  renderStats = nextStats;
  const snapshot = createRendererDiagnosticSnapshot({
    generation: nextStats.generation,
    transform: nextStats.transform,
    backend: nextStats.backend,
    drawCalls: nextStats.drawCalls,
    visiblePrimitives: nextStats.visiblePrimitives,
    retainedPrimitives: sceneRecords.length,
    visibleChunks: uniqueChunkCount(visibleSceneGroups),
    retainedChunks: uniqueChunkCount(sceneGroups),
    visibleGroups: visibleSceneGroups.length,
    retainedGroups: sceneGroups.length,
    renderMs: nextStats.renderMs,
    gpuRenderMs: nextStats.gpuRenderMs,
    framebufferProbe: nextStats.framebufferProbe,
    anchors: committedRendererAnchors(),
  });
  globalThis.__OTERYN_ATLAS_RENDERER_DIAGNOSTICS__ = snapshot;
  window.dispatchEvent(new CustomEvent('oteryn-atlas-render-committed', { detail: snapshot }));
  return nextStats;
}
async function drawWorldAnimation(timeMs) {
  const epoch = ++animationEpoch;
  const rect = animationCanvas.getBoundingClientRect();
  const dpr = Math.max(1, Math.min(2, devicePixelRatio || 1));
  const width = Math.max(1, Math.round(rect.width * dpr));
  const height = Math.max(1, Math.round(rect.height * dpr));
  if (animationCanvas.width !== width || animationCanvas.height !== height) { animationCanvas.width = width; animationCanvas.height = height; }
  const ctx = animationCanvas.getContext('2d');
  animationCanvas.style.opacity = view?.animation === 'on' && animationRuntime ? '1' : '0';
  if (view?.animation !== 'on' || !animationRuntime) {
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, width, height);
    return;
  }
  const visible = sceneRecords.filter((record) => animationRuntime.hasObject(record));
  const frames = await Promise.all(visible.map(async (record) => {
    const frame = animationRuntime.objectFrame(record, timeMs);
    return frame ? [record, frame, await animationRuntime.bitmap(frame.contentId)] : null;
  }));
  if (epoch !== animationEpoch || view?.animation !== 'on') return;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, width, height);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.imageSmoothingEnabled = false;
  for (const item of frames) {
    if (!item) continue;
    const [record, frame, bitmap] = item; const primitive = record.primitive;
    const wx = record.x * 32 - (primitive.widthUnits - 32) + primitive.displacement.dxUnits;
    const wy = record.y * 32 - (primitive.heightUnits - 32) + primitive.displacement.dyUnits;
    const x = rect.width / 2 + (wx - view.x * 32) * view.zoom;
    const y = rect.height / 2 + (wy - view.y * 32) * view.zoom;
    ctx.drawImage(bitmap, x, y, bitmap.width * view.zoom, bitmap.height * view.zoom);
  }
  animationRuntime.noteFrameUpdate(frames.filter(Boolean).length);
}
function stopAnimationLoop() { if (animationHandle != null) cancelAnimationFrame(animationHandle); animationHandle = null; animationWallMs = null; }
function animationTick(now) {
  animationHandle = null;
  if (view?.animation !== 'on' || !animationRuntime || document.hidden) return;
  if (animationWallMs != null) animationLogicalMs += Math.max(0, now - animationWallMs);
  animationWallMs = now; drawWorldAnimation(animationLogicalMs).catch(failClosed);
  window.dispatchEvent(new CustomEvent('oteryn-atlas-animation-frame', { detail: { logicalTimeMs: animationLogicalMs, view: { ...view } } }));
  animationHandle = requestAnimationFrame(animationTick);
}
function syncAnimationLoop() {
  stopAnimationLoop(); setRendererRecords(sceneRecords);
  if (view?.animation === 'on' && animationRuntime && !document.hidden) animationHandle = requestAnimationFrame(animationTick);
  else drawWorldAnimation(0).catch(failClosed);
}

function renderFrame() {
  if (!renderer) return;
  try {
    commitRenderer();
    drawOverview().catch(failClosed);
    updateDiagnostics();
    updateSelectionBox();
  } catch (error) {
    failClosed(error);
  }
}

function scheduleRender(reason = 'view') {
  frameScheduler?.schedule(reason);
}

function scheduleRefresh(delay = 100) {
  clearTimeout(refreshTimer);
  refreshTimer = setTimeout(() => refreshScene().catch((error) => {
    if (error?.name !== 'AbortError') failClosed(error);
  }), delay);
}

function refreshIsCurrent(epoch, floor) {
  return epoch === refreshEpoch && view.floor === floor;
}

function progressiveRender(records, residentBuckets, epoch, floorAtStart, neededBucketCount) {
  if (!refreshIsCurrent(epoch, floorAtStart)) return;
  const readyRecords = recordsForResidentBuckets(records, pixelCatalog, runtimePixelCatalog, residentBuckets);
  sceneRecords = readyRecords;
  setRendererRecords(readyRecords);
  commitRenderer();
  $('#status-detail').textContent = `${sceneGroups.length} authenticated row ranges · ${sceneTiles.size.toLocaleString()} tiles · ${readyRecords.length.toLocaleString()}/${records.length.toLocaleString()} primitives · ${residentBuckets.size}/${neededBucketCount} pixel buckets`;
  drawOverview().catch(failClosed);
  updateDiagnostics();
  renderInspector();
  updateSelectionBox();
}

async function refreshScene() {
  refreshAbortController?.abort();
  const controller = new AbortController();
  refreshAbortController = controller;
  const epoch = ++refreshEpoch;
  const started = performance.now();
  const floorAtStart = view.floor;
  const bundle = await loadFloorBundle(floorAtStart);
  if (!refreshIsCurrent(epoch, floorAtStart)) return;
  await ensureOverviewCells(floorAtStart, bundle);
  if (!refreshIsCurrent(epoch, floorAtStart)) return;

  // Verified overview is intentionally painted before any semantic-range or
  // pixel-bucket dependency. A slow authenticated detail stream must never
  // leave the owner with an unexplained black canvas.
  commitRenderer();
  await drawOverview();
  updateDiagnostics();
  renderInspector();

  const wantsDetail = detailStreamWanted(view.zoom, detailStreaming, view.mode);
  detailStreaming = wantsDetail;
  if (!wantsDetail) {
    sceneTiles = new Map();
    sceneRecords = [];
    sceneGroups = [];
    visibleSceneGroups = [];
    setRendererRecords([]);
    commitRenderer();
    lastSceneLoadMs = performance.now() - started;
    if (initialLoadMs == null) initialLoadMs = performance.now() - bootStartedMs;
    detailReady = false;
    detailBadge.textContent = 'VISUAL MINIMAP LOD';
    detailBadge.classList.add('overview-only');
    $('#status-detail').textContent = view.mode === 'classic'
      ? 'Authenticated detail is paused by bounded LOD policy; verified classic palette preview remains active.'
      : 'Authenticated detail is paused by bounded LOD policy; verified visual minimap remains active.';
    setBadge('VERIFIED FULL-WORLD · WEBGL2', 'ok');
    await drawOverview();
    updateDiagnostics();
    renderInspector();
    publishQualification('PASS');
    return;
  }

  detailReady = false;
  detailBadge.textContent = 'AUTHENTICATED DETAIL STREAM';
  detailBadge.classList.remove('overview-only');
  setBadge('STREAMING VERIFIED RANGES');
  const retainBounds = anchorBoundsForScene(bundle);
  const visibleBounds = viewportBounds(bundle);
  visibleSceneGroups = selectRuntimeGroups(bundle.runtimeFloor, visibleBounds);
  sceneGroups = worldQuery.selectViewportGroups(bundle.runtimeFloor, visibleBounds, retainBounds, performanceProfile);
  $('#status-detail').textContent = `${sceneGroups.length} authenticated row ranges · loading semantic detail…`;
  updateDiagnostics();

  const groupedTiles = await mapLimit(sceneGroups, GROUP_CONCURRENCY, ({ chunk, group }) => semanticStore.loadGroup(floorAtStart, chunk, group, { signal: controller.signal }));
  if (!refreshIsCurrent(epoch, floorAtStart)) return;
  const tileMap = new Map();
  for (const tiles of groupedTiles) for (const tile of filterTilesForBounds(tiles, retainBounds)) {
    const key = `${tile.floor}:${tile.x}:${tile.y}`;
    if (tileMap.has(key)) throw new Error(`duplicate semantic tile in runtime scene: ${key}`);
    tileMap.set(key, tile);
  }
  sceneTiles = tileMap;
  renderInspector();

  const orderedTiles = [...tileMap.values()].sort((a, b) => a.y - b.y || a.x - b.x);
  const records = flattenRenderRecords(orderedTiles);
  const neededBuckets = requiredRuntimePixelBuckets(records, pixelCatalog, runtimePixelCatalog);
  if (records.length === 0) {
    sceneRecords = [];
    setRendererRecords([]);
    commitRenderer();
  } else if (performanceProfile.name === 'local-max' && renderer.uploadedBucketIds().length === 0) {
    $('#status-detail').textContent = `${sceneGroups.length} authenticated row ranges · ${sceneTiles.size.toLocaleString()} tiles · authenticating explicit local-max pixel bundle…`;
    updateDiagnostics();
    const bytes = await loadVerifiedPixelBundle(runtimePixelCatalog, fetch, {
      persistentCache,
      signal: controller.signal,
      onLoad: ({ source, bytes: loadedBytes }) => { if (source === 'network') pixelNetworkBytes += loadedBytes; },
    });
    if (!refreshIsCurrent(epoch, floorAtStart)) return;
    renderer.uploadBundle(bytes);
    loadedPixelBundleBytes = bytes.byteLength;
    pixelTransport = 'local-max-bundle';
  } else {
    const residentBuckets = new Set(renderer.uploadedBucketIds());
    const missingBuckets = neededBuckets.filter((bucketId) => !residentBuckets.has(bucketId));
    pixelTransport = 'stable-buckets';
    progressiveRender(records, residentBuckets, epoch, floorAtStart, neededBuckets.length);
    await mapLimit(missingBuckets, PIXEL_BUCKET_CONCURRENCY, async (bucketId) => {
      const bytes = await loadVerifiedPixelBucket(runtimePixelCatalog, bucketId, fetch, {
        persistentCache,
        signal: controller.signal,
        onLoad: ({ source, bytes: loadedBytes }) => { if (source === 'network') pixelNetworkBytes += loadedBytes; },
      });
      if (!refreshIsCurrent(epoch, floorAtStart)) return null;
      loadedBucketBytes.set(bucketId, bytes.byteLength);
      renderer.uploadBucket(bucketId, bytes);
      residentBuckets.add(bucketId);
      progressiveRender(records, residentBuckets, epoch, floorAtStart, neededBuckets.length);
      return bucketId;
    });
    if (!refreshIsCurrent(epoch, floorAtStart)) return;
  }

  sceneRecords = records;
  setRendererRecords(sceneRecords);
  detailReady = true;
  publishView();
  commitRenderer();
  if (renderStats.gpuTextureBytes > performanceProfile.gpuTextureBudgetBytes) throw new Error('GPU texture allocation exceeds runtime profile budget');
  if (renderStats.drawCalls > performanceProfile.drawCallTarget) throw new Error('draw-call target exceeded');
  lastSceneLoadMs = performance.now() - started;
  if (initialLoadMs == null) initialLoadMs = performance.now() - bootStartedMs;
  $('#status-detail').textContent = `${sceneGroups.length} authenticated row ranges · ${sceneTiles.size.toLocaleString()} retained tiles · ${sceneRecords.length.toLocaleString()} primitives`;
  setBadge('VERIFIED FULL-WORLD · WEBGL2', 'ok');
  await drawOverview();
  updateDiagnostics();
  renderInspector();
  publishQualification('PASS');
}

function resize2d(target) {
  const rect = target.getBoundingClientRect();
  const dpr = Math.max(1, Math.min(2, devicePixelRatio || 1));
  const width = Math.max(1, Math.round(rect.width * dpr));
  const height = Math.max(1, Math.round(rect.height * dpr));
  if (target.width !== width || target.height !== height) { target.width = width; target.height = height; }
  return { dpr, height, width };
}

async function drawOverview() {
  if (!runtimeWorld || !view) return;
  const bundle = await loadFloorBundle(view.floor);
  const cells = await ensureOverviewCells(view.floor, bundle);
  const size = overviewWorld.cellSizeTiles;
  const overlaySize = resize2d(overlayCanvas);
  const ctx = overlayCanvas.getContext('2d');
  ctx.clearRect(0, 0, overlaySize.width, overlaySize.height);
  overlayCanvas.hidden = !view.overview;
  if (view.overview) {
    const scale = 32 * view.zoom * overlaySize.dpr;
    const halfW = overlaySize.width / 2;
    const halfH = overlaySize.height / 2;
    ctx.fillStyle = 'rgba(75, 163, 255, 0.10)';
    ctx.strokeStyle = 'rgba(75, 163, 255, 0.22)';
    ctx.lineWidth = 1;
    for (const cell of cells.values()) {
      const x0 = halfW + (cell.cell_x * size - view.x) * scale;
      const y0 = halfH + (cell.cell_y * size - view.y) * scale;
      const extent = size * scale;
      if (x0 + extent < 0 || y0 + extent < 0 || x0 > overlaySize.width || y0 > overlaySize.height) continue;
      ctx.fillRect(x0, y0, extent, extent);
      if (extent >= 12) ctx.strokeRect(x0, y0, extent, extent);
    }
  }

  const miniSize = resize2d(minimapCanvas);
  const mini = minimapCanvas.getContext('2d');
  mini.clearRect(0, 0, miniSize.width, miniSize.height);
  mini.fillStyle = '#050a10';
  mini.fillRect(0, 0, miniSize.width, miniSize.height);
  if (!view.overview) return;
  const bounds = bundle.runtimeFloor.bounds;
  const scaleX = miniSize.width / (bounds.x_max_exclusive - bounds.x_min);
  const scaleY = miniSize.height / (bounds.y_max_exclusive - bounds.y_min);
  mini.fillStyle = 'rgba(97, 210, 161, 0.72)';
  for (const cell of cells.values()) {
    const x = (cell.cell_x * size - bounds.x_min) * scaleX;
    const y = (cell.cell_y * size - bounds.y_min) * scaleY;
    mini.fillRect(Math.floor(x), Math.floor(y), Math.max(1, Math.ceil(size * scaleX)), Math.max(1, Math.ceil(size * scaleY)));
  }
  const viewport = viewportBounds(bundle);
  mini.strokeStyle = 'rgba(114, 184, 255, 0.95)';
  mini.lineWidth = Math.max(1, miniSize.dpr);
  mini.strokeRect(
    (viewport.x_min - bounds.x_min) * scaleX,
    (viewport.y_min - bounds.y_min) * scaleY,
    (viewport.x_max_exclusive - viewport.x_min) * scaleX,
    (viewport.y_max_exclusive - viewport.y_min) * scaleY,
  );
}

function overviewFactAt(x, y) {
  const cells = overviewCellsByFloor.get(view.floor);
  if (!cells) return null;
  const size = overviewWorld.cellSizeTiles;
  return cells.get(`${Math.floor(x / size)}:${Math.floor(y / size)}`) ?? null;
}

function renderInspector() {
  if (!runtimeWorld || !publication) return;
  if (!selected) {
    $('#inspector-pill').textContent = 'ROOTS';
    $('#inspector-pill').className = 'pill ok';
    inspector.innerHTML = `
      <div class="position-card"><strong>${runtimeWorld.counts.floors} floors</strong><span>${runtimeWorld.counts.tiles.toLocaleString()} tiles</span></div>
      <dl class="facts compact">
        <dt>Game SHA</dt><dd><code>${escapeHtml(FULLWORLD_TRUST.gameSha)}</code></dd>
        <dt>Publication</dt><dd class="provenance-root">${escapeHtml(FULLWORLD_TRUST.publicationRoot)}</dd>
        <dt>Semantic</dt><dd class="provenance-root">${escapeHtml(FULLWORLD_TRUST.semanticRoot)}</dd>
        <dt>Pixels</dt><dd class="provenance-root">${escapeHtml(FULLWORLD_TRUST.pixelRoot)}</dd>
        <dt>Runtime index</dt><dd class="provenance-root">${escapeHtml(FULLWORLD_TRUST.runtimeIndexRoot)}</dd>
        <dt>Overview</dt><dd class="provenance-root">${escapeHtml(FULLWORLD_TRUST.overviewRoot)}</dd>
      </dl>
      <div class="notice-box"><strong>Authority:</strong> Oteryn/Oteryn-Game. Atlas is a derived read model; browser runtime never parses legacy world inputs.</div>
      <div class="notice-box limitation"><strong>Unavailable semantics stay off:</strong> named entities, towns, NPCs, monsters, transitions, houses, IDs, mechanics, raids, quest areas and POIs are not fabricated from pixels.</div>
    `;
    window.dispatchEvent(new CustomEvent('oteryn-atlas-inspector-rendered'));
    return;
  }
  const tile = sceneTiles.get(`${view.floor}:${selected.x}:${selected.y}`);
  const overviewCell = overviewFactAt(selected.x, selected.y);
  $('#inspector-pill').textContent = tile ? 'VERIFIED' : 'NO TILE';
  $('#inspector-pill').className = tile ? 'pill ok' : 'pill';
  let html = `<div class="position-card"><strong>${selected.x}, ${selected.y}</strong><span>floor ${view.floor}</span></div>`;
  if (!tile) html += '<p class="empty">No semantic tile record is present in the authenticated scene at this coordinate.</p>';
  else {
    html += `<dl class="facts compact">
      <dt>Tile record</dt><dd><code>${escapeHtml(tile.tileRecordId)}</code></dd>
      <dt>Stack records</dt><dd>${tile.presentations.length}</dd>
      <dt>Source chunk</dt><dd class="provenance-root">${escapeHtml(tile.provenance.sourceChunkContentId)}</dd>
      <dt>Range proof</dt><dd class="provenance-root">${escapeHtml(tile.provenance.authenticatedGroupContentId)}</dd>
    </dl>`;
    for (const presentation of tile.presentations) {
      html += `<article class="stack-entry"><div class="stack-head"><strong>${escapeHtml(presentation.role)}</strong><span>ORDER ${presentation.presentationOrder.order}</span></div><dl class="facts compact">
        <dt>Appearance source</dt><dd>${presentation.appearanceSourceId}</dd>
        <dt>Entity identity</dt><dd>${presentation.canonicalEntityId == null ? `${escapeHtml(presentation.identityState)} · no canonical ID` : escapeHtml(presentation.canonicalEntityId)}</dd>
        <dt>Sprite refs</dt><dd>${presentation.primitives.length ? presentation.primitives.map((primitive) => `<code>${primitive.spriteSourceId}</code>`).join(', ') : 'none published'}</dd>
        <dt>Presentation ID</dt><dd><code>${escapeHtml(presentation.recordId)}</code></dd>
      </dl></article>`;
    }
  }
  if (overviewCell) html += `<div class="overview-fact"><h2>Overview cell</h2><dl class="facts compact"><dt>Published tiles</dt><dd>${overviewCell.tiles}</dd><dt>Resolved primitives</dt><dd>${overviewCell.resolvedPrimitives}</dd><dt>Meaning</dt><dd>tile-presence density only</dd></dl></div>`;
  inspector.innerHTML = html;
  window.dispatchEvent(new CustomEvent('oteryn-atlas-inspector-rendered'));
}

function updateSelectionBox() {
  if (!selected || !view) { selectionBox.hidden = true; return; }
  const rect = canvas.getBoundingClientRect();
  const scale = 32 * view.zoom;
  const x = rect.width / 2 + (selected.x - view.x) * scale;
  const y = rect.height / 2 + (selected.y - view.y) * scale;
  selectionBox.hidden = false;
  selectionBox.style.left = `${x}px`;
  selectionBox.style.top = `${y}px`;
  selectionBox.style.width = `${Math.max(2, scale)}px`;
  selectionBox.style.height = `${Math.max(2, scale)}px`;
}

function uniqueChunkCount(groups) {
  return new Set(groups.map(({ chunk }) => {
    const logical = chunk.logicalAddress;
    return `${logical.floor}:${logical.region_x}:${logical.region_y}`;
  })).size;
}

function cacheHitRatio(store) {
  if (!store) return null;
  const attempts = store.cacheHits + store.cacheMisses;
  return attempts > 0 ? store.cacheHits / attempts : null;
}

function sampleHeap() {
  const heap = performance.memory?.usedJSHeapSize ?? null;
  if (Number.isFinite(heap)) peakJsHeapBytes = Math.max(peakJsHeapBytes, heap);
  return heap;
}

function updateDiagnostics() {
  if (!runtimeWorld) return;
  const store = semanticStore?.stats();
  const heap = sampleHeap();
  const visibleChunks = uniqueChunkCount(visibleSceneGroups);
  const retainedChunks = uniqueChunkCount(sceneGroups);
  const ratio = cacheHitRatio(store);
  $('#diag-backend').textContent = `${renderStats?.backend ?? 'WebGL2'} · ${performanceProfile.name}`;
  $('#diag-chunks').textContent = `${visibleChunks} visible · ${retainedChunks}/${performanceProfile.maxLoadedChunks} retained`;
  $('#diag-groups').textContent = `${visibleSceneGroups.length} visible · ${sceneGroups.length}/${performanceProfile.maxLoadedGroups} retained`;
  $('#diag-cache').textContent = store ? `${store.cachedGroups} · ${formatBytes(store.cacheBytes)} · ${ratio == null ? 'N/A' : `${(ratio * 100).toFixed(1)}%`} hit ratio` : '—';
  $('#diag-packs').textContent = renderStats ? `${renderStats.uploadedBuckets} / ${runtimePixelCatalog.buckets.size}` : `0 / ${runtimePixelCatalog?.buckets?.size ?? 0}`;
  $('#diag-gpu').textContent = renderStats ? `${formatBytes(renderStats.gpuTextureBytes)} / ${formatBytes(performanceProfile.gpuTextureBudgetBytes)} allocated` : '—';
  $('#diag-primitives').textContent = (renderStats?.visiblePrimitives ?? renderStats?.submittedPrimitives)?.toLocaleString() ?? '—';
  $('#diag-draws').textContent = renderStats ? `${renderStats.drawCalls} / ${performanceProfile.drawCallTarget}` : '—';
  $('#diag-render').textContent = renderStats ? `${formatMs(renderStats.renderMs)} CPU${renderStats.gpuRenderMs == null ? '' : ` · ${formatMs(renderStats.gpuRenderMs)} GPU`}` : '—';
  $('#diag-heap').textContent = heap == null ? 'N/A' : `${formatBytes(heap)} · peak ${formatBytes(peakJsHeapBytes)}`;
  $('#status-source').textContent = `Publication ${FULLWORLD_TRUST.publicationRoot.slice(0, 19)}… · Game ${FULLWORLD_TRUST.gameSha.slice(0, 10)}…`;
  $('#status-layer').textContent = view.overview ? `Overview PROVEN · ${overviewCellsByFloor.get(view.floor)?.size?.toLocaleString() ?? '…'} cells` : 'Overview OFF';
}

function publishQualification(status, error = null) {
  const store = semanticStore?.stats();
  const heap = sampleHeap();
  const ratio = cacheHitRatio(store);
  const visibleChunkCount = uniqueChunkCount(visibleSceneGroups);
  const retainedChunkCount = uniqueChunkCount(sceneGroups);
  const result = {
    status,
    classification: 'G5_BROWSER_QUALIFICATION_NOT_PRODUCTION_SLO',
    identities: {
      gameSha: FULLWORLD_TRUST.gameSha,
      overviewRoot: FULLWORLD_TRUST.overviewRoot,
      pixelRoot: FULLWORLD_TRUST.pixelRoot,
      pixelBucketRoot: FULLWORLD_TRUST.pixelBucketRoot,
      publicationRoot: FULLWORLD_TRUST.publicationRoot,
      runtimeIndexRoot: FULLWORLD_TRUST.runtimeIndexRoot,
      semanticRoot: FULLWORLD_TRUST.semanticRoot,
    },
    view: view ? { ...view } : null,
    worldCounts: runtimeWorld?.counts ?? null,
    performanceProfile: profileSummary(performanceProfile),
    frameScheduler: frameScheduler?.stats?.() ?? null,
    persistentCache: persistentCache?.stats?.() ?? null,
    measured: renderStats ? {
      initialLoadMs,
      chunkLoadingLatencyMs: lastSceneLoadMs,
      drawCalls: renderStats.drawCalls,
      drawCallTarget: performanceProfile.drawCallTarget,
      gpuRenderMs: renderStats.gpuRenderMs,
      gpuTimerSupported: renderStats.gpuTimerSupported,
      gpuMemoryBytes: null,
      gpuMemoryReason: 'WebGL2 does not expose trustworthy resident GPU memory accounting; allocated texture bytes are reported separately.',
      gpuTextureAllocatedBytes: renderStats.gpuTextureBytes,
      gpuTextureBudgetBytes: performanceProfile.gpuTextureBudgetBytes,
      instanceBufferBytes: renderStats.instanceBufferBytes,
      jsHeapBytes: heap,
      peakJsHeapBytes: peakJsHeapBytes || null,
      browserRamBytes: null,
      browserRamReason: 'Browser process RSS is not exposed by page APIs; qualification harness may record external process metrics separately.',
      animationOnOffDeltaMs: null,
      animationOnOffDeltaReason: FULLWORLD_CAPABILITIES.animation.enabled ? null : FULLWORLD_CAPABILITIES.animation.reason,
      visibleChunkCount,
      retainedChunkCount,
      visibleRangeGroups: visibleSceneGroups.length,
      retainedRangeGroups: sceneGroups.length,
      maxLoadedChunks: performanceProfile.maxLoadedChunks,
      maxLoadedGroups: performanceProfile.maxLoadedGroups,
      cacheHitRatio: ratio,
      loadedOverviewCells: overviewCellsByFloor.get(view.floor)?.size ?? 0,
      loadedOverviewChunks: overviewChunksByFloor.get(view.floor) ?? 0,
      loadedPixelBucketBytes: [...loadedBucketBytes.values()].reduce((sum, value) => sum + value, 0),
      loadedPixelBundleBytes,
      pixelTransport,
      loadedPixelBuckets: renderStats.uploadedBuckets,
      residentPixelBytes: renderStats.residentPixelBytes,
      pixelNetworkBytes,
      rangeAuthenticatedBytes: store?.networkBytes ?? 0,
      rangeCacheBytes: store?.cacheBytes ?? 0,
      rangeRequests: store?.rangeRequests ?? 0,
      rangeCacheHits: store?.cacheHits ?? 0,
      rangeCacheMisses: store?.cacheMisses ?? 0,
      rangePersistentHits: store?.persistentHits ?? 0,
      retainedPrimitives: sceneRecords.length,
      retainedTiles: sceneTiles.size,
      submittedPrimitives: renderStats.submittedPrimitives,
      textureUploadMs: renderStats.textureUploadMs,
      visiblePrimitives: renderStats.visiblePrimitives,
      webglMaxArrayLayers: renderStats.maxArrayLayers,
      webglMaxTextureSize: renderStats.maxTextureSize,
      webglRenderMs: renderStats.renderMs,
    } : null,
    capabilities: {
      animation: FULLWORLD_CAPABILITIES.animation,
      enabledLayers: FULLWORLD_CAPABILITIES.layers.filter((layer) => layer.enabled).map((layer) => layer.id),
      blockedOrUnknownEnabled: FULLWORLD_CAPABILITIES.layers.some((layer) => layer.enabled && layer.status !== 'PROVEN'),
    },
    error: error ? String(error.message ?? error) : null,
  };
  qualification.dataset.status = status;
  qualification.textContent = JSON.stringify(result);
  globalThis.__OTERYN_ATLAS_FULLWORLD__ = result;
}

function failClosed(error) {
  console.error(error);
  setBadge('FAIL-CLOSED', 'error');
  detailBadge.textContent = 'RUNTIME BLOCKED';
  $('#status-detail').textContent = error.message ?? String(error);
  inspector.innerHTML = `<div class="notice-box error-box"><strong>Verified runtime stopped.</strong><br>${escapeHtml(error.message ?? error)}</div>`;
  publishQualification('FAIL', error);
}

function pointerWorld(event) {
  const rect = canvas.getBoundingClientRect();
  return {
    x: view.x + (event.clientX - rect.left - rect.width / 2) / (32 * view.zoom),
    y: view.y + (event.clientY - rect.top - rect.height / 2) / (32 * view.zoom),
  };
}

function applyView(next, options = {}) {
  const previousFloor = view?.floor;
  view = clampView(next);
  selected = view.selected ? { x: view.selected.x, y: view.selected.y } : null;
  if (previousFloor != null && previousFloor !== view.floor) {
    semanticStore.clearForFloorChange();
    sceneTiles = new Map();
    sceneRecords = [];
    sceneGroups = [];
    visibleSceneGroups = [];
    selected = null;
    setRendererRecords([]);
  }
  syncViewUi();
  syncAnimationLoop();
  scheduleRender('view');
  renderInspector();
  scheduleRefresh(options.delay ?? 80);
}

function wireInteraction() {
  for (const button of document.querySelectorAll('#view-mode-control [data-mode]')) button.addEventListener('click', () => {
    const mode = button.dataset.mode;
    const zoom = mode === 'map' && view.zoom < LOD_POLICY.detailZoom ? LOD_POLICY.detailZoom : view.zoom;
    applyView({ ...view, mode, zoom }, { delay: 0 });
  });
  $('#zoom-in').addEventListener('click', () => applyView({ ...view, zoom: view.zoom * 1.25 }));
  $('#zoom-out').addEventListener('click', () => applyView({ ...view, zoom: view.zoom / 1.25 }));
  $('#overview-toggle').addEventListener('change', (event) => applyView({ ...view, overview: event.target.checked }, { delay: 0 }));
  $('#animation-toggle').addEventListener('change', (event) => applyView({ ...view, animation: event.target.checked ? 'on' : 'off' }, { delay: 0 }));
  $('#floor-select').addEventListener('change', (event) => applyView(changeFloor(view, Number(event.target.value), runtimeWorld), { delay: 0 }));
  const orderedFloors = () => [...runtimeWorld.floors].map((entry) => entry.floor).sort((a, b) => b - a);
  $('#floor-up').addEventListener('click', () => {
    const floors = orderedFloors(); const index = floors.indexOf(view.floor); if (index > 0) applyView(changeFloor(view, floors[index - 1], runtimeWorld), { delay: 0 });
  });
  $('#floor-down').addEventListener('click', () => {
    const floors = orderedFloors(); const index = floors.indexOf(view.floor); if (index >= 0 && index < floors.length - 1) applyView(changeFloor(view, floors[index + 1], runtimeWorld), { delay: 0 });
  });
  $('#search-form').addEventListener('submit', (event) => {
    event.preventDefault();
    try {
      const query = $('#search-input').value;
      const result = parseCoordinateSearch(query, view.floor, runtimeWorld);
      applyView({ ...view, ...result, searchQuery: query, selected: { floor: result.floor, x: Math.floor(result.x), y: Math.floor(result.y) } }, { delay: 0 });
    } catch (error) { $('#status-detail').textContent = `Search: ${error.message}`; }
  });

  canvas.addEventListener('wheel', (event) => {
    event.preventDefault();
    const before = pointerWorld(event);
    const factor = event.deltaY < 0 ? 1.12 : 1 / 1.12;
    const nextZoom = Math.min(16, Math.max(0.125, view.zoom * factor));
    const rect = canvas.getBoundingClientRect();
    const nextX = before.x - (event.clientX - rect.left - rect.width / 2) / (32 * nextZoom);
    const nextY = before.y - (event.clientY - rect.top - rect.height / 2) / (32 * nextZoom);
    applyView({ ...view, x: nextX, y: nextY, zoom: nextZoom }, { delay: 120 });
  }, { passive: false });

  canvas.addEventListener('pointerdown', (event) => {
    canvas.setPointerCapture(event.pointerId);
    dragging = { pointerId: event.pointerId, startClientX: event.clientX, startClientY: event.clientY, startX: view.x, startY: view.y, moved: false };
    canvas.classList.add('dragging');
  });
  canvas.addEventListener('pointermove', (event) => {
    const point = pointerWorld(event);
    $('#cursor-coordinate').textContent = `X ${Math.floor(point.x)} · Y ${Math.floor(point.y)} · F ${view.floor}`;
    if (!dragging || dragging.pointerId !== event.pointerId) return;
    const dx = event.clientX - dragging.startClientX;
    const dy = event.clientY - dragging.startClientY;
    if (Math.abs(dx) + Math.abs(dy) > 3) dragging.moved = true;
    view = clampView({ ...view, x: dragging.startX - dx / (32 * view.zoom), y: dragging.startY - dy / (32 * view.zoom) });
    syncViewUi();
    scheduleRender('drag');
    scheduleRefresh(140);
  });
  canvas.addEventListener('pointerup', (event) => {
    if (!dragging || dragging.pointerId !== event.pointerId) return;
    const wasMoved = dragging.moved;
    dragging = null;
    canvas.classList.remove('dragging');
    if (!wasMoved) {
      const point = pointerWorld(event);
      const blend = lodBlend(view.zoom, view.mode, detailReady);
      const target = { floor: view.floor, x: Math.floor(point.x), y: Math.floor(point.y) };
      view = clampView(blend.minimap >= 0.5 ? { ...view, x: point.x, y: point.y, selected: target } : { ...view, selected: target });
      selected = view.selected ? { x: view.selected.x, y: view.selected.y } : null;
      syncViewUi();
      renderInspector();
      updateSelectionBox();
    }
    scheduleRefresh(0);
  });
  canvas.addEventListener('pointercancel', () => { dragging = null; canvas.classList.remove('dragging'); });
  window.addEventListener('resize', () => { scheduleRender('resize'); scheduleRefresh(100); if (view?.animation === 'on') drawWorldAnimation(animationLogicalMs).catch(failClosed); });
  document.addEventListener('visibilitychange', syncAnimationLoop);
}

async function chooseInitialPublishedView(initialView) {
  const params = new URLSearchParams(location.search);
  if (params.has('x') || params.has('y')) return initialView;
  const bundle = await loadFloorBundle(initialView.floor);
  const cells = await ensureOverviewCells(initialView.floor, bundle);
  let best = null;
  for (const cell of cells.values()) {
    if (!best || cell.tiles > best.tiles || (cell.tiles === best.tiles && (cell.cell_y < best.cell_y || (cell.cell_y === best.cell_y && cell.cell_x < best.cell_x)))) best = cell;
  }
  if (!best) return initialView;
  const size = overviewWorld.cellSizeTiles;
  return clampView({
    ...initialView,
    x: best.cell_x * size + size / 2,
    y: best.cell_y * size + size / 2,
    selected: null,
  });
}

async function boot() {
  renderLayerRail();
  $('#animation-note').textContent = FULLWORLD_CAPABILITIES.animation.reason;
  const publicationBase = new URL(FULLWORLD_PATHS.publication, location.href);
  const runtimeBase = new URL(FULLWORLD_PATHS.runtimeIndex, location.href);
  const overviewBase = new URL(FULLWORLD_PATHS.overview, location.href);
  const pixelBucketBase = new URL(FULLWORLD_PATHS.pixelBuckets, location.href);
  const animationBase = new URL(FULLWORLD_PATHS.animation, location.href);
  try { animationRuntime = await getAnimationRuntime(animationBase); }
  catch (error) { animationRuntimeError = error; animationRuntime = null; }
  $('#animation-toggle').disabled = !animationRuntime;
  if (animationRuntimeError) $('#animation-note').textContent = `Static fallback: ${animationRuntimeError.message}`;
  publication = await loadFullWorldPublication(publicationBase, FULLWORLD_TRUST);
  [semanticWorld, runtimeWorld, pixelCatalog, runtimePixelCatalog, overviewWorld] = await Promise.all([
    loadSemanticWorld(publicationBase, publication, FULLWORLD_TRUST),
    loadRuntimeWorld(runtimeBase, FULLWORLD_TRUST),
    loadFullWorldPixelCatalog(publicationBase, publication, FULLWORLD_TRUST),
    loadRuntimePixelBuckets(pixelBucketBase, FULLWORLD_TRUST),
    loadOverviewWorld(new URL('world.json', overviewBase), { rootContentId: FULLWORLD_TRUST.overviewRoot, sourcePublicationRoot: FULLWORLD_TRUST.publicationRoot }),
  ]);
  if (runtimePixelCatalog.manifest.counts.blobs !== pixelCatalog.blobs.size || runtimePixelCatalog.manifest.counts.bytes !== pixelCatalog.manifest.counts.rawBytesAfterDedupe) throw new Error('runtime pixel bucket/canonical pixel census mismatch');
  if (runtimeWorld.counts.floors !== semanticWorld.counts.floors || runtimeWorld.counts.shards !== semanticWorld.counts.shards || runtimeWorld.counts.tiles !== semanticWorld.counts.tiles || runtimeWorld.counts.resolvedPrimitives !== semanticWorld.counts.resolvedPrimitives) throw new Error('runtime index/world publication census mismatch');
  if (overviewWorld.counts.floors !== semanticWorld.counts.floors || overviewWorld.counts.chunks !== semanticWorld.counts.shards || overviewWorld.counts.tiles !== semanticWorld.counts.tiles || overviewWorld.counts.resolvedPrimitives !== semanticWorld.counts.resolvedPrimitives) throw new Error('overview/world publication census mismatch');
  worldQuery = createWorldQueryApi(runtimeWorld, FULLWORLD_CAPABILITIES);
  populateFloors();
  view = parseFullWorldViewState(location.search, runtimeWorld);
  if (!animationRuntime && view.animation === 'on') view = Object.freeze({ ...view, animation: 'off' });
  view = await chooseInitialPublishedView(view);
  selected = view.selected ? { x: view.selected.x, y: view.selected.y } : null;
  const semanticBase = new URL('./', new URL(publication.semantic.path, publicationBase));
  persistentCache = new VerifiedContentCache({ enabled: true, maxEntryBytes: 96 * 1024 * 1024 });
  semanticStore = new SemanticRangeStore(semanticBase, runtimeWorld, {
    cacheByteBudget: performanceProfile.semanticCacheBytes,
    persistentCache,
  });
  renderer = createFullWorldWebGLRenderer(canvas, pixelCatalog, runtimePixelCatalog, {
    capture: performanceProfile.capture,
    synchronousEvidence: performanceProfile.synchronousEvidence,
    measureVisibility: performanceProfile.measureVisibility,
    gpuTiming: true,
    gpuTextureBudgetBytes: performanceProfile.gpuTextureBudgetBytes,
  });
  frameScheduler = createFrameScheduler(renderFrame);
  syncAnimationLoop();
  $('#status-detail').textContent = `Performance profile ${performanceProfile.name} · ${GROUP_CONCURRENCY} semantic / ${PIXEL_BUCKET_CONCURRENCY} pixel fetchers · ${formatBytes(performanceProfile.semanticCacheBytes)} semantic cache`;
  syncViewUi({ preserveExternalParams: true });
  wireInteraction();
  renderInspector();
  try {
    await refreshScene();
  } catch (error) {
    if (error?.name !== 'AbortError') throw error;
  }
}

await boot().catch(failClosed);
