import { cameraItinerary, decodeCompactTile, inspectTile, parseViewState, serializeViewState } from '../src/browser/semantic.mjs';
import { loadChunk, loadManifest } from '../src/browser/loader.mjs';
import { loadPixelStore } from '../src/browser/pixels.mjs';
import { createWebGLRenderer } from '../src/browser/webgl.mjs';

const canvas = document.querySelector('#atlas');
const selectionBox = document.querySelector('#selection-box');
const runtimeBadge = document.querySelector('#runtime-badge');
const inspectorState = document.querySelector('#inspector-state');
const inspectorContent = document.querySelector('#inspector-content');
const cursorCoordinate = document.querySelector('#cursor-coordinate');

const fields = {
  x: document.querySelector('#coord-x'),
  y: document.querySelector('#coord-y'),
  floor: document.querySelector('#coord-floor'),
  zoom: document.querySelector('#zoom-value'),
  backend: document.querySelector('#diag-backend'),
  chunks: document.querySelector('#diag-chunks'),
  visible: document.querySelector('#diag-visible'),
  draws: document.querySelector('#diag-draws'),
  pack: document.querySelector('#diag-pack'),
  texture: document.querySelector('#diag-texture'),
  verify: document.querySelector('#diag-verify'),
  render: document.querySelector('#diag-render'),
};

let view = parseViewState(location.search);
let semanticManifest = null;
let pixelStore = null;
let renderer = null;
let semanticTiles = new Map();
let renderRecords = [];
let selected = null;
let activeTab = 'tile';
let drag = null;
let semanticLoadMs = 0;
let pixelVerifyMs = 0;

function tileKey(x, y, floor = -7) {
  return `${floor}:${x}:${y}`;
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
}

function formatBytes(value) {
  if (!Number.isFinite(value)) return '—';
  if (value < 1024) return `${value} B`;
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KiB`;
  return `${(value / (1024 * 1024)).toFixed(2)} MiB`;
}

function updateViewFields(candidate = view) {
  fields.x.textContent = Number(candidate.x).toFixed(Number.isInteger(candidate.x) ? 0 : 2);
  fields.y.textContent = Number(candidate.y).toFixed(Number.isInteger(candidate.y) ? 0 : 2);
  fields.floor.textContent = String(candidate.floor).replace('-', '−');
  fields.zoom.textContent = `${Number(candidate.zoom).toFixed(candidate.zoom < 1 ? 2 : 1)}×`;
}

function selectionScreenRect(candidate = view) {
  if (!selected) return null;
  const rect = canvas.getBoundingClientRect();
  const tilePixels = 32 * candidate.zoom;
  return {
    left: rect.width / 2 + (selected.x - candidate.x) * tilePixels,
    top: rect.height / 2 + (selected.y - candidate.y) * tilePixels,
    size: tilePixels,
  };
}

function updateSelectionBox(candidate = view) {
  const box = selectionScreenRect(candidate);
  if (!box || box.size < 2) {
    selectionBox.hidden = true;
    return;
  }
  selectionBox.hidden = false;
  selectionBox.style.left = `${box.left}px`;
  selectionBox.style.top = `${box.top}px`;
  selectionBox.style.width = `${box.size}px`;
  selectionBox.style.height = `${box.size}px`;
}

function renderInspector() {
  if (!selected) {
    inspectorState.textContent = 'NO SELECTION';
    inspectorContent.innerHTML = '<p class="empty">Click a factual semantic tile in the map.</p>';
    return;
  }
  const tile = semanticTiles.get(tileKey(selected.x, selected.y));
  if (!tile) {
    inspectorState.textContent = 'NO TILE RECORD';
    inspectorContent.innerHTML = `<p class="empty">No semantic tile record at ${selected.x}, ${selected.y}, floor −7.</p>`;
    return;
  }
  const data = inspectTile(tile);
  inspectorState.textContent = `${data.stack.length} RECORD${data.stack.length === 1 ? '' : 'S'}`;
  if (activeTab === 'provenance') {
    inspectorContent.innerHTML = `
      <dl class="facts">
        <dt>Game artifact</dt><dd><code>${escapeHtml(data.provenance.sourceArtifact)}</code></dd>
        <dt>Coordinate profile</dt><dd>${escapeHtml(data.provenance.coordinateProfile)}</dd>
        <dt>Appearance profile</dt><dd>${escapeHtml(data.provenance.appearanceProfile)}</dd>
        <dt>Pixel root</dt><dd><code>${escapeHtml(pixelStore?.manifest.rootContentId ?? 'UNKNOWN')}</code></dd>
        <dt>Pixel pack SHA-256</dt><dd><code>${escapeHtml(pixelStore?.manifest.pack.sha256 ?? 'UNKNOWN')}</code></dd>
        <dt>Tile record</dt><dd><code>${escapeHtml(data.tileRecordId)}</code></dd>
      </dl>`;
    return;
  }
  const stack = data.stack.map((entry) => `
    <article class="stack-entry">
      <div class="stack-head"><strong>#${entry.presentationOrder.order} · ${escapeHtml(entry.role)}</strong><span>${entry.identityState}</span></div>
      <dl class="facts compact">
        <dt>Appearance source</dt><dd>${entry.appearanceSourceId}</dd>
        <dt>Sprite source IDs</dt><dd>${entry.spriteSourceIds.join(', ')}</dd>
        <dt>Primitive count</dt><dd>${entry.primitiveCount}</dd>
        <dt>Canonical entity</dt><dd>UNKNOWN</dd>
      </dl>
    </article>`).join('');
  inspectorContent.innerHTML = `<div class="position-card"><strong>${data.worldPosition.x}, ${data.worldPosition.y}</strong><span>floor −7</span></div>${stack}`;
}
function updateDiagnostics(stats) {
  if (!stats) return;
  fields.backend.textContent = stats.backend;
  fields.chunks.textContent = `${semanticManifest?.chunks.length ?? 0} / ${semanticManifest?.chunks.length ?? 0}`;
  fields.visible.textContent = String(stats.visiblePrimitives);
  fields.draws.textContent = String(stats.drawCalls);
  fields.pack.textContent = formatBytes(pixelStore?.manifest.pack.bytes);
  fields.texture.textContent = `${stats.textureWidth}×${stats.textureHeight} · ${formatBytes(stats.textureBytes)}`;
  const upload = stats.textureUploadMs > 0 ? `${stats.textureUploadMs.toFixed(1)} ms` : 'timer-limited';
  const render = stats.renderMs > 0 ? `${stats.renderMs.toFixed(2)} ms` : 'timer-limited';
  fields.verify.textContent = `${(semanticLoadMs + pixelVerifyMs).toFixed(1)} ms / ${upload}`;
  fields.render.textContent = render;
}

function renderScene(pushUrl = false) {
  updateViewFields();
  if (pushUrl) history.replaceState(null, '', serializeViewState(view));
  if (renderer) updateDiagnostics(renderer.render(view));
  updateSelectionBox();
}

function setView(next, pushUrl = true) {
  const candidate = {
    ...next,
    x: Math.min(32440.9999, Math.max(32280, Number(next.x))),
    y: Math.min(32305.9999, Math.max(32155, Number(next.y))),
    zoom: Math.min(16, Math.max(0.25, Math.round(Number(next.zoom) * 10000) / 10000)),
    floor: -7,
  };
  view = parseViewState(serializeViewState(candidate));
  renderScene(pushUrl);
}
function pointerWorld(event) {
  const rect = canvas.getBoundingClientRect();
  const tilePixels = 32 * view.zoom;
  return {
    x: view.x + (event.clientX - rect.left - rect.width / 2) / tilePixels,
    y: view.y + (event.clientY - rect.top - rect.height / 2) / tilePixels,
    floor: -7,
  };
}

function pickAt(event) {
  const world = pointerWorld(event);
  const x = Math.floor(world.x);
  const y = Math.floor(world.y);
  if (x < 32280 || x >= 32441 || y < 32155 || y >= 32306) return;
  selected = { x, y, floor: -7 };
  renderInspector();
  updateSelectionBox();
}

function rebuildRenderRecords() {
  const orderedTiles = [...semanticTiles.values()].sort((a, b) => a.y - b.y || a.x - b.x);
  renderRecords = [];
  for (const tile of orderedTiles) {
    for (const presentation of tile.presentations) {
      for (const primitive of presentation.primitives) {
        renderRecords.push({ x: tile.x, y: tile.y, floor: tile.floor, presentation, primitive });
      }
    }
  }
}
canvas.addEventListener('pointerdown', (event) => {
  drag = { clientX: event.clientX, clientY: event.clientY, view, moved: 0 };
  canvas.setPointerCapture(event.pointerId);
  canvas.classList.add('dragging');
});

canvas.addEventListener('pointermove', (event) => {
  const world = pointerWorld(event);
  cursorCoordinate.textContent = `x ${world.x.toFixed(2)} · y ${world.y.toFixed(2)} · floor −7`;
  if (!drag) return;
  const scale = 32 * drag.view.zoom;
  const dx = (drag.clientX - event.clientX) / scale;
  const dy = (drag.clientY - event.clientY) / scale;
  drag.moved = Math.max(drag.moved, Math.hypot(event.clientX - drag.clientX, event.clientY - drag.clientY));
  setView({ ...drag.view, x: drag.view.x + dx, y: drag.view.y + dy }, false);
});

canvas.addEventListener('pointerleave', () => {
  cursorCoordinate.textContent = 'x — · y — · floor −7';
});

canvas.addEventListener('pointerup', (event) => {
  if (!drag) return;
  const moved = drag.moved;
  drag = null;
  canvas.classList.remove('dragging');
  history.replaceState(null, '', serializeViewState(view));
  if (moved < 4) pickAt(event);
});
canvas.addEventListener('wheel', (event) => {
  event.preventDefault();
  const rect = canvas.getBoundingClientRect();
  const world = pointerWorld(event);
  const factor = event.deltaY < 0 ? 1.2 : 1 / 1.2;
  const nextZoom = Math.min(16, Math.max(0.25, view.zoom * factor));
  const offsetX = (event.clientX - rect.left - rect.width / 2) / (32 * nextZoom);
  const offsetY = (event.clientY - rect.top - rect.height / 2) / (32 * nextZoom);
  setView({ ...view, x: world.x - offsetX, y: world.y - offsetY, zoom: nextZoom });
}, { passive: false });

document.querySelector('#zoom-in').addEventListener('click', () => setView({ ...view, zoom: view.zoom * 1.25 }));
document.querySelector('#zoom-out').addEventListener('click', () => setView({ ...view, zoom: view.zoom / 1.25 }));

document.querySelector('#copy-link').addEventListener('click', async (event) => {
  const button = event.currentTarget;
  try {
    await navigator.clipboard.writeText(location.href);
    button.textContent = 'Copied';
  } catch {
    button.textContent = 'Copy unavailable';
  }
  setTimeout(() => { button.textContent = 'Copy link'; }, 1200);
});
document.querySelector('#search-form').addEventListener('submit', (event) => {
  event.preventDefault();
  const input = document.querySelector('#search-input');
  const values = input.value.match(/-?\d+(?:\.\d+)?/g) ?? [];
  if (values.length < 2) {
    input.setCustomValidity('Enter X and Y coordinates.');
    input.reportValidity();
    return;
  }
  input.setCustomValidity('');
  try {
    setView({ ...view, x: Number(values[0]), y: Number(values[1]) });
  } catch (error) {
    input.setCustomValidity(error.message);
    input.reportValidity();
  }
});

for (const button of document.querySelectorAll('.tab')) {
  button.addEventListener('click', () => {
    activeTab = button.dataset.tab;
    for (const candidate of document.querySelectorAll('.tab')) candidate.classList.toggle('active', candidate === button);
    renderInspector();
  });
}

for (const stop of cameraItinerary()) {
  const item = document.createElement('li');
  const button = document.createElement('button');
  button.type = 'button';
  button.textContent = stop.label;
  button.title = 'Static camera navigation only; movementAuthority=false.';
  button.addEventListener('click', () => setView({ ...view, x: stop.x, y: stop.y }));
  item.append(button);
  document.querySelector('#itinerary').append(item);
}
window.addEventListener('resize', () => renderScene(false));
window.addEventListener('popstate', () => {
  view = parseViewState(location.search);
  renderScene(false);
});

async function initialize() {
  runtimeBadge.textContent = 'VERIFYING SEMANTICS…';
  const semanticStarted = performance.now();
  semanticManifest = await loadManifest('./proof/semantic/manifest.json');
  const proofBase = new URL('./proof/semantic/', location.href);
  const chunks = await Promise.all(semanticManifest.chunks.map((entry) => loadChunk(proofBase, entry, semanticManifest)));
  for (const chunk of chunks) {
    for (const raw of chunk.tiles) {
      const tile = decodeCompactTile(raw);
      semanticTiles.set(tileKey(tile.x, tile.y, tile.floor), tile);
    }
  }
  semanticLoadMs = performance.now() - semanticStarted;
  if (semanticTiles.size !== 24311) throw new Error(`semantic tile reconciliation failed: ${semanticTiles.size}`);
  if (!selected) selected = { x: Math.floor(view.x), y: Math.floor(view.y), floor: -7 };

  runtimeBadge.textContent = 'VERIFYING PIXELS…';
  const pixelStarted = performance.now();
  pixelStore = await loadPixelStore('./proof/pixels/manifest.json');
  pixelVerifyMs = performance.now() - pixelStarted;
  rebuildRenderRecords();
  if (renderRecords.length !== 39282) throw new Error(`primitive reconciliation failed: ${renderRecords.length}`);
  for (const record of renderRecords) {
    if (!pixelStore.sprites.has(record.primitive.spriteSourceId)) throw new Error(`unauthorized/missing sprite ${record.primitive.spriteSourceId}`);
  }
  runtimeBadge.textContent = 'INITIALIZING WEBGL2…';
  renderer = createWebGLRenderer(canvas, pixelStore);
  renderer.setRecords(renderRecords);
  runtimeBadge.textContent = 'VERIFIED · WEBGL2';
  runtimeBadge.classList.add('ok');
  renderInspector();
  renderScene(false);
}

initialize().catch((error) => {
  console.error(error);
  runtimeBadge.textContent = 'FAIL CLOSED';
  runtimeBadge.classList.add('error');
  inspectorState.textContent = 'RUNTIME ERROR';
  inspectorContent.innerHTML = `<p class="error">${escapeHtml(error.message)}</p><p class="empty">No legacy or raster fallback was attempted.</p>`;
  fields.backend.textContent = 'UNAVAILABLE';
  fields.chunks.textContent = '—';
  fields.visible.textContent = '—';
  fields.draws.textContent = '—';
});

updateViewFields();
