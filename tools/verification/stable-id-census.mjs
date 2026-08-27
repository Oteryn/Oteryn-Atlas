import crypto from 'node:crypto';

import { canonicalJson } from './verification-plan-schema.mjs';
import { stableIdAlgorithm } from './stable-id.mjs';

function digest(value) {
  return `sha256:${crypto.createHash('sha256').update(canonicalJson(value)).digest('hex')}`;
}

export function validateStableIdCensus(value) {
  if (!value || value.schemaVersion !== 1 || value.stableIdAlgorithm?.id !== stableIdAlgorithm.id
    || value.stableIdAlgorithm?.version !== stableIdAlgorithm.version || !Array.isArray(value.stableTestIds)) {
    throw new TypeError('stable census has an invalid schema or algorithm identity');
  }
  const stableTestIds = [...value.stableTestIds];
  if (stableTestIds.length === 0 || stableTestIds.some((id) => typeof id !== 'string' || !id.includes('::'))) {
    throw new TypeError('stable census requires stable test IDs');
  }
  const sorted = [...stableTestIds].sort();
  if (new Set(sorted).size !== sorted.length) throw new TypeError('stable census contains duplicates');
  return Object.freeze({
    schemaVersion: 1,
    stableIdAlgorithm,
    stableTestIds: Object.freeze(sorted),
    digest: digest({ schemaVersion: 1, stableIdAlgorithm, stableTestIds: sorted }),
  });
}
