import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { buildVerificationPlan } from '../../tools/verification/build-verification-plan.mjs';
import { validateImpactManifest } from '../../tools/verification/verification-plan-schema.mjs';
const catalog = JSON.parse(fs.readFileSync(new URL('../../tools/verification/verification-catalog.json', import.meta.url)));
const broad = {pathPrefix:'tests/',defaultRule:true,domains:['test-default'],minimumProfile:'full',requiredGroups:['deterministic.core','e2e.full']};
const semantic = {pathPrefix:'tests/runtime-',domains:['runtime'],minimumProfile:'focused',requiredGroups:['deterministic.core']};
const narrow = {pathPrefix:'tests/runtime-smoke.test.mjs',domains:['smoke'],minimumProfile:'targeted',requiredGroups:['e2e.common-smoke']};
const manifest = entries => ({schemaVersion:2,entries,crossDomainEscalations:[]});
const plan = (trusted,candidate=trusted,path='tests/runtime-smoke.test.mjs') => buildVerificationPlan({
  repository:'Oteryn/Oteryn-Atlas',headSha:'a'.repeat(40),integrationBaseSha:'b'.repeat(40),mergeBaseSha:'c'.repeat(40),
  changedFiles:[{path}],trustedImpactManifest:trusted,candidateImpactManifest:candidate,verificationCatalog:catalog,
});
test('explicitly designated defaults yield to known ownership without erasing additive semantic floors',()=>{
  const p=plan(manifest([broad,semantic,narrow]));
  assert.deepEqual(p.requiredGroupIds,['deterministic.core','e2e.common-smoke']);
  assert.deepEqual(p.impactDomains,['runtime','smoke']);
});
test('candidate default designation cannot narrow protected broad semantic rule',()=>{
  const protectedBroad={...broad};delete protectedBroad.defaultRule;
  const p=plan(manifest([protectedBroad,semantic,narrow]),manifest([broad,semantic,narrow]));
  for(const id of catalog.groups['e2e.full'].dependsOnGroups)assert(p.requiredGroupIds.includes(id),id);
});
test('unowned path still receives designated default obligations',()=>{
  const p=plan(manifest([broad,semantic,narrow]),undefined,'tests/new-family.test.mjs');
  for(const id of catalog.groups['e2e.full'].dependsOnGroups)assert(p.requiredGroupIds.includes(id),id);
});
test('default metadata is typed and survives schema normalization',()=>{
  assert.equal(validateImpactManifest(manifest([broad]),catalog).entries[0].defaultRule,true);
  assert.throws(()=>validateImpactManifest(manifest([{...broad,defaultRule:'yes'}]),catalog),/defaultRule/);
});

test('semantic prefixes cannot be downgraded into default catchalls',()=>{
 for(const row of [{...broad,pathPrefix:'src/browser/'},{...broad,domains:['creatures']},{...broad,requiredGroups:['review.visual-desktop']}]) {
  assert.throws(()=>validateImpactManifest(manifest([row]),catalog),/reserved/);
 }
 assert.throws(()=>validateImpactManifest(manifest([{...broad,exactMatch:true}]),catalog),/exact entries/);
 assert.throws(()=>validateImpactManifest(manifest([{...narrow,exactMatch:'true'}]),catalog),/exactMatch/);
 assert.equal(validateImpactManifest(manifest([{...narrow,exactMatch:true}]),catalog).entries[0].exactMatch,true);
});
