import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import {buildVerificationPlan} from '../../tools/verification/build-verification-plan.mjs';
import {deriveVerificationMetadata} from '../../tools/verification/verification-metadata.mjs';
const read=name=>JSON.parse(fs.readFileSync(new URL(`../../tools/verification/${name}.json`,import.meta.url)));
const catalog=read('verification-catalog'),impact=read('impact-manifest');
const plan=paths=>buildVerificationPlan({repository:'Oteryn/Oteryn-Atlas',headSha:'a'.repeat(40),integrationBaseSha:'b'.repeat(40),mergeBaseSha:'c'.repeat(40),changedFiles:paths.map(path=>({path})),verificationCatalog:catalog,trustedImpactManifest:impact,candidateImpactManifest:impact});
test('each of 36 Playwright specs selects its sole machine owner and additive own reviews',()=>{
 const metadata=deriveVerificationMetadata(catalog);assert.equal(metadata.browser.specs.length,36);
 for(const row of metadata.browser.specs){
  const result=plan([row.spec]);
  const reviewGroups=[...new Set(metadata.browser.specs.filter(other=>other.machineGroups[0]===row.machineGroups[0]).flatMap(other=>other.reviewGroups))].sort();
  assert.deepEqual(result.requiredGroupIds,[...row.machineGroups,...reviewGroups].sort(),row.spec);
  assert.deepEqual(result.requiredVisualGroupIds,reviewGroups,row.spec);
  assert.equal(result.requiresRealFullWorld,row.minimumDataCapability==='real_fullworld');
  assert.equal(result.executionBlockers.length,0,row.spec);
 }
});
test('specialist workload groups have exact routes and retain capability independence',()=>{
 for(const [id,group] of Object.entries(catalog.groups).filter(([,g])=>g.executionRole==='canonical-machine'&&g.executionEngine==='playwright'&&g.capabilities.specialistReason)){
  assert(group.specs.length>0);assert(plan([group.specs[0]]).requiredGroupIds.includes(id));
  if(group.capabilities.dataCapability==='real_fullworld')assert.equal(group.capabilities.hosted,false);
 }
 for(const id of ['e2e.bounded-performance','e2e.bounded-soak','e2e.bounded-stress']){
  const p=plan([catalog.groups[id].specs[0]]);assert.equal(p.requiresRealFullWorld,false);
  assert.equal(catalog.groups[id].resourceClass,id==='e2e.bounded-soak'?'soak':'performance');
 }
});
test('fixture source transformations do not imply complete-product proof or unrelated broad execution',()=>{
 for(const source of ['tools/build-creature-index.py','tools/build-farm-bundle.py','src/layers/minimap-palette.mjs']){
  const result=plan([source]);assert.equal(result.executionBlockers.length,0);assert.equal(result.requiresRealFullWorld,false);assert(!result.requiredGroupIds.includes('e2e.bounded-soak'));
 }
 assert.deepEqual(plan(['tools/fullworld-incremental/content_graph.py']).requiredGroupIds,['deterministic.fullworld-runtime']);
 assert.deepEqual(plan(['tools/maintenance/verify-maintenance-diff.mjs']).requiredGroupIds,['deterministic.maintenance']);
});
test('unknown fullworld source remains blocked instead of assuming directory-wide oracle sufficiency',()=>{
 for(const source of ['tools/fullworld-minimap/new-builder.py','new-product/unknown.mjs']){
  const result=plan([source]);assert(result.executionBlockers.length>0);assert(!result.requiredGroupIds.includes('e2e.full'));assert(result.requiredGroupIds.includes('e2e.bounded-soak'));
 }
});
test('creature gameplay avoids unrelated chrome review while animation retains pixel review',()=>{
 const gameplay=plan(['src/browser/creature-gameplay-model.mjs']);assert(gameplay.requiredVisualGroupIds.includes('review.creature-gameplay-desktop'));assert(!gameplay.requiredVisualGroupIds.includes('review.visual-desktop'));assert(!gameplay.requiredGroupIds.includes('integration.source-contract-http'));
 const animation=plan(['src/browser/animation-runtime.mjs']);assert(animation.requiredVisualGroupIds.includes('review.visual-desktop'));assert(animation.requiredGroupIds.includes('e2e.render-synchronization'));
});

test('reviewed complete-product source selects genuine specialist proof and preserves its unresolved executor gate',()=>{
 const p=plan(['tools/fullworld-runtime/build_runtime_index.py']);
 assert(p.requiredGroupIds.includes('fullworld.complete-integrity'));assert.equal(p.requiresRealFullWorld,true);
 assert(p.executionBlockers.some(row=>row.reason==='unqualified-complete-product-oracle'));
 const helper=plan(['tools/fullworld-runtime/cdp-session.mjs']);assert.equal(helper.requiresRealFullWorld,false);
});

test('semantic search source build does not request unrelated real gameplay bytes',()=>{
 const p=plan(['tools/build-semantic-search-index.py']);
 assert(p.requiredGroupIds.includes('integration.source-contract-browser'));assert(p.requiredGroupIds.includes('e2e.search-navigation'));
 assert(!p.requiredGroupIds.includes('integration.source-contract-http'));
});
