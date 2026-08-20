import { canonicalJsonBytes, sha256ContentId } from './loader.mjs';
import { safeRelativePath } from './fullworld.mjs';

export const RUNTIME_PIXEL_BUCKET_PROFILE = 'oteryn-atlas-runtime-pixel-buckets-v0';
export const RUNTIME_PIXEL_BUCKET_DOMAIN = 'OTERYN-ATLAS-RUNTIME-PIXEL-BUCKETS-V0\0';
const MAX_MANIFEST_BYTES = 16 * 1024 * 1024;
const MAX_BUCKET_BYTES = 8 * 1024 * 1024;

export class RuntimePixelBucketError extends Error {}

function requireValue(condition, message) {
  if (!condition) throw new RuntimePixelBucketError(message);
}
function isSha256(value) { return typeof value === 'string' && /^sha256:[0-9a-f]{64}$/.test(value); }
function joinBytes(a, b) { const out = new Uint8Array(a.length + b.length); out.set(a); out.set(b, a.length); return out; }
async function rootId(value) {
  const core = { ...value }; delete core.rootContentId;
  return sha256ContentId(joinBytes(new TextEncoder().encode(RUNTIME_PIXEL_BUCKET_DOMAIN), canonicalJsonBytes(core)));
}
async function bounded(response, limit, label, expected = null) {
  requireValue(response?.ok, `${label} fetch failed: ${response?.status ?? 'unknown'}`);
  const declared = response.headers?.get?.('content-length');
  if (declared != null) requireValue(Number(declared) <= limit, `${label} declared bytes exceed limit`);
  const bytes = new Uint8Array(await response.arrayBuffer());
  requireValue(bytes.byteLength <= limit, `${label} bytes exceed limit`);
  if (expected != null) requireValue(bytes.byteLength === expected, `${label} byte count mismatch`);
  return bytes;
}
function canonicalDecode(bytes, label) {
  let value;
  try { value = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes)); }
  catch (error) { throw new RuntimePixelBucketError(`${label} JSON decode failed: ${error.message}`); }
  const canonical = canonicalJsonBytes(value);
  requireValue(canonical.length === bytes.length && canonical.every((byte, index) => byte === bytes[index]), `${label} is not canonical JSON`);
  return value;
}

export async function loadRuntimePixelBuckets(baseUrl, trust, fetcher = fetch) {
  requireValue(isSha256(trust?.pixelBucketRoot) && isSha256(trust?.publicationRoot) && isSha256(trust?.pixelRoot), 'trusted runtime pixel roots required');
  const manifestUrl = new URL('manifest.json', baseUrl);
  const response = await fetcher(manifestUrl, { cache: 'no-store' });
  const manifest = canonicalDecode(await bounded(response, MAX_MANIFEST_BYTES, 'runtime pixel bucket manifest'), 'runtime pixel bucket manifest');
  requireValue(manifest.profile === RUNTIME_PIXEL_BUCKET_PROFILE, 'unsupported runtime pixel bucket profile');
  requireValue(manifest.identityAuthority === false, 'runtime pixel buckets claim identity authority');
  requireValue(await rootId(manifest) === manifest.rootContentId && manifest.rootContentId === trust.pixelBucketRoot, 'runtime pixel bucket trusted root mismatch');
  requireValue(manifest.source?.authority === 'Oteryn/Oteryn-Game' && manifest.source.publicationRoot === trust.publicationRoot && manifest.source.pixelRoot === trust.pixelRoot, 'runtime pixel bucket source linkage mismatch');
  requireValue(Number.isSafeInteger(manifest.bucketNibbles) && manifest.bucketNibbles >= 1 && manifest.bucketNibbles <= 4, 'runtime pixel bucket prefix invalid');
  requireValue(Array.isArray(manifest.buckets) && manifest.blobIndex && typeof manifest.blobIndex === 'object', 'runtime pixel bucket index missing');
  const buckets = new Map();
  let bytes = 0;
  for (const bucket of manifest.buckets) {
    requireValue(typeof bucket.bucket === 'string' && /^[0-9a-f]+$/.test(bucket.bucket) && bucket.bucket.length === manifest.bucketNibbles && !buckets.has(bucket.bucket), 'runtime pixel bucket identity invalid');
    safeRelativePath(bucket.path);
    requireValue(bucket.identityAuthority === false && Number.isSafeInteger(bucket.bytes) && bucket.bytes > 0 && bucket.bytes <= MAX_BUCKET_BYTES, 'runtime pixel bucket descriptor invalid');
    requireValue(isSha256(bucket.contentId) && bucket.contentId === `sha256:${bucket.sha256}` && /^[0-9a-f]{64}$/.test(bucket.sha256), 'runtime pixel bucket content identity invalid');
    buckets.set(bucket.bucket, Object.freeze({ ...bucket })); bytes += bucket.bytes;
  }
  const bundle = manifest.localMaxBundle;
  requireValue(bundle && bundle.identityAuthority === false && Number.isSafeInteger(bundle.bytes) && bundle.bytes === bytes && isSha256(bundle.contentId) && bundle.contentId === `sha256:${bundle.sha256}`, 'runtime local-max pixel bundle invalid');
  safeRelativePath(bundle.path);
  requireValue(Array.isArray(bundle.bucketOffsets) && bundle.bucketOffsets.length === buckets.size, 'runtime local-max bundle bucket index invalid');
  let expectedBundleOffset = 0;
  for (let index = 0; index < bundle.bucketOffsets.length; index += 1) {
    const span = bundle.bucketOffsets[index];
    const bucketId = [...buckets.keys()].sort()[index];
    requireValue(span?.bucket === bucketId && span.offset === expectedBundleOffset && span.bytes === buckets.get(bucketId).bytes, 'runtime local-max bundle bucket span mismatch');
    expectedBundleOffset += span.bytes;
  }
  requireValue(expectedBundleOffset === bundle.bytes, 'runtime local-max bundle span reconciliation failed');
  const blobs = new Map();
  const blobsByBucket = new Map([...buckets.keys()].map((key) => [key, []]));
  for (const [contentId, placement] of Object.entries(manifest.blobIndex)) {
    requireValue(isSha256(contentId) && placement && buckets.has(placement.bucket), 'runtime pixel blob bucket linkage invalid');
    requireValue(Number.isSafeInteger(placement.offset) && placement.offset >= 0 && Number.isSafeInteger(placement.bytes) && placement.bytes > 0 && placement.offset + placement.bytes <= buckets.get(placement.bucket).bytes, 'runtime pixel blob range invalid');
    requireValue(Number.isSafeInteger(placement.width) && Number.isSafeInteger(placement.height) && placement.bytes === placement.width * placement.height * 4, 'runtime pixel blob dimensions invalid');
    const frozen = Object.freeze({ contentId, ...placement });
    blobs.set(contentId, frozen);
    blobsByBucket.get(placement.bucket).push(frozen);
  }
  for (const values of blobsByBucket.values()) values.sort((a, b) => a.offset - b.offset || a.contentId.localeCompare(b.contentId));
  requireValue(manifest.counts?.buckets === buckets.size && manifest.counts?.blobs === blobs.size && manifest.counts?.bytes === bytes, 'runtime pixel bucket count reconciliation failed');
  return Object.freeze({ manifest, buckets, blobs, blobsByBucket, baseUrl: new URL(baseUrl) });
}

export async function loadVerifiedPixelBucket(catalog, bucketId, fetcher = fetch, options = {}) {
  const descriptor = catalog.buckets.get(bucketId);
  requireValue(descriptor, `runtime pixel bucket ${bucketId} missing`);
  let bytes = await options.persistentCache?.get?.(descriptor.contentId, descriptor.bytes) ?? null;
  if (bytes) options.onLoad?.({ source: 'cache', bytes: bytes.byteLength, bucketId });
  if (!bytes) {
    const response = await fetcher(new URL(safeRelativePath(descriptor.path), catalog.baseUrl), { cache: 'no-store', signal: options.signal ?? null });
    bytes = await bounded(response, MAX_BUCKET_BYTES, `runtime pixel bucket ${bucketId}`, descriptor.bytes);
    requireValue(await sha256ContentId(bytes) === descriptor.contentId, `runtime pixel bucket ${bucketId} identity mismatch`);
    await options.persistentCache?.put?.(descriptor.contentId, bytes);
    options.onLoad?.({ source: 'network', bytes: bytes.byteLength, bucketId });
  }
  return bytes;
}

export function requiredRuntimePixelBuckets(records, pixelCatalog, runtimeCatalog) {
  const result = new Set();
  for (const record of records) {
    const sourceBlob = pixelCatalog.sprites.get(record.primitive.spriteSourceId);
    requireValue(sourceBlob, `published pixel mapping missing for sprite ${record.primitive.spriteSourceId}`);
    const placement = runtimeCatalog.blobs.get(sourceBlob.contentId);
    requireValue(placement && placement.width === sourceBlob.width && placement.height === sourceBlob.height, `runtime pixel placement missing for ${sourceBlob.contentId}`);
    result.add(placement.bucket);
  }
  return [...result].sort();
}

export async function loadVerifiedPixelBundle(catalog, fetcher = fetch, options = {}) {
  const descriptor = catalog.manifest.localMaxBundle;
  requireValue(descriptor, 'runtime local-max pixel bundle missing');
  let bytes = await options.persistentCache?.get?.(descriptor.contentId, descriptor.bytes) ?? null;
  if (bytes) options.onLoad?.({ source: 'cache', bytes: bytes.byteLength });
  if (!bytes) {
    const response = await fetcher(new URL(safeRelativePath(descriptor.path), catalog.baseUrl), { cache: 'no-store', signal: options.signal ?? null });
    bytes = await bounded(response, Math.max(MAX_BUCKET_BYTES, descriptor.bytes), 'runtime local-max pixel bundle', descriptor.bytes);
    requireValue(await sha256ContentId(bytes) === descriptor.contentId, 'runtime local-max pixel bundle identity mismatch');
    await options.persistentCache?.put?.(descriptor.contentId, bytes);
    options.onLoad?.({ source: 'network', bytes: bytes.byteLength });
  }
  return bytes;
}
