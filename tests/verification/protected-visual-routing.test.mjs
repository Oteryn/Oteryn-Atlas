import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {deriveVerificationMetadata} from '../../tools/verification/verification-metadata.mjs';
import { evaluateProtectedRouting, validateProtectedRouting } from '../../tools/verification/protected-semantic-routing.mjs';
const read = name => JSON.parse(fs.readFileSync(new URL(`../../tools/verification/${name}.json`, import.meta.url)));
const manifest = read('impact-manifest'), catalog = read('verification-catalog'), census = read('full-safety-net-stable-ids');
const candidate = { repository:'Example/Repository', prNumber:42, headSha:'a'.repeat(40),baseSha:'b'.repeat(40),treeSha:'c'.repeat(40),changedFiles:[{path:'docs/readme.md',status:'modified'}] };
const inventory=read('protected-scenario-inventory');
const input = {candidate,manifest,catalog,census,inventory,routing:{schemaVersion:1,mode:'conservative'}};
const metadata=deriveVerificationMetadata(catalog).browser;
const frames=metadata.specs.flatMap(row=>row.requiredFrames).sort((a,b)=>a.frameId.localeCompare(b.frameId));
const visualPath='src/browser/creature-model.mjs';
const run=(path=visualPath,extra={})=>evaluateProtectedRouting({...input,candidate:{...candidate,changedFiles:[{path,status:'modified'}]},routing:{schemaVersion:1,mode:'selective'},...extra});
test('selected canonical reviews reuse machine evidence and retain every additive frame',()=>{
 for(const result of [run(),run(visualPath,{forceFull:true}),run('tools/verification/new.mjs',{forceFull:true})]) {
  const reviewIds=result.review.flatMap(row=>row.groupIds);
  const expected=reviewIds.flatMap(id=>metadata.reviewGroups[id].requiredFrames).sort((a,b)=>a.frameId.localeCompare(b.frameId));
  assert(expected.length>0);
  assert.deepEqual([...result.requiredFrames].sort((a,b)=>a.frameId.localeCompare(b.frameId)),expected);
  for(const review of result.review) {
   assert.equal(review.dataCapability,'qualification_fixture');
   assert.equal(review.evidenceKind,'restricted-visual-review');
   for(const id of review.scenarioIds)assert(result.hostedPartitions.some(partition=>partition.scenarioIds.includes(id)),id);
  }
  for(const frame of expected)assert(result.hostedPartitions.some(partition=>partition.scenarioIds.includes(frame.stableTestId)),frame.frameId);
 }
 assert.deepEqual([...run(visualPath,{forceFull:true}).requiredFrames].sort((a,b)=>a.frameId.localeCompare(b.frameId)),frames);
});
test('ordinary nonvisual changes add no visual capture or review tax',()=>{
 const result=run('docs/readme.md');
 assert.deepEqual(result.review,[]);assert.deepEqual(result.requiredFrames,[]);assert.deepEqual(result.scenarioIds,[]);
});
test('private visual and real world placement remain specialist obligations',()=>{
 const privateCatalog=structuredClone(catalog);
 Object.assign(privateCatalog.groups['review.visual-desktop'].capabilities,{hosted:false,specialistReason:'private-visual',dataCapability:'bounded_real_world'});
 assert(run('e2e/tests/visual-desktop.spec.mjs',{catalog:privateCatalog}).review.some(row=>row.groupIds.includes('review.visual-desktop')&&row.dataCapability==='bounded_real_world'));
 const real=run('e2e/tests/fullworld-animation-census-desktop.spec.mjs');
 assert.ok(real.specialist.some(p=>p.dataCapability==='real_fullworld'));
});
test('candidate routing cannot replace protected visual capture or capability requirements',()=>{
 for(const override of [{requiredFrames:[]},{review:[]},{dataCapability:'bounded_real_world'},{visualReview:false}])
 assert.throws(()=>run(visualPath,{routing:{schemaVersion:1,mode:'selective',...override}}));
});
test('canonical frame ownership follows exact project and real capture sites',()=>{
 assert.equal(frames.length,30);
 assert.equal(new Set(frames.map(frame=>frame.frameId)).size,frames.length);
 for(const frame of frames) {
  const [project,spec,title]=frame.stableTestId.split('::');
  const row=metadata.specs.find(row=>row.spec===spec);
  assert.equal(project,row.execution.project);
  const source=fs.readFileSync(new URL('../../'+spec,import.meta.url),'utf8');
  assert(source.includes(frame.frameId),frame.frameId);
  assert(source.includes("test('"+title+"'"),title);
  assert.equal(row.reviewGroups.length,1);
 }
});
