import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import * as planner from '../../tools/verification/build-verification-plan.mjs';
const catalog=JSON.parse(fs.readFileSync(new URL('../../tools/verification/verification-catalog.json',import.meta.url)));
const manifest=JSON.parse(fs.readFileSync(new URL('../../tools/verification/impact-manifest.json',import.meta.url)));
const plan=path=>planner.buildVerificationPlan({repository:'Oteryn/Oteryn-Atlas',headSha:'a'.repeat(40),integrationBaseSha:'b'.repeat(40),mergeBaseSha:'c'.repeat(40),changedFiles:[{path}],verificationCatalog:catalog,trustedImpactManifest:manifest,candidateImpactManifest:manifest});
test('unknown source preserves broad partial proof but cannot qualify as complete execution',()=>{
 const p=plan('new-product/compiler.py');
 for (const group of catalog.groups['e2e.full'].dependsOnGroups) assert(p.requiredGroupIds.includes(group));
 assert(p.executionBlockers.some(x=>x.path==='new-product/compiler.py'&&x.reason==='unknown-impact'));
 assert.throws(()=>planner.assertPlanExecutable(p),/unresolved/);
});
test('a broad tests prefix cannot hide a new unowned deterministic test',()=>{
 const p=plan('tests/new-feature.py');
 assert(p.executionBlockers.some(x=>x.reason==='unowned-test'));
 assert.throws(()=>planner.assertPlanExecutable(p),/unresolved/);
});
test('new verification contracts cannot hide inside historical wildcard ownership',()=>{
 const p=plan('tests/verification/new-contract.test.mjs');
 assert(p.executionBlockers.some(x=>x.reason==='unowned-test'));
 assert.throws(()=>planner.assertPlanExecutable(p),/unresolved/);
});
test('current core owns exact test files and never inherits wildcard execution',()=>{
 const p=plan('src/browser/creature-gameplay-profiles.mjs');
 assert(catalog.groups['deterministic.core'].specs.every(spec=>!/[?*]/.test(spec)));
 assert.equal(new Set(catalog.groups['deterministic.core'].specs).size,catalog.groups['deterministic.core'].specs.length);
 for(const spec of catalog.groups['deterministic.core'].specs)assert(fs.statSync(new URL('../../'+spec,import.meta.url)).isFile());
 assert(!p.executionBlockers.some(x=>x.reason==='unexpanded-test-ownership'&&x.group==='deterministic.core'));
 const docs=plan('docs/guide.md');
 assert.deepEqual(docs.executionBlockers,[]);
 assert.equal(planner.assertPlanExecutable(docs),docs);
});
test('execution guard rejects pre-migration plans lacking explicit uncertainty metadata',()=>{
 assert.throws(()=>planner.assertPlanExecutable({groups:[]}),/blocker metadata/);
});
test('reviewed complete-product sources require specialist integrity proof and retain explicit oracle blockers',()=>{
 for(const path of [
  'tools/fullworld-generation/fabric.py',
  'tools/fullworld-generation/verify_handoff.py',
  'tools/fullworld-publication/publication.py',
  'tools/fullworld-publication/verify_publication.py',
  'tools/fullworld-publication/negative_tests.py',
  'tools/fullworld-runtime/build_runtime_index.py',
  'tools/fullworld-runtime/build_pixel_buckets.py',
  'tools/fullworld-layers/build_overview.py',
  'tools/fullworld-layers/verify_overview.py',
  'tools/fullworld-minimap/build_minimap.py',
 ]) {
  const p=plan(path);
  assert(p.executionBlockers.some(x=>x.reason==='unqualified-complete-product-oracle'&&x.path===path));
  assert.equal(p.requiresRealFullWorld,true);
  assert(p.requiredGroupIds.includes('fullworld.complete-integrity'));
  assert(p.requiredDataCapabilities.includes('real_fullworld'));
  assert.throws(()=>planner.assertPlanExecutable(p),/unresolved/);
 }
});
test('independently reviewed fixture helpers do not inherit complete-product escalation',()=>{
 for(const [path,owner] of [['tools/fullworld-runtime/cdp-session.mjs','deterministic.fullworld-runtime'],['tools/fullworld-layers/verify_authority_registry.py','deterministic.fullworld-layers']]) {
  const p=plan(path);
  assert.deepEqual(p.requiredGroupIds,[owner]);
  assert(!p.executionBlockers.some(x=>x.reason==='unqualified-complete-product-oracle'));
  assert.equal(p.requiresRealFullWorld,false);
 }
});
test('candidate exclusions cannot erase protected complete-product blockers',()=>{
 const candidate=structuredClone(manifest);
 candidate.entries.find(x=>x.pathPrefix==='tools/fullworld-publication/').excludedPaths=['tools/fullworld-publication/publication.py'];
 const p=planner.buildVerificationPlan({repository:'Oteryn/Oteryn-Atlas',headSha:'a'.repeat(40),integrationBaseSha:'b'.repeat(40),mergeBaseSha:'c'.repeat(40),changedFiles:[{path:'tools/fullworld-publication/publication.py'}],verificationCatalog:catalog,trustedImpactManifest:manifest,candidateImpactManifest:candidate});
 assert(p.executionBlockers.some(x=>x.reason==='unqualified-complete-product-oracle'));
});

test('protected authenticated handoff can execute an added deterministic subject without making it a canonical owner',()=>{
 const changedFiles=[{path:'tests/new-feature.py',status:'added'}];
 const p=planner.buildVerificationPlan({repository:'Oteryn/Oteryn-Atlas',headSha:'a'.repeat(40),integrationBaseSha:'b'.repeat(40),mergeBaseSha:'c'.repeat(40),changedFiles,
  trustedVerificationCatalog:catalog,candidateVerificationCatalog:catalog,trustedImpactManifest:manifest,candidateImpactManifest:manifest,
  unprivilegedDeterministicSubjects:['tests/new-feature.py']});
 assert.deepEqual(p.executionBlockers,[]);
 assert.equal(p.profile,'focused');
 assert.deepEqual(p.requiredGroupIds,['deterministic.core']);
 assert.equal(planner.assertPlanExecutable(p),p);
});

test('protected rename transition preserves the old canonical owner while executing the authenticated new path',()=>{
 const oldPath='tests/semantic-search.mjs',newPath='tests/semantic-search-renamed.mjs';
 const changedFiles=[{path:newPath,status:'renamed',previousPath:oldPath}];
 const p=planner.buildVerificationPlan({repository:'Oteryn/Oteryn-Atlas',headSha:'a'.repeat(40),integrationBaseSha:'b'.repeat(40),mergeBaseSha:'c'.repeat(40),changedFiles,
  trustedVerificationCatalog:catalog,candidateVerificationCatalog:catalog,trustedImpactManifest:manifest,candidateImpactManifest:manifest,
  unprivilegedDeterministicSubjects:[oldPath,newPath]});
 assert.deepEqual(p.executionBlockers,[]);
 assert.equal(p.profile,'focused');
 assert.deepEqual(p.requiredGroupIds,['deterministic.search']);
 assert.equal(planner.assertPlanExecutable(p),p);
});

test('candidate subject classification never erases independent protected semantic obligations',()=>{
 const runtimePath='src/browser/creature-gameplay-profiles.mjs';
 const runtime=plan(runtimePath);
 const changedFiles=[{path:'tests/new-feature.py',status:'added'},{path:runtimePath,status:'modified'}];
 const mixed=planner.buildVerificationPlan({repository:'Oteryn/Oteryn-Atlas',headSha:'a'.repeat(40),integrationBaseSha:'b'.repeat(40),mergeBaseSha:'c'.repeat(40),changedFiles,
  trustedVerificationCatalog:catalog,candidateVerificationCatalog:catalog,trustedImpactManifest:manifest,candidateImpactManifest:manifest,
  unprivilegedDeterministicSubjects:['tests/new-feature.py']});
 for(const id of runtime.requiredGroupIds)assert(mixed.requiredGroupIds.includes(id),id);
 assert(mixed.requiredGroupIds.includes('deterministic.core'));
});

test('planner rejects an unprivileged deterministic subject not authenticated by the changed-file census',()=>{
 assert.throws(()=>planner.buildVerificationPlan({repository:'Oteryn/Oteryn-Atlas',headSha:'a'.repeat(40),integrationBaseSha:'b'.repeat(40),mergeBaseSha:'c'.repeat(40),changedFiles:[{path:'docs/guide.md',status:'modified'}],
  trustedVerificationCatalog:catalog,candidateVerificationCatalog:catalog,trustedImpactManifest:manifest,candidateImpactManifest:manifest,
  unprivilegedDeterministicSubjects:['tests/new-feature.py']}),/not authenticated/);
});
