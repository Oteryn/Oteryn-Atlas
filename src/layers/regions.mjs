export const REGION_PROFILE = 'oteryn-atlas-public-regions-v0';
export const REGION_FAMILIES = Object.freeze(['area', 'subarea']);
export const REGION_LIMITS = Object.freeze({ records: 10000, polygonPoints: 4096, labelLength: 160 });

function requireValue(condition, message) { if (!condition) throw new Error(message); }

function validateBounds(bounds) {
  requireValue(bounds && Number.isFinite(bounds.x_min) && Number.isFinite(bounds.x_max_exclusive), 'region bounds x invalid');
  requireValue(Number.isFinite(bounds.y_min) && Number.isFinite(bounds.y_max_exclusive), 'region bounds y invalid');
  requireValue(bounds.x_min < bounds.x_max_exclusive && bounds.y_min < bounds.y_max_exclusive, 'region bounds empty');
}

export function validateRegionCatalog(catalog) {
  requireValue(catalog?.profile === REGION_PROFILE, 'unsupported region profile');
  requireValue(Array.isArray(catalog.records) && catalog.records.length <= REGION_LIMITS.records, 'region record limit exceeded');
  const ids = new Set();
  for (const record of catalog.records) {
    requireValue(REGION_FAMILIES.includes(record.family), 'unsupported region family');
    requireValue(typeof record.id === 'string' && record.id.length > 0 && !ids.has(record.id), 'invalid/duplicate region id');
    ids.add(record.id);
    requireValue(typeof record.label === 'string' && record.label.length > 0 && record.label.length <= REGION_LIMITS.labelLength, 'region label invalid');
    requireValue(Number.isSafeInteger(record.floor), 'region floor invalid');
    validateBounds(record.bounds);
    if (record.polygon != null) requireValue(Array.isArray(record.polygon) && record.polygon.length >= 3 && record.polygon.length <= REGION_LIMITS.polygonPoints, 'region polygon invalid');
  }
  for (const record of catalog.records) {
    if (record.parentId != null) requireValue(record.family === 'subarea' && ids.has(record.parentId), 'region parent relationship invalid');
  }
  return catalog;
}

export function searchRegions(records, query, options = {}) {
  const text = String(query ?? '').trim().toLocaleLowerCase('en-US');
  const floor = options.floor == null ? null : Number(options.floor);
  const family = options.family ?? null;
  return records.filter((record) => {
    if (floor != null && record.floor !== floor) return false;
    if (family && record.family !== family) return false;
    return !text || record.label.toLocaleLowerCase('en-US').includes(text);
  }).sort((a, b) => a.family.localeCompare(b.family) || a.label.localeCompare(b.label) || a.id.localeCompare(b.id));
}

export function zoomTargetForRegion(record, viewport = { width: 1280, height: 720 }) {
  validateBounds(record.bounds);
  const widthTiles = record.bounds.x_max_exclusive - record.bounds.x_min;
  const heightTiles = record.bounds.y_max_exclusive - record.bounds.y_min;
  const zoom = Math.max(0.125, Math.min(16, Math.min(viewport.width / (widthTiles * 32), viewport.height / (heightTiles * 32)) * 0.82));
  return Object.freeze({
    floor: record.floor,
    x: (record.bounds.x_min + record.bounds.x_max_exclusive) / 2,
    y: (record.bounds.y_min + record.bounds.y_max_exclusive) / 2,
    zoom,
  });
}
export function labelFamiliesForZoom(zoom) {
  if (zoom < 0.25) return Object.freeze(['area']);
  return Object.freeze(['area', 'subarea']);
}

export function layoutRegionLabels(records, view, viewport, measure = (text) => text.length * 7) {
  const allowed = new Set(labelFamiliesForZoom(view.zoom));
  const candidates = records.filter((record) => record.floor === view.floor && allowed.has(record.family)).map((record) => {
    const centerX = (record.bounds.x_min + record.bounds.x_max_exclusive) / 2;
    const centerY = (record.bounds.y_min + record.bounds.y_max_exclusive) / 2;
    const x = viewport.width / 2 + (centerX - view.x) * 32 * view.zoom;
    const y = viewport.height / 2 + (centerY - view.y) * 32 * view.zoom;
    const width = Math.max(30, measure(record.label) + 12);
    return { record, x, y, width, height: 20, priority: record.family === 'area' ? 0 : 1 };
  }).filter((candidate) => candidate.x >= -candidate.width && candidate.x <= viewport.width + candidate.width && candidate.y >= -20 && candidate.y <= viewport.height + 20);
  candidates.sort((a, b) => a.priority - b.priority || a.record.label.localeCompare(b.record.label) || a.record.id.localeCompare(b.record.id));
  const accepted = [];
  for (const candidate of candidates) {
    const box = { left: candidate.x - candidate.width / 2, right: candidate.x + candidate.width / 2, top: candidate.y - 10, bottom: candidate.y + 10 };
    if (accepted.some((item) => !(box.right < item.box.left || box.left > item.box.right || box.bottom < item.box.top || box.top > item.box.bottom))) continue;
    accepted.push({ ...candidate, box });
  }
  return Object.freeze(accepted.map(({ record, x, y }) => Object.freeze({ id: record.id, label: record.label, family: record.family, x, y })));
}
