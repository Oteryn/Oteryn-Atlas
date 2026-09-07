import { validateChunk, validateManifest } from './semantic.mjs';

const MAX_MANIFEST_BYTES = 256 * 1024;
const MAX_CHUNK_BYTES = 2 * 1024 * 1024;
const ROOT_DOMAIN = 'OTERYN-DYN-ATLAS-COMPACT-JSON-V0\0';

export class LoadError extends Error {}

function compareUnicodeCodePoints(left, right) {
  let leftIndex = 0;
  let rightIndex = 0;
  while (leftIndex < left.length && rightIndex < right.length) {
    const leftPoint = left.codePointAt(leftIndex);
    const rightPoint = right.codePointAt(rightIndex);
    if (leftPoint !== rightPoint) return leftPoint < rightPoint ? -1 : 1;
    leftIndex += leftPoint > 0xffff ? 2 : 1;
    rightIndex += rightPoint > 0xffff ? 2 : 1;
  }
  if (leftIndex < left.length) return 1;
  if (rightIndex < right.length) return -1;
  return 0;
}

function canonicalJsonText(value) {
  if (Array.isArray(value)) return `[${value.map(canonicalJsonText).join(',')}]`;
  if (value && typeof value === 'object') {
    const entries = Object.keys(value)
      .sort(compareUnicodeCodePoints)
      .map((key) => `${JSON.stringify(key)}:${canonicalJsonText(value[key])}`);
    return `{${entries.join(',')}}`;
  }
  const text = JSON.stringify(value);
  if (text === undefined) throw new TypeError('unsupported canonical JSON value');
  return text;
}

export function canonicalJsonBytes(value) {
  return new TextEncoder().encode(`${canonicalJsonText(value)}\n`);
}

const SHA256_K = Object.freeze([
  0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
  0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
  0xe49b69c1, 0xefbe4786, 0x0fc19dcf, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
  0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
  0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
  0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
  0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
  0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
]);

function rotr32(value, amount) {
  return (value >>> amount) | (value << (32 - amount));
}

export function sha256HexPortable(input) {
  const bytes = input instanceof Uint8Array ? input : new Uint8Array(input);
  const bitLength = bytes.byteLength * 8;
  const paddedLength = Math.ceil((bytes.byteLength + 1 + 8) / 64) * 64;
  const message = new Uint8Array(paddedLength);
  message.set(bytes);
  message[bytes.byteLength] = 0x80;
  const view = new DataView(message.buffer);
  view.setUint32(paddedLength - 8, Math.floor(bitLength / 0x100000000), false);
  view.setUint32(paddedLength - 4, bitLength >>> 0, false);

  const hash = new Uint32Array([
    0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a,
    0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19,
  ]);
  const words = new Uint32Array(64);

  for (let offset = 0; offset < paddedLength; offset += 64) {
    for (let index = 0; index < 16; index += 1) words[index] = view.getUint32(offset + index * 4, false);
    for (let index = 16; index < 64; index += 1) {
      const x = words[index - 15];
      const y = words[index - 2];
      const sigma0 = rotr32(x, 7) ^ rotr32(x, 18) ^ (x >>> 3);
      const sigma1 = rotr32(y, 17) ^ rotr32(y, 19) ^ (y >>> 10);
      words[index] = (words[index - 16] + sigma0 + words[index - 7] + sigma1) >>> 0;
    }

    let [a, b, c, d, e, f, g, h] = hash;
    for (let index = 0; index < 64; index += 1) {
      const sum1 = rotr32(e, 6) ^ rotr32(e, 11) ^ rotr32(e, 25);
      const choice = (e & f) ^ (~e & g);
      const t1 = (h + sum1 + choice + SHA256_K[index] + words[index]) >>> 0;
      const sum0 = rotr32(a, 2) ^ rotr32(a, 13) ^ rotr32(a, 22);
      const majority = (a & b) ^ (a & c) ^ (b & c);
      const t2 = (sum0 + majority) >>> 0;
      h = g;
      g = f;
      f = e;
      e = (d + t1) >>> 0;
      d = c;
      c = b;
      b = a;
      a = (t1 + t2) >>> 0;
    }
    hash[0] = (hash[0] + a) >>> 0;
    hash[1] = (hash[1] + b) >>> 0;
    hash[2] = (hash[2] + c) >>> 0;
    hash[3] = (hash[3] + d) >>> 0;
    hash[4] = (hash[4] + e) >>> 0;
    hash[5] = (hash[5] + f) >>> 0;
    hash[6] = (hash[6] + g) >>> 0;
    hash[7] = (hash[7] + h) >>> 0;
  }
  return [...hash].map((word) => word.toString(16).padStart(8, '0')).join('');
}

export async function sha256ContentId(bytes, subtle = globalThis.crypto?.subtle) {
  let hex;
  if (subtle?.digest) {
    const digest = await subtle.digest('SHA-256', bytes);
    hex = [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
  } else {
    hex = sha256HexPortable(bytes);
  }
  return `sha256:${hex}`;
}

export async function computeRootContentId(manifest) {
  const core = { ...manifest };
  delete core.rootContentId;
  const domain = new TextEncoder().encode(ROOT_DOMAIN);
  const canonical = canonicalJsonBytes(core);
  const joined = new Uint8Array(domain.length + canonical.length);
  joined.set(domain, 0);
  joined.set(canonical, domain.length);
  return sha256ContentId(joined);
}

function throwTyped(errorClass, message) {
  throw new errorClass(message);
}

export function validateRelativePath(path, label = 'path', { errorClass = LoadError } = {}) {
  if (typeof path !== 'string' || path.length === 0) throwTyped(errorClass, `${label} missing`);
  if (path.startsWith('/') || path.includes('\\') || path.includes('?') || path.includes('#')) throwTyped(errorClass, `${label} is not a safe relative path`);
  const parts = path.split('/');
  if (parts.some((part) => part === '' || part === '.' || part === '..')) throwTyped(errorClass, `${label} is not a safe relative path`);
  for (const part of parts) {
    let decoded;
    try { decoded = decodeURIComponent(part); }
    catch { throwTyped(errorClass, `${label} has invalid percent encoding`); }
    if (decoded === '' || decoded === '.' || decoded === '..' || decoded.includes('/') || decoded.includes('\\')) throwTyped(errorClass, `${label} is not a safe relative path`);
  }
  return path;
}

export function resolveTrustedRelativeUrl(path, baseUrl, label = 'path', { errorClass = LoadError } = {}) {
  const relative = validateRelativePath(path, label, { errorClass });
  let base;
  let resolved;
  try {
    base = new URL(baseUrl);
    resolved = new URL(relative, base);
  } catch {
    throwTyped(errorClass, `${label} URL resolution failed`);
  }
  const baseDirectory = base.pathname.endsWith('/') ? base : new URL('./', base);
  if (resolved.protocol !== base.protocol || resolved.origin !== base.origin) throwTyped(errorClass, `${label} escapes trusted origin`);
  if (resolved.search || resolved.hash) throwTyped(errorClass, `${label} must not contain query or fragment state`);
  if (!resolved.pathname.startsWith(baseDirectory.pathname)) throwTyped(errorClass, `${label} escapes trusted path prefix`);
  return resolved;
}

export async function readBoundedResponseBytes(response, limit, label, { errorClass = LoadError, expectedBytes = null } = {}) {
  if (!Number.isSafeInteger(limit) || limit < 0) throwTyped(errorClass, `${label} byte limit invalid`);
  if (!response?.ok) throwTyped(errorClass, `${label} fetch failed: ${response?.status ?? 'unknown'}`);
  const declared = response.headers?.get?.('content-length');
  if (declared !== null && declared !== undefined) {
    const declaredBytes = Number(declared);
    if (Number.isFinite(declaredBytes) && declaredBytes > limit) throwTyped(errorClass, `${label} declared bytes exceed proof limit`);
  }
  const reader = response.body?.getReader?.();
  if (!reader) throwTyped(errorClass, `${label} response body is not stream-readable`);
  const chunks = [];
  let total = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      const chunk = value instanceof Uint8Array ? value : new Uint8Array(value);
      total += chunk.byteLength;
      if (total > limit) {
        try { await reader.cancel(); } catch {}
        throwTyped(errorClass, `${label} bytes exceed proof limit`);
      }
      chunks.push(chunk);
    }
  } catch (error) {
    if (error instanceof errorClass) throw error;
    throwTyped(errorClass, `${label} body read failed: ${error?.message ?? String(error)}`);
  } finally {
    try { reader.releaseLock?.(); } catch {}
  }
  if (expectedBytes != null && total !== expectedBytes) throwTyped(errorClass, `${label} byte count mismatch`);
  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return bytes;
}

async function readBoundedResponse(response, limit, label) {
  return readBoundedResponseBytes(response, limit, label);
}

function decodeJson(bytes, label) {
  try {
    return JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes));
  } catch (error) {
    throw new LoadError(`${label} is not valid UTF-8 JSON: ${error.message}`);
  }
}

export async function loadManifest(url, fetcher = fetch) {
  const response = await fetcher(url, { cache: 'no-store' });
  const bytes = await readBoundedResponse(response, MAX_MANIFEST_BYTES, 'manifest');
  const manifest = validateManifest(decodeJson(bytes, 'manifest'));
  const actualRoot = await computeRootContentId(manifest);
  if (manifest.rootContentId !== actualRoot) throw new LoadError('manifest root content identity mismatch');
  return manifest;
}

export async function loadChunk(baseUrl, entry, manifest, fetcher = fetch) {
  if (!entry || typeof entry !== 'object') throw new LoadError('invalid chunk index entry');
  if (!Number.isSafeInteger(entry.bytes) || entry.bytes < 1 || entry.bytes > MAX_CHUNK_BYTES) throw new LoadError('invalid indexed chunk byte size');
  const url = resolveTrustedRelativeUrl(entry.path, baseUrl, 'chunk path').toString();
  const response = await fetcher(url, { cache: 'no-store' });
  const bytes = await readBoundedResponse(response, MAX_CHUNK_BYTES, 'chunk');
  if (bytes.byteLength !== entry.bytes) throw new LoadError('chunk byte count differs from manifest');
  const contentId = await sha256ContentId(bytes);
  if (contentId !== entry.contentId) throw new LoadError('chunk content identity mismatch');
  return validateChunk(decodeJson(bytes, 'chunk'), manifest);
}
