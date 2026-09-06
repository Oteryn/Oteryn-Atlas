import { canonicalJsonBytes, sha256ContentId } from './loader.mjs';
import { safeRelativePath } from './fullworld.mjs';

export const PIXEL_PROFILE = 'oteryn-atlas-fullworld-pixel-publication-v0';
export const PIXEL_ROOT_DOMAIN = 'OTERYN-ATLAS-FULLWORLD-PIXEL-STORE-V0\0';
export const PIXEL_HASH_DOMAIN = 'OTERYN-DYN-ATLAS-PIXEL-RGBA-V0';
const MAX_MANIFEST_BYTES = 16 * 1024 * 1024;
const MAX_PACK_BYTES = 64 * 1024 * 1024;

export class FullWorldPixelError extends Error {}

function requireValue(condition, message) {
  if (!condition) throw new FullWorldPixelError(message);
}

function isSha256(value) {
  return typeof value === 'string' && /^sha256:[0-9a-f]{64}$/.test(value);
}

function joinBytes(a, b) {
  const result = new Uint8Array(a.byteLength + b.byteLength);
  result.set(a, 0);
  result.set(b, a.byteLength);
  return result;
}

async function rootedContentId(value) {
  const core = { ...value };
  delete core.rootContentId;
  return sha256ContentId(joinBytes(new TextEncoder().encode(PIXEL_ROOT_DOMAIN), canonicalJsonBytes(core)));
}

async function readBounded(response, maxBytes, label, expectedBytes = null) {
  requireValue(response?.ok, `${label} fetch failed: ${response?.status ?? 'unknown'}`);
  const declared = response.headers?.get?.('content-length');
  if (declared != null) requireValue(Number(declared) <= maxBytes, `${label} declared bytes exceed limit`);
  const bytes = new Uint8Array(await response.arrayBuffer());
  requireValue(bytes.byteLength <= maxBytes, `${label} bytes exceed limit`);
  if (expectedBytes != null) requireValue(bytes.byteLength === expectedBytes, `${label} byte count mismatch`);
  return bytes;
}

function decodeCanonical(bytes) {
  let value;
  try { value = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes)); }
  catch (error) { throw new FullWorldPixelError(`pixel manifest is not valid UTF-8 JSON: ${error.message}`); }
  const canonical = canonicalJsonBytes(value);
  requireValue(canonical.byteLength === bytes.byteLength && canonical.every((byte, index) => byte === bytes[index]), 'pixel manifest is not canonical JSON');
  return value;
}

export async function loadFullWorldPixelCatalog(publicationBaseUrl, publication, trust, fetcher = fetch) {
  requireValue(isSha256(trust?.pixelRoot), 'trusted pixel root required');
  const manifestUrl = new URL(safeRelativePath(publication.pixels.path), publicationBaseUrl);
  const response = await fetcher(manifestUrl, { cache: 'no-store' });
  const manifest = decodeCanonical(await readBounded(response, MAX_MANIFEST_BYTES, 'pixel manifest'));
  requireValue(manifest.profile === PIXEL_PROFILE, 'unsupported pixel publication profile');
  requireValue(manifest.rootContentId === await rootedContentId(manifest), 'pixel publication root mismatch');
  requireValue(manifest.rootContentId === publication.pixels.rootContentId && manifest.rootContentId === trust.pixelRoot, 'pixel trusted root mismatch');
  requireValue(manifest.pixelHashDomain === PIXEL_HASH_DOMAIN, 'pixel identity domain mismatch');
  requireValue(manifest.runtimePlacement?.identityAuthority === false, 'runtime pixel placement claims identity authority');
  requireValue(Array.isArray(manifest.packs) && manifest.packs.length > 0 && manifest.packs.length <= 16, 'pixel packs invalid');
  requireValue(Array.isArray(manifest.blobs), 'pixel blobs missing');
  requireValue(manifest.spriteIndex && typeof manifest.spriteIndex === 'object' && !Array.isArray(manifest.spriteIndex), 'pixel sprite index missing');

  const packs = manifest.packs.map((pack, index) => {
    requireValue(pack?.identityAuthority === false, `pixel pack ${index} claims identity authority`);
    requireValue(Number.isSafeInteger(pack.bytes) && pack.bytes > 0 && pack.bytes <= MAX_PACK_BYTES, `pixel pack ${index} bytes invalid`);
    requireValue(typeof pack.sha256 === 'string' && /^[0-9a-f]{64}$/.test(pack.sha256), `pixel pack ${index} digest invalid`);
    safeRelativePath(pack.path);
    return Object.freeze({ ...pack, index });
  });

  const blobs = new Map();
  const cursors = new Array(packs.length).fill(0);
  let rawBytes = 0;
  for (const entry of manifest.blobs) {
    requireValue(entry && isSha256(entry.contentId) && !blobs.has(entry.contentId), 'duplicate/invalid pixel blob identity');
    requireValue(Number.isSafeInteger(entry.pack) && entry.pack >= 0 && entry.pack < packs.length, 'pixel blob pack invalid');
    requireValue(Number.isSafeInteger(entry.width) && Number.isSafeInteger(entry.height) && entry.width > 0 && entry.height > 0, 'pixel blob dimensions invalid');
    requireValue(Number.isSafeInteger(entry.offset) && Number.isSafeInteger(entry.bytes) && entry.offset >= 0 && entry.bytes === entry.width * entry.height * 4, 'pixel blob span invalid');
    requireValue(entry.offset === cursors[entry.pack], 'pixel pack placement is not canonical/contiguous');
    cursors[entry.pack] += entry.bytes;
    rawBytes += entry.bytes;
    blobs.set(entry.contentId, Object.freeze({ ...entry }));
  }
  for (let index = 0; index < packs.length; index += 1) requireValue(cursors[index] === packs[index].bytes, `pixel pack ${index} placement span mismatch`);

  const sprites = new Map();
  for (const [spriteIdRaw, entry] of Object.entries(manifest.spriteIndex)) {
    requireValue(/^[1-9][0-9]*$/.test(spriteIdRaw) && entry && isSha256(entry.contentId), 'pixel sprite index entry invalid');
    const blob = blobs.get(entry.contentId);
    requireValue(blob && blob.width === entry.width && blob.height === entry.height, 'pixel sprite/blob linkage mismatch');
    sprites.set(Number(spriteIdRaw), blob);
  }
  requireValue(manifest.counts?.spriteRefs === sprites.size && manifest.counts?.uniquePixelBlobs === blobs.size && manifest.counts?.rawBytesAfterDedupe === rawBytes, 'pixel publication count reconciliation failed');
  const pixelBaseUrl = new URL('./', manifestUrl);
  return Object.freeze({ blobs, manifest, packs: Object.freeze(packs), pixelBaseUrl, sprites });
}

export async function loadVerifiedPixelPack(catalog, packIndex, fetcher = fetch, options = {}) {
  const pack = catalog.packs[packIndex];
  requireValue(pack, `pixel pack ${packIndex} is not published`);
  const contentId = `sha256:${pack.sha256}`;
  let bytes = await options.persistentCache?.get?.(contentId, pack.bytes) ?? null;
  if (bytes) options.onLoad?.({ source: 'cache', bytes: bytes.byteLength, packIndex });
  if (!bytes) {
    const response = await fetcher(new URL(safeRelativePath(pack.path), catalog.pixelBaseUrl), { cache: 'no-store', signal: options.signal ?? null });
    bytes = await readBounded(response, MAX_PACK_BYTES, `pixel pack ${packIndex}`, pack.bytes);
    const actual = (await sha256ContentId(bytes)).slice('sha256:'.length);
    requireValue(actual === pack.sha256, `pixel pack ${packIndex} SHA-256 mismatch`);
    await options.persistentCache?.put?.(contentId, bytes);
    options.onLoad?.({ source: 'network', bytes: bytes.byteLength, packIndex });
  }
  return bytes;
}

export function requiredPixelPacks(records, catalog) {
  const packs = new Set();
  for (const record of records) {
    const blob = catalog.sprites.get(record.primitive.spriteSourceId);
    requireValue(blob, `published pixel mapping missing for sprite ${record.primitive.spriteSourceId}`);
    packs.add(blob.pack);
  }
  return [...packs].sort((a, b) => a - b);
}
