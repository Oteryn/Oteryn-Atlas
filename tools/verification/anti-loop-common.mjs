import crypto from 'node:crypto';

import { canonicalJson } from './verification-plan-schema.mjs';

export const SHA_PATTERN = /^[a-f0-9]{40}$/;
export const DIGEST_PATTERN = /^sha256:[a-f0-9]{64}$/;
export const SAFE_IDENTIFIER_PATTERN = /^[A-Za-z][A-Za-z0-9_.-]*$/;

export function isPlainObject(value) {
  return value != null && typeof value === 'object' && !Array.isArray(value);
}

export function deepFreeze(value) {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    for (const child of Object.values(value)) deepFreeze(child);
    Object.freeze(value);
  }
  return value;
}

export function canonicalDigest(value) {
  return `sha256:${crypto.createHash('sha256').update(canonicalJson(value)).digest('hex')}`;
}

export function bytesDigest(value) {
  if (!(typeof value === 'string' || Buffer.isBuffer(value) || value instanceof Uint8Array)) {
    throw new TypeError('digest input must be bytes or a string');
  }
  return `sha256:${crypto.createHash('sha256').update(value).digest('hex')}`;
}

export function exactSha(value, label = 'SHA') {
  if (typeof value !== 'string' || !SHA_PATTERN.test(value)) {
    throw new TypeError(`${label} must be an exact lowercase 40-character SHA`);
  }
  return value;
}

export function exactDigest(value, label = 'digest') {
  if (typeof value !== 'string' || !DIGEST_PATTERN.test(value)) {
    throw new TypeError(`${label} must be sha256:<64 lowercase hex>`);
  }
  return value;
}

export function nonEmptyString(value, label) {
  if (typeof value !== 'string' || value.length === 0) throw new TypeError(`${label} must be non-empty`);
  return value;
}

export function sortedUniqueStrings(values, label, { allowEmpty = true, validate } = {}) {
  if (!Array.isArray(values) || (!allowEmpty && values.length === 0)) {
    throw new TypeError(`${label} must be ${allowEmpty ? 'an' : 'a non-empty'} array`);
  }
  const normalized = values.map((value) => {
    if (typeof value !== 'string' || value.length === 0) throw new TypeError(`${label} must contain non-empty strings`);
    if (validate && !validate(value)) throw new TypeError(`${label} contains an invalid value: ${value}`);
    return value;
  });
  if (new Set(normalized).size !== normalized.length) throw new TypeError(`${label} contains duplicate values`);
  return normalized.sort();
}

export function safeRepositoryPath(value, { allowDirectory = true } = {}) {
  if (typeof value !== 'string' || value.length === 0 || value.startsWith('/') || value.includes('\\') || value.includes('//')) {
    return false;
  }
  if (!allowDirectory && value.endsWith('/')) return false;
  const normalized = value.endsWith('/') ? value.slice(0, -1) : value;
  const parts = normalized.split('/');
  if (parts.some((part) => part === '' || part === '.' || part === '..')) return false;
  return /^[A-Za-z0-9_.@*+-]+(?:\/[A-Za-z0-9_.@*+-]+)*$/.test(normalized);
}

export function stableId(value) {
  return typeof value === 'string' && value.length > 0 && value.split('::').length >= 3;
}

export function cloneJson(value) {
  return JSON.parse(JSON.stringify(value));
}
