import crypto from 'node:crypto';
import fs from 'node:fs';
import { pathToFileURL } from 'node:url';

import { canonicalJson } from './verification-plan-schema.mjs';

const PINNED_BROWSER_CONTAINER = 'mcr.microsoft.com/playwright:v1.62.0-noble@sha256:baed2032d533817f3dbe6425de795788430ba345e819a1201337009ba17c9d07';
const ATLAS_REPOSITORY = 'Oteryn/Oteryn-Atlas';
const SHA256 = /^sha256:[a-f0-9]{64}$/;

function validSha(value) {
  return typeof value === 'string' && /^[a-f0-9]{40}$/i.test(value);
}

function validDigest(value) {
  return typeof value === 'string' && SHA256.test(value);
}

function stableTestIdsDigest(value) {
  return `sha256:${crypto.createHash('sha256').update(canonicalJson(value)).digest('hex')}`;
}

function normalizeExpectedStableTestIds(value) {
  if (!Array.isArray(value) || value.length === 0) throw new TypeError('expected stable test IDs must be a non-empty array');
  const ids = [];
  const seen = new Set();
  for (const id of value) {
    if (typeof id !== 'string' || !id.includes('::')) throw new TypeError('expected stableTestId is invalid');
    if (seen.has(id)) throw new TypeError(`duplicate expected stableTestId: ${id}`);
    seen.add(id);
    ids.push(id);
  }
  return ids.sort();
}

function boundedList(values) {
  return values.slice(0, 8).join(', ');
}

function validatePublicationReadiness(readiness, { headSha, planDigest }) {
  if (!readiness || typeof readiness !== 'object' || readiness.complete !== true) {
    throw new TypeError('validated immutable publication readiness is required');
  }
  if (readiness.repository !== ATLAS_REPOSITORY) throw new TypeError('publication readiness repository mismatch');
  if (readiness.candidateSha !== headSha) throw new TypeError('publication readiness candidate SHA mismatch');
  if (readiness.planDigest !== planDigest) throw new TypeError('publication readiness plan digest mismatch');
  if (readiness.browserImage !== PINNED_BROWSER_CONTAINER) throw new TypeError('publication readiness browser image mismatch');
  if (!validDigest(readiness.publicationRoot)) throw new TypeError('publication readiness root digest is invalid');
  if (!validDigest(readiness.treeDigest)) throw new TypeError('publication readiness tree digest is invalid');
  if (!Number.isSafeInteger(readiness.fileCount) || readiness.fileCount <= 0) throw new TypeError('publication readiness file count is invalid');
  if (!Number.isSafeInteger(readiness.bytes) || readiness.bytes <= 0) throw new TypeError('publication readiness byte size is invalid');
  if (typeof readiness.producer?.runId !== 'string' || readiness.producer.runId.length === 0) throw new TypeError('publication readiness producer run id is invalid');
  if (!Number.isSafeInteger(readiness.producer?.runAttempt) || readiness.producer.runAttempt <= 0) throw new TypeError('publication readiness producer run attempt is invalid');
  if (!Number.isFinite(Date.parse(readiness.createdAt))) throw new TypeError('publication readiness createdAt is invalid');
  return readiness;
}

export function validateGithubHostedE2eSummary(summary, {
  headSha,
  workers,
  expectedStableTestIds,
  planDigest,
  publicationReadiness,
}) {
  if (!validSha(headSha)) throw new TypeError('headSha must be an exact 40-character SHA');
  if (!Number.isSafeInteger(workers) || workers < 1) throw new TypeError('workers must be a positive integer');
  if (!validDigest(planDigest)) throw new TypeError('verification plan digest must be sha256:<64 lowercase hex>');
  const expectedIds = normalizeExpectedStableTestIds(expectedStableTestIds);
  const readiness = validatePublicationReadiness(publicationReadiness, { headSha, planDigest });
  if (!summary || summary.status !== 'passed') throw new TypeError('GitHub-hosted Playwright summary is not passed');
  if (summary.metadata?.expectedRevision !== headSha) throw new TypeError('summary expectedRevision does not match exact PR head');
  if (summary.metadata?.targetMode !== 'checkout-overlay') throw new TypeError('ordinary GitHub-hosted E2E must use checkout-overlay mode with immutable publication readiness');
  if (typeof summary.metadata?.publicationOrigin !== 'string' || summary.metadata.publicationOrigin.trim().length === 0) {
    throw new TypeError('ordinary GitHub-hosted E2E publication origin is missing');
  }
  if (summary.metadata?.verificationPlanSha256 !== planDigest) throw new TypeError('summary verification plan digest mismatch');
  if (summary.metadata?.browserContainer !== PINNED_BROWSER_CONTAINER) throw new TypeError('browser container identity is not the pinned repository image');
  if (Number(summary.metadata?.workers) !== workers) throw new TypeError('summary worker count does not match the requested GitHub-hosted worker count');
  if (!Array.isArray(summary.scenarios) || summary.scenarios.length === 0) throw new TypeError('Playwright summary has no scenarios');

  const stableIds = new Set();
  for (const scenario of summary.scenarios) {
    if (scenario?.status !== 'passed') throw new TypeError(`scenario ${scenario?.stableTestId ?? 'unknown'} is not passed`);
    if (Number(scenario?.retry) !== 0) throw new TypeError(`scenario ${scenario?.stableTestId ?? 'unknown'} was retried`);
    if (typeof scenario?.stableTestId !== 'string' || !scenario.stableTestId.includes('::')) throw new TypeError('scenario stableTestId is missing');
    if (stableIds.has(scenario.stableTestId)) throw new TypeError(`duplicate scenario stableTestId: ${scenario.stableTestId}`);
    stableIds.add(scenario.stableTestId);
  }

  const actualIds = [...stableIds].sort();
  const expected = new Set(expectedIds);
  const missing = expectedIds.filter((id) => !stableIds.has(id));
  if (missing.length > 0) throw new TypeError(`missing stable test IDs (${missing.length}): ${boundedList(missing)}`);
  const unexpected = actualIds.filter((id) => !expected.has(id));
  if (unexpected.length > 0) throw new TypeError(`unexpected stable test IDs (${unexpected.length}): ${boundedList(unexpected)}`);

  return Object.freeze({
    status: 'passed',
    headSha,
    workers,
    scenarioCount: summary.scenarios.length,
    stableTestIds: Object.freeze(actualIds),
    stableTestIdsDigest: stableTestIdsDigest(actualIds),
    browserContainer: PINNED_BROWSER_CONTAINER,
    planDigest,
    publicationRoot: readiness.publicationRoot,
    publicationTreeDigest: readiness.treeDigest,
    publicationFileCount: readiness.fileCount,
    publicationBytes: readiness.bytes,
  });
}

function parseArgs(argv) {
  if (argv.length !== 12
    || argv[0] !== '--summary'
    || argv[2] !== '--head-sha'
    || argv[4] !== '--workers'
    || argv[6] !== '--expected-stable-test-ids'
    || argv[8] !== '--plan-digest'
    || argv[10] !== '--publication-readiness') {
    throw new TypeError('usage: validate-github-hosted-e2e.mjs --summary <summary.json> --head-sha <sha> --workers <n> --expected-stable-test-ids <ids.json> --plan-digest <sha256:...> --publication-readiness <readiness.json>');
  }
  const workers = Number(argv[5]);
  if (!Number.isSafeInteger(workers) || workers < 1) throw new TypeError('workers must be a positive integer');
  return {
    summaryPath: argv[1],
    headSha: argv[3],
    workers,
    expectedStableTestIdsPath: argv[7],
    planDigest: argv[9],
    publicationReadinessPath: argv[11],
  };
}

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
  const {
    summaryPath,
    headSha,
    workers,
    expectedStableTestIdsPath,
    planDigest,
    publicationReadinessPath,
  } = parseArgs(process.argv.slice(2));
  const summary = JSON.parse(fs.readFileSync(summaryPath, 'utf8'));
  const expectedStableTestIds = JSON.parse(fs.readFileSync(expectedStableTestIdsPath, 'utf8'));
  const publicationReadiness = JSON.parse(fs.readFileSync(publicationReadinessPath, 'utf8'));
  process.stdout.write(`${JSON.stringify(validateGithubHostedE2eSummary(summary, {
    headSha,
    workers,
    expectedStableTestIds,
    planDigest,
    publicationReadiness,
  }))}\n`);
}
