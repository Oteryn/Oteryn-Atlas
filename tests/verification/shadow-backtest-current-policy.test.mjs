import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

import { buildVerificationPlan } from '../../tools/verification/build-verification-plan.mjs';
import { runShadowBacktest } from '../../tools/verification/run-shadow-backtest.mjs';

const BASE = 'd3eaf133a4835e3b9f21eb7ba56fe699db38740b';
const read = (path) => JSON.parse(fs.readFileSync(path, 'utf8'));

test('current protected-policy interface passes the committed Phase F shadow corpus without unexplained false negatives', () => {
  const corpus = read('tools/verification/shadow-backtest-corpus.json');
  const fullSafe = read('tools/verification/full-safety-net-stable-ids.json');
  const impactManifest = read('tools/verification/impact-manifest.json');
  const verificationCatalog = read('tools/verification/verification-catalog.json');

  const report = runShadowBacktest({
    corpus,
    fullSafeStableTestIds: fullSafe.stableTestIds,
    planInput: {
      repository: 'Oteryn/Oteryn-Atlas',
      headSha: BASE,
      integrationBaseSha: BASE,
      mergeBaseSha: BASE,
      trustedImpactManifest: impactManifest,
      candidateImpactManifest: impactManifest,
      trustedVerificationCatalog: verificationCatalog,
      candidateVerificationCatalog: verificationCatalog,
    },
    buildPlan: buildVerificationPlan,
  });

  const blocked = report.cases.filter((entry) => entry.status !== 'SAFE');
  assert.equal(report.selectiveExecutionEnabled, false);
  assert.equal(report.status, 'SAFE', JSON.stringify(blocked, null, 2));
  assert.deepEqual(blocked, []);
  assert.equal(report.cases.find((entry) => entry.id === 'verification-governance-fails-closed').profile, 'full');
  assert.equal(report.cases.find((entry) => entry.id === 'verification-governance-fails-closed').requiresRealFullWorld, false);
  assert.equal(report.cases.find((entry) => entry.id === 'animation-real-fullworld-specialist').requiresRealFullWorld, true);
});
