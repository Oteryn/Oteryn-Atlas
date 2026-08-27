import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

import {
  runShadowBacktest,
  validateShadowBacktestCorpus,
} from '../../tools/verification/run-shadow-backtest.mjs';

const A = 'desktop-chromium::e2e/tests/a.spec.mjs::alpha';
const B = 'desktop-chromium::e2e/tests/b.spec.mjs::beta';
const C = 'mobile-chromium::e2e/tests/c.spec.mjs::gamma';
const S = 'desktop-chromium::e2e/tests/fullworld-animation-census-desktop.spec.mjs::published creature animation product passes the full authoritative coverage census';

function baseCorpus(cases) {
  return {
    schemaVersion: 1,
    selectiveExecutionEnabled: false,
    additionalStableTestIds: [S],
    cases,
  };
}

const planInput = {
  repository: 'Oteryn/Oteryn-Atlas',
  headSha: 'a'.repeat(40),
  integrationBaseSha: 'b'.repeat(40),
  mergeBaseSha: 'c'.repeat(40),
};

test('committed corpus is disabled and contains required representative classes with verified PR #88 provenance', () => {
  const corpus = validateShadowBacktestCorpus(JSON.parse(fs.readFileSync('tools/verification/shadow-backtest-corpus.json', 'utf8')));
  assert.equal(corpus.selectiveExecutionEnabled, false);
  const ids = new Set(corpus.cases.map((entry) => entry.id));
  for (const required of [
    'historical-pr-88-runtime-pan-regression',
    'historical-pr-88-complete-diff-governance',
    'rename-source-destination-union',
    'multi-domain-cross-escalation',
    'unknown-runtime-fails-closed',
    'verification-governance-fails-closed',
    'animation-real-fullworld-specialist',
  ]) assert.equal(ids.has(required), true, `missing ${required}`);
  const historical = corpus.cases.find((entry) => entry.id === 'historical-pr-88-runtime-pan-regression');
  assert.equal(historical.provenance.pullRequest, 88);
  assert.equal(historical.provenance.headSha, '03bb3e6cb082dd29dad7261a61e0030e4c846f9d');
  assert.deepEqual(historical.changedFiles, [{ path: 'web/fullworld-creatures.mjs' }]);
  assert.match(historical.truth.stableTestIds[0], /continuous pan$/);
});

test('runner blocks exact selector false negatives and reports over-selection separately', () => {
  const corpus = baseCorpus([{
    id: 'miss',
    provenance: { kind: 'synthetic-regression' },
    changedFiles: [{ path: 'web/example.mjs' }],
    truth: { source: 'explicit', stableTestIds: [B] },
    expectation: {},
  }]);
  const report = runShadowBacktest({
    corpus,
    fullSafeStableTestIds: [A, B, C],
    planInput,
    buildPlan: () => ({
      profile: 'targeted', requiredGroupIds: ['e2e.test'], stableTestIds: [A],
      expectedStableTestIdsDigest: `sha256:${'d'.repeat(64)}`, requiredDataCapabilities: ['qualification_fixture'], requiresRealFullWorld: false,
    }),
  });
  assert.equal(report.status, 'BLOCKED');
  assert.deepEqual(report.cases[0].falseNegativeStableTestIds, [B]);
  assert.deepEqual(report.cases[0].overSelectedStableTestIds, [A]);
});

test('full-safe truth uses exact current hosted safety IDs while explicit specialist IDs remain separate', () => {
  const corpus = baseCorpus([
    {
      id: 'full', provenance: { kind: 'synthetic-governance' }, changedFiles: [{ path: 'tools/verification/x.mjs' }],
      truth: { source: 'full-safe' }, expectation: { profile: 'full', requiresRealFullWorld: false },
    },
    {
      id: 'specialist', provenance: { kind: 'synthetic-specialist' }, changedFiles: [{ path: 'tools/animation-runtime/x.mjs' }],
      truth: { source: 'explicit', stableTestIds: [S] }, expectation: { requiresRealFullWorld: true },
    },
  ]);
  const report = runShadowBacktest({
    corpus,
    fullSafeStableTestIds: [A, B, C],
    planInput,
    buildPlan: ({ changedFiles }) => changedFiles[0].path.startsWith('tools/verification/')
      ? { profile: 'full', requiredGroupIds: ['e2e.full'], stableTestIds: [A, B, C], expectedStableTestIdsDigest: `sha256:${'1'.repeat(64)}`, requiredDataCapabilities: ['qualification_fixture'], requiresRealFullWorld: false }
      : { profile: 'broad', requiredGroupIds: ['e2e.full', 'fullworld.animation-census'], stableTestIds: [A, B, C, S], expectedStableTestIdsDigest: `sha256:${'2'.repeat(64)}`, requiredDataCapabilities: ['qualification_fixture', 'real_fullworld'], requiresRealFullWorld: true },
  });
  assert.equal(report.status, 'SAFE');
  assert.equal(report.cases[0].selectionStatus, 'SAFE');
  assert.deepEqual(report.cases[0].falseNegativeStableTestIds, []);
  assert.equal(report.cases[1].selectionStatus, 'SAFE');
  assert.deepEqual(report.cases[1].allowedAdditionalStableTestIds, [S]);
});

test('corpus cannot activate selective execution or duplicate case identities', () => {
  assert.throws(() => validateShadowBacktestCorpus({ ...baseCorpus([]), selectiveExecutionEnabled: true }), /must remain false/);
  assert.throws(() => validateShadowBacktestCorpus(baseCorpus([
    { id: 'dup', provenance: { kind: 'x' }, changedFiles: [{ path: 'a' }], truth: { source: 'full-safe' }, expectation: {} },
    { id: 'dup', provenance: { kind: 'y' }, changedFiles: [{ path: 'b' }], truth: { source: 'full-safe' }, expectation: {} },
  ])), /duplicate case id/);
});
