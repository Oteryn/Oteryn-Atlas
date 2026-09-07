import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import * as planner from '../../tools/verification/build-verification-plan.mjs';
const catalog=JSON.parse(fs.readFileSync(new URL('../../tools/verification/verification-catalog.json',import.meta.url)));
const manifest=JSON.parse(fs.readFileSync(new URL('../../tools/verification/impact-manifest.json',import.meta.url)));
const plan=path=>planner.buildVerificationPlan({repository:'Oteryn/Oteryn-Atlas',headSha:'a'.repeat(40),integrationBaseSha:'b'.repeat(40),mergeBaseSha:'c'.repeat(40),changedFiles:[{path}],verificationCatalog:catalog,trustedImpactManifest:manifest,candidateImpactManifest:manifest});
test('unknown source preserves broad partial proof but cannot qualify as complete execution',()=>{
 const p=plan('new-product/compiler.py');
 assert(p.requiredGroupIds.includes('e2e.full'));
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
test('retained wildcard core blocks execution while its exact qualification remains unresolved',()=>{
 const p=plan('src/browser/creature-gameplay-profiles.mjs');
 assert(p.executionBlockers.some(x=>x.reason==='unexpanded-test-ownership'&&x.group==='deterministic.core'));
 assert.throws(()=>planner.assertPlanExecutable(p),/unresolved/);
 const docs=plan('docs/guide.md');
 assert.deepEqual(docs.executionBlockers,[]);
 assert.equal(planner.assertPlanExecutable(docs),docs);
});
test('execution guard rejects pre-migration plans lacking explicit uncertainty metadata',()=>{
 assert.throws(()=>planner.assertPlanExecutable({groups:[]}),/blocker metadata/);
});
test('complete-product helpers retain explicit oracle blockers without blind FullWorld escalation',()=>{
 for(const path of ['tools/fullworld-publication/publication.py','tools/fullworld-runtime/build_runtime_index.py','tools/fullworld-minimap/build_minimap.py']) {
  const p=plan(path);
  assert(p.executionBlockers.some(x=>x.reason==='unqualified-complete-product-oracle'&&x.path===path));
  assert.equal(p.requiresRealFullWorld,false);
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
