import crypto from 'node:crypto';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

const CONTROLLER = Object.freeze({ id: 'atlas-protected-controller-bootstrap-v1', version: 1 });
const SHA = /^[a-f0-9]{40}$/;

function canonicalJson(value) {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonicalJson(value[key])}`).join(',')}}`;
  }
  return JSON.stringify(value);
}

function digest(value) {
  return `sha256:${crypto.createHash('sha256').update(canonicalJson(value)).digest('hex')}`;
}

function exactSha(value, label) {
  if (typeof value !== 'string' || !SHA.test(value)) throw new TypeError(`${label} must be an exact lowercase 40-character SHA`);
  return value;
}

function safePath(value) {
  return typeof value === 'string' && value.length > 0 && !value.startsWith('/') && !value.includes('\\')
    && !value.includes('//') && !value.split('/').some((part) => part === '.' || part === '..' || part === '');
}

function normalizeChangedFiles(value) {
  if (!Array.isArray(value) || value.length === 0) throw new TypeError('changedFiles must be a non-empty array');
  const paths = [];
  for (const item of value) {
    if (!item || typeof item !== 'object' || !safePath(item.path)
      || (item.previousPath != null && !safePath(item.previousPath))) {
      throw new TypeError('changedFiles contains malformed or unsafe evidence');
    }
    paths.push(item.path);
    if (item.previousPath) paths.push(item.previousPath);
  }
  return [...new Set(paths)].sort();
}

function normalizeStableIds(value) {
  if (!Array.isArray(value) || value.length === 0 || value.some((id) => typeof id !== 'string' || !id.includes('::'))) {
    throw new TypeError('stableTestIds must be a non-empty array of stable IDs');
  }
  const sorted = [...value].sort();
  if (new Set(sorted).size !== sorted.length) throw new TypeError('stableTestIds must not contain duplicates');
  return sorted;
}

function freeze(value) {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    for (const child of Object.values(value)) freeze(child);
    Object.freeze(value);
  }
  return value;
}

export function buildProtectedBootstrapPlan(input) {
  if (!input || input.repository !== 'Oteryn/Oteryn-Atlas') throw new TypeError('repository must be Oteryn/Oteryn-Atlas');
  if (!Number.isSafeInteger(Number(input.prNumber)) || Number(input.prNumber) < 1) throw new TypeError('prNumber must be a positive integer');
  const protectedBaseSha = exactSha(input.protectedBaseSha, 'protectedBaseSha');
  const candidateHeadSha = exactSha(input.candidateHeadSha, 'candidateHeadSha');
  const mergeBaseSha = exactSha(input.mergeBaseSha, 'mergeBaseSha');
  const changedPaths = normalizeChangedFiles(input.changedFiles);
  const stableTestIds = normalizeStableIds(input.stableTestIds);
  const expectedStableTestIdsDigest = digest(stableTestIds);
  const core = {
    schemaVersion: 1,
    controller: { ...CONTROLLER, sourceSha: protectedBaseSha },
    repository: input.repository,
    prNumber: Number(input.prNumber),
    protectedBaseSha,
    candidateHeadSha,
    mergeBaseSha,
    changedPaths,
    changedPathsDigest: digest(changedPaths),
    profile: 'full',
    requiredGroupIds: ['deterministic.core', 'e2e.full'],
    stableTestIds,
    expectedStableTestIdsDigest,
    retryPolicy: { retries: 0 },
    selectiveExecution: false,
    lowerBoundMode: 'protected-base-full-safe-bootstrap',
  };
  return freeze({ ...core, planDigest: digest(core) });
}

function parseArgs(argv) {
  if (argv.length % 2 !== 0) throw new TypeError('controller CLI requires --flag value pairs');
  const out = {};
  for (let index = 0; index < argv.length; index += 2) {
    const flag = argv[index];
    const value = argv[index + 1];
    if (!flag?.startsWith('--') || value == null || Object.hasOwn(out, flag)) throw new TypeError('controller CLI arguments are invalid');
    out[flag] = value;
  }
  return out;
}

function readJson(pathname, label) {
  try { return JSON.parse(fs.readFileSync(pathname, 'utf8')); }
  catch (error) { throw new TypeError(`cannot read ${label}: ${error.message}`); }
}

function main(argv) {
  const args = parseArgs(argv);
  const required = ['--repository', '--pr-number', '--protected-base-sha', '--candidate-head-sha', '--merge-base-sha', '--changed-files', '--stable-test-ids'];
  if (required.some((flag) => !Object.hasOwn(args, flag))) throw new TypeError(`missing required controller argument: ${required.find((flag) => !Object.hasOwn(args, flag))}`);
  const plan = buildProtectedBootstrapPlan({
    repository: args['--repository'],
    prNumber: Number(args['--pr-number']),
    protectedBaseSha: args['--protected-base-sha'],
    candidateHeadSha: args['--candidate-head-sha'],
    mergeBaseSha: args['--merge-base-sha'],
    changedFiles: readJson(args['--changed-files'], 'changed files'),
    stableTestIds: readJson(args['--stable-test-ids'], 'stable test IDs'),
  });
  process.stdout.write(`${JSON.stringify(plan)}\n`);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  try { main(process.argv.slice(2)); }
  catch (error) { process.stderr.write(`${error.message}\n`); process.exitCode = 1; }
}
