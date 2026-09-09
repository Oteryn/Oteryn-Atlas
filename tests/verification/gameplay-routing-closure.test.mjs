import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import { buildVerificationPlan } from '../../tools/verification/build-verification-plan.mjs';

const catalog = JSON.parse(fs.readFileSync(new URL('../../tools/verification/verification-catalog.json', import.meta.url)));
const impact = JSON.parse(fs.readFileSync(new URL('../../tools/verification/impact-manifest.json', import.meta.url)));
const runtime = 'src/browser/creature-gameplay-profiles.mjs';
const source = 'e2e/tests/creature-gameplay-source-contract-desktop.spec.mjs';
const plan = (changedFiles, candidateImpactManifest = impact) => buildVerificationPlan({
  repository: 'Oteryn/Oteryn-Atlas', headSha: 'a'.repeat(40), integrationBaseSha: 'b'.repeat(40), mergeBaseSha: 'c'.repeat(40),
  changedFiles, verificationCatalog: catalog, trustedImpactManifest: impact, candidateImpactManifest,
});

test('gameplay profile preserves functional and bounded proof without FullWorld', () => {
  const path = runtime;
  const result = plan([{ path }]);
  assert(result.requiredGroupIds.includes('integration.source-contract-http'));
  assert(result.requiredGroupIds.includes('e2e.creature-gameplay'));
  assert.equal(result.requiresRealFullWorld, false);
  assert.deepEqual(result.requiredDataCapabilities, ['bounded_real_world', 'qualification_fixture']);
  assert(result.groups.find(g => g.id === 'integration.source-contract-http').specs.includes(source));
});

test('gameplay binding preserves overlapping protected smoke and visual obligations', () => {
  const result = plan([{ path: runtime }]);
  assert(result.requiredGroupIds.includes('e2e.common-smoke'));
  assert(result.requiredVisualGroupIds.includes('review.creature-gameplay-desktop'));
});

test('unrelated creature interaction does not request bounded real gameplay sources', () => {
  const result = plan([{ path: 'src/browser/creature-interaction.mjs' }]);
  assert(!result.requiredGroupIds.includes('integration.source-contract-http'));
  assert.equal(result.requiresRealFullWorld, false);
});

test('candidate metadata cannot remove the protected gameplay binding', () => {
  const candidate = structuredClone(impact);
  candidate.entries = candidate.entries.filter(entry => entry.pathPrefix !== runtime && entry.pathPrefix !== source);
  const result = plan([{ path: runtime }], candidate);
  assert(result.requiredGroupIds.includes('integration.source-contract-http'));
});

test('rename-source gameplay ownership survives moves into documentation', () => {
  const result = plan([{ path: 'docs/moved-gameplay.md', previousPath: runtime }]);
  assert(result.requiredGroupIds.includes('integration.source-contract-http'));
  assert(result.requiredGroupIds.includes('e2e.creature-gameplay'));
});

test('equivalent PR and MQ changed paths retain semantic obligations', () => {
  const pr = plan([{ path: runtime }, { path: source }]);
  const mq = plan([{ path: source }, { path: runtime }]);
  for (const key of ['requiredGroupIds', 'requiredDataCapabilities', 'requiredVisualGroupIds']) assert.deepEqual(pr[key], mq[key]);
});

test('source-contract test selects its exact HTTP owner without unrelated browser work', () => {
  const result=plan([{path:source}]);
  assert.deepEqual(result.requiredGroupIds,['integration.source-contract-http']);
  assert.deepEqual(result.requiredDataCapabilities,['bounded_real_world']);
  assert.equal(result.requiresRealFullWorld,false);
});
