import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import { buildVerificationPlan } from '../../tools/verification/build-verification-plan.mjs';
const read = name => JSON.parse(fs.readFileSync(new URL(`../../tools/verification/${name}.json`, import.meta.url)));
const catalog = read('verification-catalog');
const impact = read('impact-manifest');
const ownership = read('deterministic-test-ownership');
const plan = paths => buildVerificationPlan({ repository: 'Oteryn/Oteryn-Atlas', headSha: 'a'.repeat(40), integrationBaseSha: 'b'.repeat(40), mergeBaseSha: 'c'.repeat(40), changedFiles: paths.map(path => ({path})), verificationCatalog: catalog, trustedImpactManifest: impact, candidateImpactManifest: impact });
test('every deterministic product test selects its exact semantic owner', () => {
  for (const row of ownership.entries) {
    const result = plan([row.spec]);
    assert(result.requiredGroupIds.includes(row.group), `${row.spec} omits ${row.group}`);
    assert(catalog.groups[row.group].specs.includes(row.spec));
    assert(!result.executionBlockers.some(x => x.reason === 'unowned-test'));
  }
});
test('unrelated deterministic test changes do not select other semantic owners', () => {
  assert.deepEqual(plan(['tests/semantic-search.mjs']).requiredGroupIds, ['deterministic.search']);
  assert.deepEqual(plan(['tests/creature-gameplay-model.mjs']).requiredGroupIds, ['deterministic.gameplay']);
  assert.deepEqual(plan(['docs/example.md']).requiredGroupIds, []);
});
test('governance and unknown changes widen to every declared deterministic safety-net owner', () => {
  for (const changed of ['tools/verification/verification-catalog.json', 'unclassified/new-product.mjs']) {
    const result = plan([changed]);
    for (const id of Object.keys(ownership.proposedCatalog.groups)) assert(result.requiredGroupIds.includes(id), `${changed}: missing ${id}`);
  }
});
test('renaming a deterministic test preserves old and new semantic ownership', () => {
  const result = buildVerificationPlan({ repository: 'Oteryn/Oteryn-Atlas', headSha: 'a'.repeat(40), integrationBaseSha: 'b'.repeat(40), mergeBaseSha: 'c'.repeat(40), changedFiles: [{path:'tests/creature-gameplay-model.mjs',previousPath:'tests/semantic-search.mjs'}], verificationCatalog:catalog, trustedImpactManifest:impact, candidateImpactManifest:impact });
  assert(result.requiredGroupIds.includes('deterministic.search'));
  assert(result.requiredGroupIds.includes('deterministic.gameplay'));
});

test('exact test and gameplay routes do not match unknown filename suffixes', () => {
  const testSuffix = plan(['tests/semantic-search.mjs2']);
  assert(!testSuffix.requiredGroupIds.includes('deterministic.search'));
  assert(testSuffix.executionBlockers.length > 0);
  const sourceSuffix = plan(['src/browser/creature-gameplay-profiles.mjs.backup']);
  assert(!sourceSuffix.requiredGroupIds.includes('integration.source-contract'));
});
test('production sources select their actual fixture test owners additively', () => {
  for (const [path, owner] of [['src/browser/creature-gameplay-model.mjs','deterministic.gameplay'],['src/browser/viewport-transform.mjs','deterministic.geometry'],['src/browser/semantic-search.mjs','deterministic.search']]) {
    const p=plan([path]);
    assert(p.requiredGroupIds.includes(owner),path);
    assert(p.requiredGroupIds.includes('e2e.common-smoke'));
    assert.equal(p.requiresRealFullWorld,false);
  }
  assert(!plan(['src/browser/creature-interaction.mjs']).requiredGroupIds.includes('deterministic.geometry'));
});
test('new source ownership cannot silently discharge previously unknown product obligations',()=>{
  const p=plan(['tools/build-creature-index.py']);
  assert(p.requiredGroupIds.includes('deterministic.creature-products'));
  assert(p.requiredGroupIds.includes('e2e.full'));
  assert(p.executionBlockers.some(x=>x.reason==='unresolved-source-impact'));
});
