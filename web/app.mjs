import { cameraItinerary, decodeCompactTile, inspectTile, parseViewState, serializeViewState } from '../src/browser/semantic.mjs';
import { loadChunk, loadManifest } from '../src/browser/loader.mjs';

const canvas = document.querySelector('#atlas');
const context = canvas.getContext('2d');
const inspector = document.querySelector('#inspector');
const viewOutput = document.querySelector('#view-state');
const itineraryElement = document.querySelector('#itinerary');

if (!context) throw new Error('Canvas 2D unavailable');

let view = parseViewState(location.search);
let dragStart = null;
let selected = null;
const semanticTiles = new Map();

function tileKey(x, y, floor = -7) {
  return `${floor}:${x}:${y}`;
}

function setView(next, push = true) {
  view = parseViewState(serializeViewState(next));
  if (push) history.replaceState(null, '', serializeViewState(view));
  viewOutput.value = `x ${view.x} · y ${view.y} · floor ${view.floor} · zoom ${view.zoom}`;
  render();
}

function worldToScreen(x, y) {
  const tilePixels = 8 * view.zoom;
  return {
    x: canvas.width / 2 + (x - view.x) * tilePixels,
    y: canvas.height / 2 + (y - view.y) * tilePixels,
    size: tilePixels,
  };
}

function screenToWorld(x, y) {
  const tilePixels = 8 * view.zoom;
  return {
    x: Math.floor(view.x + (x - canvas.width / 2) / tilePixels),
    y: Math.floor(view.y + (y - canvas.height / 2) / tilePixels),
    floor: -7,
  };
}

function render() {
  context.clearRect(0, 0, canvas.width, canvas.height);
  context.fillStyle = '#10151c';
  context.fillRect(0, 0, canvas.width, canvas.height);
  const tilePixels = 8 * view.zoom;
  const halfX = Math.ceil(canvas.width / tilePixels / 2) + 1;
  const halfY = Math.ceil(canvas.height / tilePixels / 2) + 1;

  for (let y = view.y - halfY; y <= view.y + halfY; y += 1) {
    for (let x = view.x - halfX; x <= view.x + halfX; x += 1) {
      if (x < 32280 || x >= 32441 || y < 32155 || y >= 32306) continue;
      const screen = worldToScreen(x, y);
      const tile = semanticTiles.get(tileKey(x, y));
      const isSelected = selected?.x === x && selected?.y === y;
      context.fillStyle = isSelected ? '#d9e6ff' : tile ? '#354d67' : '#1c2530';
      context.fillRect(screen.x, screen.y, Math.max(1, screen.size - 1), Math.max(1, screen.size - 1));
      if (tile?.presentations?.length) {
        context.fillStyle = isSelected ? '#10151c' : '#a9c7e8';
        const marker = Math.max(1, Math.min(screen.size / 3, 5));
        context.fillRect(screen.x + screen.size / 2 - marker / 2, screen.y + screen.size / 2 - marker / 2, marker, marker);
      }
    }
  }
}

function inspectAt(position) {
  selected = position;
  const tile = semanticTiles.get(tileKey(position.x, position.y));
  inspector.textContent = tile
    ? JSON.stringify(inspectTile(tile), null, 2)
    : JSON.stringify({
        worldPosition: position,
        state: 'chunk-not-loaded',
        note: 'This shell intentionally does not infer missing semantic records.',
      }, null, 2);
  render();
}

export async function loadProof(manifestUrl = './proof/manifest.json') {
  const manifest = await loadManifest(manifestUrl);
  const baseUrl = new URL('./proof/', new URL(manifestUrl, location.href));
  const chunks = await Promise.all(manifest.chunks.map((entry) => loadChunk(baseUrl, entry, manifest)));
  for (const chunk of chunks) {
    for (const raw of chunk.tiles) {
      const tile = decodeCompactTile(raw);
      semanticTiles.set(tileKey(tile.x, tile.y, tile.floor), tile);
    }
  }
  render();
  return manifest;
}

canvas.addEventListener('pointerdown', (event) => {
  dragStart = { x: event.clientX, y: event.clientY, view };
  canvas.setPointerCapture(event.pointerId);
});
canvas.addEventListener('pointermove', (event) => {
  if (!dragStart) return;
  const tilePixels = 8 * dragStart.view.zoom;
  const dx = Math.round((dragStart.x - event.clientX) / tilePixels);
  const dy = Math.round((dragStart.y - event.clientY) / tilePixels);
  try {
    setView({ ...dragStart.view, x: dragStart.view.x + dx, y: dragStart.view.y + dy }, false);
  } catch {
    // Bounds are authority. Dragging beyond them is ignored rather than clamped to invented data.
  }
});
canvas.addEventListener('pointerup', (event) => {
  if (!dragStart) return;
  const moved = Math.abs(event.clientX - dragStart.x) + Math.abs(event.clientY - dragStart.y);
  dragStart = null;
  history.replaceState(null, '', serializeViewState(view));
  if (moved < 4) {
    const rect = canvas.getBoundingClientRect();
    inspectAt(screenToWorld(event.clientX - rect.left, event.clientY - rect.top));
  }
});

document.querySelector('#zoom-in').addEventListener('click', () => setView({ ...view, zoom: Math.min(16, view.zoom * 2) }));
document.querySelector('#zoom-out').addEventListener('click', () => setView({ ...view, zoom: Math.max(0.25, view.zoom / 2) }));

for (const stop of cameraItinerary()) {
  const item = document.createElement('li');
  const button = document.createElement('button');
  button.type = 'button';
  button.textContent = `${stop.order + 1}. ${stop.label} (${stop.x}, ${stop.y})`;
  button.title = 'Camera navigation only; does not assert walkability or Game movement authority.';
  button.addEventListener('click', () => setView({ x: stop.x, y: stop.y, floor: stop.floor, zoom: view.zoom }));
  item.append(button);
  itineraryElement.append(item);
}

setView(view, false);
loadProof().catch((error) => {
  inspector.textContent = JSON.stringify({
    state: 'semantic-proof-data-unavailable',
    error: error.message,
    sourceAuthority: 'Game artifact sha256:d38a98acaf019b07a05c0bee922505fe4c9852b38e65644e488e92df9031da2e',
    behavior: 'fail-closed; no legacy fallback',
  }, null, 2);
});
