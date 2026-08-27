import crypto from 'node:crypto';
import fs from 'node:fs';
import { pathToFileURL } from 'node:url';

import { canonicalJson } from './verification-plan-schema.mjs';

function exactSha(value, label) {
  if (typeof value !== 'string' || !/^[a-f0-9]{40}$/i.test(value)) {
    throw new TypeError(`${label} must be an exact 40-character SHA`);
  }
  return value.toLowerCase();
}

function exactDigest(value, label) {
  if (typeof value !== 'string' || !/^sha256:[a-f0-9]{64}$/i.test(value)) {
    throw new TypeError(`${label} must be an exact sha256 digest`);
  }
  return value.toLowerCase();
}

function sha256Bytes(value) {
  return `sha256:${crypto.createHash('sha256').update(value).digest('hex')}`;
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
  return ids.sort();
}

export function validateShadowPlanEvidence({ planRaw, expectedPlanDigest, headSha, stableTestIds }) {
  if (typeof planRaw !== 'string' || planRaw.length === 0) throw new TypeError('planRaw must be non-empty text');
  const expectedDigest = exactDigest(expectedPlanDigest, 'expectedPlanDigest');
  const normalizedHead = exactSha(headSha, 'headSha');
  const actualPlanDigest = sha256Bytes(planRaw);
  if (actualPlanDigest !== expectedDigest) {
    throw new TypeError(`shadow plan artifact digest mismatch: expected ${expectedDigest}, got ${actualPlanDigest}`);
  }

  let plan;
  try {
    plan = JSON.parse(planRaw);
  } catch (error) {
    throw new TypeError(`shadow plan is not valid JSON: ${error.message}`);
  }

  if (plan?.schemaVersion !== 1 || plan?.repository !== 'Oteryn/Oteryn-Atlas') {
    throw new TypeError('shadow plan schema/repository identity is invalid');
  }
  if (String(plan.headSha ?? '').toLowerCase() !== normalizedHead) {
    throw new TypeError('shadow plan headSha does not match exact PR head');
  }
  if (plan.shadowOnly !== true) throw new TypeError('shadow plan must remain shadowOnly');
  if (plan.retryPolicy?.retries !== 0) throw new TypeError('shadow plan retry policy must remain zero');

  const expectedIds = normalizeStableTestIds(stableTestIds);
  const planIds = normalizeStableTestIds(plan.stableTestIds);
  if (canonicalJson(planIds) !== canonicalJson(expectedIds)) {
    throw new TypeError('shadow plan stableTestIds do not exactly match transported census');
  }

  const stableTestIdsDigest = sha256Bytes(canonicalJson(expectedIds));
  if (String(plan.stableTestIdsDigest ?? '').toLowerCase() !== stableTestIdsDigest) {
    throw new TypeError('shadow plan stableTestIdsDigest does not match transported census');
  }

  return Object.freeze({
    status: 'passed',
    headSha: normalizedHead,
    planDigest: actualPlanDigest,
    stableTestIds: Object.freeze(expectedIds),
    stableTestIdsDigest,
  });
}

function parseArgs(argv) {
  if (argv.length !== 8
    || argv[0] !== '--plan'
    || argv[2] !== '--expected-plan-digest'
    || argv[4] !== '--head-sha'
    || argv[6] !== '--stable-test-ids') {
    throw new TypeError('usage: validate-shadow-plan-evidence.mjs --plan <plan.json> --expected-plan-digest <sha256:...> --head-sha <sha> --stable-test-ids <ids.json>');
  }
  return {
    planPath: argv[1],
    expectedPlanDigest: argv[3],
    headSha: argv[5],
    stableTestIdsPath: argv[7],
  };
}

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
  const { planPath, expectedPlanDigest, headSha, stableTestIdsPath } = parseArgs(process.argv.slice(2));
  const result = validateShadowPlanEvidence({
    planRaw: fs.readFileSync(planPath, 'utf8'),
    expectedPlanDigest,
    headSha,
    stableTestIds: JSON.parse(fs.readFileSync(stableTestIdsPath, 'utf8')),
  });
  process.stdout.write(`${JSON.stringify(result)}\n`);
}
