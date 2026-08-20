import './fullworld-creatures.mjs';
import { viewportTileBounds } from '../src/browser/fullworld.mjs';
import { FULLWORLD_PATHS, FULLWORLD_TRUST } from '../src/browser/fullworld-trust.mjs';
import { lodBlend } from '../src/layers/minimap-lod.mjs';
import { loadMinimapFloor, loadMinimapWorld, loadVerifiedMinimapTile, selectMinimapChunks } from '../src/layers/minimap.mjs';

const canvas = document.querySelector('#minimap-layer');
const detailCanvas = document.querySelector('#atlas');
const badge = document.querySelector('#detail-badge');
const status = document.querySelector('#status-detail');
const floorCache = new Map();
const imageCache = new Map();
const MAX_IMAGES = 64;
let world = null;
let lastDetail = null;
let epoch = 0;
let transferredBytes = 0;
let tileRequests = 0;
let firstUsefulPaintMs = null;
const started = performance.now();
const minimapBase = new URL(FULLWORLD_PATHS.minimap, location.href);

function resize() {
  const dpr = Math.min(devicePixelRatio || 1, 2);
  const width = Math.max(1, Math.floor(canvas.clientWidth * dpr));
  const height = Math.max(1, Math.floor(canvas.clientHeight * dpr));
  if (canvas.width !== width || canvas.height !== height) { canvas.width = width; canvas.height = height; }
  return { dpr, width: canvas.clientWidth, height: canvas.clientHeight };
}
async function decodePng(bytes) {
  const blob = new Blob([bytes], { type: 'image/png' });
  return createImageBitmap(blob, { premultiplyAlpha: 'default', colorSpaceConversion: 'default' });
}

function rememberImage(key, image) {
  if (imageCache.has(key)) imageCache.delete(key);
  imageCache.set(key, image);
  while (imageCache.size > MAX_IMAGES) {
    const oldest = imageCache.keys().next().value;
    imageCache.get(oldest)?.close?.();
    imageCache.delete(oldest);
  }
}

async function imageFor(entry) {
  const cached = imageCache.get(entry.contentId);
  if (cached) { imageCache.delete(entry.contentId); imageCache.set(entry.contentId, cached); return cached; }
  const image = await loadVerifiedMinimapTile(minimapBase, entry, async (...args) => {
    const response = await fetch(...args);
    const clone = response.clone();
    const bytes = new Uint8Array(await clone.arrayBuffer());
    transferredBytes += bytes.byteLength; tileRequests += 1;
    return response;
  }, decodePng);
  rememberImage(entry.contentId, image);
  return image;
}
async function floorFor(floor) {
  if (floorCache.has(floor)) return floorCache.get(floor);
  const entry = world.floors.find((candidate) => candidate.floor === floor);
  if (!entry) throw new Error(`minimap floor ${floor} is not published`);
  const loaded = await loadMinimapFloor(minimapBase, world, entry);
  floorCache.set(floor, loaded);
  return loaded;
}

function publish(state = {}) {
  globalThis.__OTERYN_ATLAS_MINIMAP__ = Object.freeze({
    status: state.error ? 'FAIL' : (state.ready ? 'PASS' : 'LOADING'),
    rootContentId: world?.rootContentId ?? null,
    floor: lastDetail?.view?.floor ?? null,
    mode: lastDetail?.view?.mode ?? null,
    representation: state.representation ?? null,
    visibleChunks: state.visibleChunks ?? 0,
    loadedImages: imageCache.size,
    transferredBytes,
    tileRequests,
    firstUsefulPaintMs,
    error: state.error ? String(state.error.message ?? state.error) : null,
  });
}

async function render(detail) {
  lastDetail = detail;
  const localEpoch = ++epoch;
  if (!world || !detail?.view) return;
  const { view, detailReady } = detail;
  const blend = lodBlend(view.zoom, view.mode, detailReady);
  canvas.style.opacity = String(blend.minimap);
  detailCanvas.style.opacity = String(blend.detail);
  badge.dataset.lod = blend.representation;
  if (blend.minimap <= 0) { publish({ ready: true, representation: blend.representation }); return; }
  try {
    const floor = await floorFor(view.floor);
    if (localEpoch !== epoch) return;
    const size = resize();
    const bounds = viewportTileBounds(view, size.width, size.height, 1, floor.bounds);
    const entries = selectMinimapChunks(floor, bounds);
    const images = await Promise.all(entries.map(async (entry) => [entry, await imageFor(entry)]));
    if (localEpoch !== epoch) return;
    const ctx = canvas.getContext('2d', { alpha: true });
    ctx.setTransform(size.dpr, 0, 0, size.dpr, 0, 0);
    ctx.clearRect(0, 0, size.width, size.height);
    ctx.imageSmoothingEnabled = false;
    const scale = 32 * view.zoom;
    for (const [entry, image] of images) {
      const x0 = entry.logicalAddress.region_x * floor.regionSpan;
      const y0 = entry.logicalAddress.region_y * floor.regionSpan;
      const x = size.width / 2 + (x0 - view.x) * scale;
      const y = size.height / 2 + (y0 - view.y) * scale;
      ctx.drawImage(image, x, y, floor.regionSpan * scale, floor.regionSpan * scale);
    }
    if (firstUsefulPaintMs == null && images.length > 0) firstUsefulPaintMs = performance.now() - started;
    status.textContent = blend.representation === 'transition'
      ? `Smooth minimap/detail transition · ${entries.length} bounded minimap tiles`
      : `Verified visual minimap · ${entries.length} bounded tiles`;
    publish({ ready: images.length > 0, representation: blend.representation, visibleChunks: entries.length });
  } catch (error) {
    publish({ error, representation: blend.representation });
    console.error(error);
  }
}
async function boot() {
  publish();
  world = await loadMinimapWorld(minimapBase, {
    rootContentId: FULLWORLD_TRUST.minimapRoot,
    publicationRoot: FULLWORLD_TRUST.publicationRoot,
    pixelRoot: FULLWORLD_TRUST.pixelRoot,
  });
  publish();
  if (lastDetail) await render(lastDetail);
}

window.addEventListener('oteryn-atlas-view', (event) => { render(event.detail); });
window.addEventListener('resize', () => { if (lastDetail) render(lastDetail); });
boot().catch((error) => { publish({ error }); console.error(error); });
