import crypto from 'node:crypto';

import { STABLE_TEST_ID_ALGORITHM } from '../../e2e/stable-test-id.mjs';

function canonicalJson(value) {
  return JSON.stringify(value);
}

function exactDigest(value, label) {
  if (typeof value !== 'string' || !/^sha256:[a-f0-9]{64}$/i.test(value)) {
    throw new TypeError(`${label} must be an exact sha256 digest`);
  }
  return value.toLowerCase();
}

function sha256Canonical(value) {
  return `sha256:${crypto.createHash('sha256').update(canonicalJson(value)).digest('hex')}`;
}

function validateAlgorithmIdentity(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new TypeError('stable-ID algorithm identity mismatch');
  }
  if (canonicalJson(value) !== canonicalJson(STABLE_TEST_ID_ALGORITHM)) {
    throw new TypeError('stable-ID algorithm identity mismatch');
  }
  return STABLE_TEST_ID_ALGORITHM;
}

function normalizeStableTestIds(value) {
  if (!Array.isArray(value) || value.length === 0) {
    throw new TypeError('stable test IDs must be a non-empty array');
  }
  const ids = [];
  const seen = new Set();
  for (const id of value) {
    if (typeof id !== 'string' || !id.includes('::')) {
      throw new TypeError('stable test ID is invalid');
    }
    if (seen.has(id)) throw new TypeError(`duplicate stable test ID: ${id}`);
    seen.add(id);
    ids.push(id);
  }
  const sorted = [...ids].sort();
  if (canonicalJson(ids) !== canonicalJson(sorted)) {
    throw new TypeError('stable test IDs must be sorted canonically');
  }
  return sorted;
}

export { STABLE_TEST_ID_ALGORITHM };

export function validateStableIdCensus(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new TypeError('stable-ID census must be an object');
  }
  if (value.schemaVersion !== 1) throw new TypeError('stable-ID census schemaVersion must be 1');

  const algorithm = validateAlgorithmIdentity(value.algorithm);
  const stableTestIds = normalizeStableTestIds(value.stableTestIds);
  const digest = sha256Canonical(stableTestIds);

  if (value.count !== undefined && value.count !== stableTestIds.length) {
    throw new TypeError(`stable-ID census count mismatch: expected ${stableTestIds.length}, got ${value.count}`);
  }
  if (value.digest !== undefined && exactDigest(value.digest, 'stable-ID census digest') !== digest) {
    throw new TypeError(`stable-ID census digest mismatch: expected ${digest}, got ${String(value.digest).toLowerCase()}`);
  }

  return Object.freeze({
    schemaVersion: 1,
    algorithm,
    count: stableTestIds.length,
    digest,
    stableTestIds: Object.freeze(stableTestIds),
  });
}
