import crypto from 'node:crypto';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

import { evaluateStableIdSelection } from './shadow-backtest.mjs';

const PROFILES = new Set(['none', 'focused', 'targeted', 'broad', 'full']);
const SHA = /^[a-f0-9]{40}$/;

function canonical(value) {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonical(value[key])}`).join(',')}}`;
  }
  return JSON.stringify(value);
}

function digest(value) {
  return `sha256:${crypto.createHash('sha256').update(canonical(value)).digest('hex')}`;
}

function stableIds(value, label, { allowEmpty = true } = {}) {
  if (!Array.isArray(value) || (!allowEmpty && value.length === 0)) {
    throw new TypeError(`${label} must be a ${allowEmpty ? '' : 'non-empty '}array of stable IDs`);
  }
  const seen = new Set();
  const ids = [];
  for (const id of value) {
    if (typeof id !== 'string' || !id.includes('::')) throw new TypeError(`${label} must contain stable IDs`);
    if (seen.has(id)) throw new TypeError(`${label} contains duplicate stable ID: ${id}`);
    seen.add(id);
    ids.push(id);
  }
  return ids.sort();
}

function validateChangedFiles(value, caseId) {
  if (!Array.isArray(value) || value.length === 0) throw new TypeError(`case ${caseId} changedFiles must be non-empty`);
  return value.map((item) => {
    if (!item || typeof item !== 'object' || Array.isArray(item) || typeof item.path !== 'string' || item.path.length === 0) {
      throw new TypeError(`case ${caseId} changedFiles entries require path`);
    }
    if (item.previousPath != null && (typeof item.previousPath !== 'string' || item.previousPath.length === 0)) {
      throw new TypeError(`case ${caseId} previousPath must be a non-empty string`);
    }
    return Object.freeze(item.previousPath ? { path: item.path, previousPath: item.previousPath } : { path: item.path });
  });
}

function validateProvenance(value, caseId) {
  if (!value || typeof value !== 'object' || Array.isArray(value) || typeof value.kind !== 'string' || value.kind.length === 0) {
    throw new TypeError(`case ${caseId} provenance.kind is required`);
  }
  if (value.pullRequest != null && (!Number.isSafeInteger(value.pullRequest) || value.pullRequest < 1)) {
    throw new TypeError(`case ${caseId} provenance.pullRequest must be a positive integer`);
  }
  if (value.headSha != null && !SHA.test(value.headSha)) throw new TypeError(`case ${caseId} provenance.headSha must be an exact lowercase SHA`);
  return Object.freeze({ ...value });
}

function validateTruth(value, caseId) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new TypeError(`case ${caseId} truth must be an object`);
  if (value.source === 'full-safe') return Object.freeze({ source: 'full-safe' });
  if (value.source !== 'explicit') throw new TypeError(`case ${caseId} truth.source must be full-safe or explicit`);
  return Object.freeze({ source: 'explicit', stableTestIds: Object.freeze(stableIds(value.stableTestIds, `case ${caseId} truth.stableTestIds`, { allowEmpty: false })) });
}

function validateExpectation(value, caseId) {
  if (value == null) return Object.freeze({});
  if (typeof value !== 'object' || Array.isArray(value)) throw new TypeError(`case ${caseId} expectation must be an object`);
  const result = {};
  if (value.profile != null) {
    if (!PROFILES.has(value.profile)) throw new TypeError(`case ${caseId} expectation.profile is invalid`);
    result.profile = value.profile;
  }
  if (value.requiresRealFullWorld != null) {
    if (typeof value.requiresRealFullWorld !== 'boolean') throw new TypeError(`case ${caseId} expectation.requiresRealFullWorld must be boolean`);
    result.requiresRealFullWorld = value.requiresRealFullWorld;
  }
  if (value.requiredGroupIdsContain != null) {
    if (!Array.isArray(value.requiredGroupIdsContain) || value.requiredGroupIdsContain.some((id) => typeof id !== 'string' || !id)) {
      throw new TypeError(`case ${caseId} expectation.requiredGroupIdsContain must be string IDs`);
    }
    result.requiredGroupIdsContain = [...new Set(value.requiredGroupIdsContain)].sort();
  }
  return Object.freeze(result);
}

export function validateShadowBacktestCorpus(corpus) {
  if (!corpus || typeof corpus !== 'object' || Array.isArray(corpus)) throw new TypeError('shadow backtest corpus must be an object');
  if (corpus.schemaVersion !== 1) throw new TypeError('shadow backtest corpus schemaVersion must be 1');
  if (corpus.selectiveExecutionEnabled !== false) throw new TypeError('shadow backtest corpus selectiveExecutionEnabled must remain false');
  const additionalStableTestIds = stableIds(corpus.additionalStableTestIds ?? [], 'additionalStableTestIds');
  if (!Array.isArray(corpus.cases) || corpus.cases.length === 0) throw new TypeError('shadow backtest corpus cases must be non-empty');
  const ids = new Set();
  const cases = corpus.cases.map((entry) => {
    if (!entry || typeof entry !== 'object' || Array.isArray(entry) || typeof entry.id !== 'string' || entry.id.length === 0) {
      throw new TypeError('shadow backtest case id is required');
    }
    if (ids.has(entry.id)) throw new TypeError(`shadow backtest corpus duplicate case id: ${entry.id}`);
    ids.add(entry.id);
    return Object.freeze({
      id: entry.id,
      provenance: validateProvenance(entry.provenance, entry.id),
      changedFiles: Object.freeze(validateChangedFiles(entry.changedFiles, entry.id)),
      truth: validateTruth(entry.truth, entry.id),
      expectation: validateExpectation(entry.expectation, entry.id),
    });
  });
  return Object.freeze({
    schemaVersion: 1,
    selectiveExecutionEnabled: false,
    additionalStableTestIds: Object.freeze(additionalStableTestIds),
    cases: Object.freeze(cases),
  });
}

function planExpectationFailures(plan, expectation) {
  const failures = [];
  if (expectation.profile != null && plan.profile !== expectation.profile) failures.push(`profile expected ${expectation.profile}, got ${plan.profile ?? 'missing'}`);
  if (expectation.requiresRealFullWorld != null && plan.requiresRealFullWorld !== expectation.requiresRealFullWorld) {
    failures.push(`requiresRealFullWorld expected ${expectation.requiresRealFullWorld}, got ${plan.requiresRealFullWorld ?? 'missing'}`);
  }
  for (const id of expectation.requiredGroupIdsContain ?? []) {
    if (!Array.isArray(plan.requiredGroupIds) || !plan.requiredGroupIds.includes(id)) failures.push(`required group missing: ${id}`);
  }
  return failures;
}

export function runShadowBacktest({ corpus, fullSafeStableTestIds, planInput, buildPlan } = {}) {
  const validated = validateShadowBacktestCorpus(corpus);
  const fullSafe = stableIds(fullSafeStableTestIds, 'fullSafeStableTestIds', { allowEmpty: false });
  if (!planInput || typeof planInput !== 'object' || Array.isArray(planInput)) throw new TypeError('planInput must be an object');
  if (typeof buildPlan !== 'function') throw new TypeError('buildPlan must be a function');
  const protectedStableTestIds = [...new Set([...fullSafe, ...validated.additionalStableTestIds])].sort();

  const caseReports = validated.cases.map((entry) => {
    const plan = buildPlan({ ...planInput, changedFiles: entry.changedFiles, protectedStableTestIds });
    if (!plan || typeof plan !== 'object' || !Array.isArray(plan.stableTestIds)) throw new TypeError(`case ${entry.id} planner returned an invalid plan`);
    const truth = entry.truth.source === 'full-safe' ? fullSafe : entry.truth.stableTestIds;
    const selection = evaluateStableIdSelection({
      selectedStableTestIds: plan.stableTestIds,
      requiredTruthStableTestIds: truth,
      fullSafeStableTestIds: fullSafe,
      allowedAdditionalStableTestIds: validated.additionalStableTestIds,
    });
    const expectationFailures = planExpectationFailures(plan, entry.expectation);
    const status = selection.status === 'SAFE' && expectationFailures.length === 0 ? 'SAFE' : 'BLOCKED';
    return Object.freeze({
      id: entry.id,
      status,
      provenance: entry.provenance,
      changedFiles: entry.changedFiles,
      truthSource: entry.truth.source,
      profile: plan.profile,
      requiredGroupIds: Object.freeze([...(plan.requiredGroupIds ?? [])].sort()),
      requiredDataCapabilities: Object.freeze([...(plan.requiredDataCapabilities ?? [])].sort()),
      requiresRealFullWorld: Boolean(plan.requiresRealFullWorld),
      planExpectedStableTestIdsDigest: plan.expectedStableTestIdsDigest ?? null,
      selectedStableTestIds: selection.selectedStableTestIds,
      fullSafeStableTestIds: selection.fullSafeStableTestIds,
      allowedAdditionalStableTestIds: selection.allowedAdditionalStableTestIds,
      requiredTruthStableTestIds: selection.requiredTruthStableTestIds,
      selectionStatus: selection.status,
      falseNegativeStableTestIds: selection.falseNegativeStableTestIds,
      overSelectedStableTestIds: selection.overSelectedStableTestIds,
      expectationFailures: Object.freeze(expectationFailures),
    });
  });

  return Object.freeze({
    schemaVersion: 1,
    mode: 'SHADOW_BACKTEST',
    selectiveExecutionEnabled: false,
    status: caseReports.every((entry) => entry.status === 'SAFE') ? 'SAFE' : 'BLOCKED',
    fullSafeStableTestIdsDigest: digest(fullSafe),
    additionalStableTestIdsDigest: digest(validated.additionalStableTestIds),
    planIdentity: Object.freeze({
      repository: planInput.repository ?? null,
      headSha: planInput.headSha ?? null,
      integrationBaseSha: planInput.integrationBaseSha ?? null,
      mergeBaseSha: planInput.mergeBaseSha ?? null,
    }),
    cases: Object.freeze(caseReports),
  });
}

function parseArgs(argv) {
  const args = {};
  for (let index = 0; index < argv.length; index += 2) {
    const flag = argv[index];
    const value = argv[index + 1];
    if (!flag?.startsWith('--') || value == null || Object.hasOwn(args, flag)) throw new TypeError('shadow backtest CLI requires unique --flag value pairs');
    args[flag] = value;
  }
  return args;
}

function readJson(pathname, label) {
  try { return JSON.parse(fs.readFileSync(pathname, 'utf8')); }
  catch (error) { throw new TypeError(`cannot read ${label}: ${error.message}`); }
}

async function runCli() {
  const args = parseArgs(process.argv.slice(2));
  for (const required of ['--head-sha', '--integration-base-sha', '--merge-base-sha']) {
    if (!Object.hasOwn(args, required)) throw new TypeError(`shadow backtest CLI requires ${required}`);
  }
  const paths = {
    corpus: args['--corpus'] ?? 'tools/verification/shadow-backtest-corpus.json',
    fullSafe: args['--full-safe'] ?? 'tools/verification/full-safety-net-stable-ids.json',
    trustedImpact: args['--trusted-impact'] ?? 'tools/verification/impact-manifest.json',
    candidateImpact: args['--candidate-impact'] ?? args['--trusted-impact'] ?? 'tools/verification/impact-manifest.json',
    trustedCatalog: args['--trusted-catalog'] ?? 'tools/verification/verification-catalog.json',
    candidateCatalog: args['--candidate-catalog'] ?? args['--trusted-catalog'] ?? 'tools/verification/verification-catalog.json',
  };
  const corpus = readJson(paths.corpus, 'shadow backtest corpus');
  const fullSafeDocument = readJson(paths.fullSafe, 'full safety stable IDs');
  const trustedImpactManifest = readJson(paths.trustedImpact, 'trusted impact manifest');
  const candidateImpactManifest = readJson(paths.candidateImpact, 'candidate impact manifest');
  const trustedVerificationCatalog = readJson(paths.trustedCatalog, 'trusted verification catalog');
  const candidateVerificationCatalog = readJson(paths.candidateCatalog, 'candidate verification catalog');
  const { buildVerificationPlan } = await import('./build-verification-plan.mjs');
  const report = runShadowBacktest({
    corpus,
    fullSafeStableTestIds: fullSafeDocument.stableTestIds,
    planInput: {
      repository: 'Oteryn/Oteryn-Atlas',
      headSha: args['--head-sha'],
      integrationBaseSha: args['--integration-base-sha'],
      mergeBaseSha: args['--merge-base-sha'],
      trustedImpactManifest,
      candidateImpactManifest,
      trustedVerificationCatalog,
      candidateVerificationCatalog,
    },
    buildPlan: buildVerificationPlan,
  });
  process.stdout.write(`${JSON.stringify(report)}\n`);
  if (report.status !== 'SAFE') process.exitCode = 1;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  runCli().catch((error) => {
    process.stderr.write(`${error.message}\n`);
    process.exitCode = 1;
  });
}
