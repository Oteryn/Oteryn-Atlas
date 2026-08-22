const MAX_SAMPLES = 512;

function requireValue(condition, message) {
  if (!condition) throw new TypeError(message);
}

function byte(value) {
  return Number.isSafeInteger(value) && value >= 0 && value <= 255;
}

function fnv1a(text) {
  let hash = 0x811c9dc5;
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash.toString(16).padStart(8, '0');
}

export function summarizeFramebufferSamples(samples, clearRgba = [7, 11, 17, 255]) {
  requireValue(Array.isArray(samples) && samples.length >= 1, 'framebuffer probe requires at least one sample');
  requireValue(samples.length <= MAX_SAMPLES, 'framebuffer probe sample set must remain bounded');
  requireValue(Array.isArray(clearRgba) && clearRgba.length === 4 && clearRgba.every(byte), 'framebuffer clear RGBA invalid');
  const recordIds = [];
  let nonClearSamples = 0;
  const canonical = [];
  for (const sample of samples) {
    requireValue(sample && typeof sample.recordId === 'string' && sample.recordId.length > 0, 'framebuffer sample record id invalid');
    requireValue(Number.isSafeInteger(sample.x) && sample.x >= 0 && Number.isSafeInteger(sample.y) && sample.y >= 0, 'framebuffer sample coordinate invalid');
    requireValue(Array.isArray(sample.rgba) && sample.rgba.length === 4 && sample.rgba.every(byte), 'framebuffer sample RGBA invalid');
    if (!recordIds.includes(sample.recordId) && recordIds.length < 24) recordIds.push(sample.recordId);
    const differs = sample.rgba.some((value, channel) => value !== clearRgba[channel]);
    if (differs) nonClearSamples += 1;
    canonical.push(`${sample.recordId}@${sample.x},${sample.y}:${sample.rgba.join(',')}`);
  }
  return Object.freeze({
    sampleCount: samples.length,
    nonClearSamples,
    blank: nonClearSamples === 0,
    signature: fnv1a(canonical.join('|')),
    recordIds: Object.freeze(recordIds),
  });
}


function visibleRecordRect(record, view, canvas, dpr) {
  if (record.floor !== view.floor) return null;
  const primitive = record.primitive;
  const scale = view.zoom * dpr;
  const centerWorldX = view.x * 32;
  const centerWorldY = view.y * 32;
  const worldX = record.x * 32 - (primitive.widthUnits - 32) + primitive.displacement.dxUnits;
  const worldY = record.y * 32 - (primitive.heightUnits - 32) + primitive.displacement.dyUnits;
  const x0 = canvas.width / 2 + (worldX - centerWorldX) * scale;
  const y0 = canvas.height / 2 + (worldY - centerWorldY) * scale;
  const x1 = x0 + primitive.widthUnits * scale;
  const y1 = y0 + primitive.heightUnits * scale;
  if (!(x1 > 0 && y1 > 0 && x0 < canvas.width && y0 < canvas.height)) return null;
  return { x0: Math.max(0, x0), y0: Math.max(0, y0), x1: Math.min(canvas.width, x1), y1: Math.min(canvas.height, y1) };
}

export function sampleVisibleFramebufferRecords(gl, records, view, canvas, dpr, clearRgba = [7, 11, 17, 255]) {
  const candidates = [];
  for (const record of records) {
    const rect = visibleRecordRect(record, view, canvas, dpr);
    if (!rect) continue;
    candidates.push({ record, rect });
    if (candidates.length >= 12) break;
  }
  if (!candidates.length) return null;
  const samples = [];
  const fractions = [0.25, 0.5, 0.75];
  for (const { record, rect } of candidates) {
    for (const fx of fractions) {
      for (const fy of fractions) {
        const x = Math.max(0, Math.min(canvas.width - 1, Math.floor(rect.x0 + (rect.x1 - rect.x0) * fx)));
        const topY = Math.max(0, Math.min(canvas.height - 1, Math.floor(rect.y0 + (rect.y1 - rect.y0) * fy)));
        const y = canvas.height - 1 - topY;
        const pixel = new Uint8Array(4);
        gl.readPixels(x, y, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, pixel);
        samples.push({ recordId: record.tileRecordId ?? `${record.floor}:${record.x}:${record.y}`, x, y, rgba: Array.from(pixel) });
      }
    }
  }
  return summarizeFramebufferSamples(samples, clearRgba);
}
