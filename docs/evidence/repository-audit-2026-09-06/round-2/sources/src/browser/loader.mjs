import { validateChunk, validateManifest } from './semantic.mjs';

const MAX_MANIFEST_BYTES = 256 * 1024;
const MAX_CHUNK_BYTES = 2 * 1024 * 1024;
const ROOT_DOMAIN = 'OTERYN-DYN-ATLAS-COMPACT-JSON-V0\0';

export class LoadError extends Error {}

function sortCanonical(value) {
  if (Array.isArray(value)) return value.map(sortCanonical);
  if (value && typeof value === 'object') {
    const result = {};
    for (const key of Object.keys(value).sort()) result[key] = sortCanonical(value[key]);
    return result;
  }
  return value;
}

export function canonicalJsonBytes(value) {
  const text = `${JSON.stringify(sortCanonical(value))}\n`;
  return new TextEncoder().encode(text);
}

const SHA256_K = Object.freeze([
  0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
  0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
  0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
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

async function readBoundedResponse(response, limit, label) {
  if (!response?.ok) throw new LoadError(`${label} fetch failed: ${response?.status ?? 'unknown'}`);
  const declared = response.headers?.get?.('content-length');
  if (declared !== null && declared !== undefined && Number(declared) > limit) throw new LoadError(`${label} declared bytes exceed proof limit`);
  const bytes = new Uint8Array(await response.arrayBuffer());
  if (bytes.byteLength > limit) throw new LoadError(`${label} bytes exceed proof limit`);
  return bytes;
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
  const url = new URL(entry.path, baseUrl).toString();
  const response = await fetcher(url, { cache: 'no-store' });
  const bytes = await readBoundedResponse(response, MAX_CHUNK_BYTES, 'chunk');
  if (bytes.byteLength !== entry.bytes) throw new LoadError('chunk byte count differs from manifest');
  const contentId = await sha256ContentId(bytes);
  if (contentId !== entry.contentId) throw new LoadError('chunk content identity mismatch');
  return validateChunk(decodeJson(bytes, 'chunk'), manifest);
}
