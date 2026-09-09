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

test('canonical test ownership routes without any duplicated manifest test rows',()=>{
 const empty=manifest([]);
 const p=plan(empty,empty,'tests/semantic-search.mjs');
 assert.deepEqual(p.requiredGroupIds,['deterministic.search']);
 assert.deepEqual(p.executionBlockers,[]);
 const browser=plan(empty,empty,'e2e/tests/creature-gameplay-source-contract-desktop.spec.mjs');
 assert.deepEqual(browser.requiredGroupIds,['integration.source-contract-http']);
 assert.deepEqual(browser.executionBlockers,[]);
 assert.equal(browser.requiresRealFullWorld,false);
});
test('canonical owner routing preserves extra impact obligations and protected ownership',()=>{
 const extra=manifest([{pathPrefix:'tests/semantic-search.mjs',exactMatch:true,domains:['additional-proof'],minimumProfile:'focused',requiredGroups:['deterministic.core']}]);
 const p=plan(extra,manifest([]),'tests/semantic-search.mjs');
 assert.deepEqual(p.requiredGroupIds,['deterministic.core','deterministic.search']);
 const candidate=structuredClone(catalog);
 candidate.groups['deterministic.search'].specs=candidate.groups['deterministic.search'].specs.filter(spec=>spec!=='tests/semantic-search.mjs');
 const narrowed=buildVerificationPlan({repository:'Oteryn/Oteryn-Atlas',headSha:'a'.repeat(40),integrationBaseSha:'b'.repeat(40),mergeBaseSha:'c'.repeat(40),changedFiles:[{path:'tests/semantic-search.mjs'}],trustedImpactManifest:manifest([]),candidateImpactManifest:manifest([]),trustedVerificationCatalog:catalog,candidateVerificationCatalog:candidate});
 assert(narrowed.requiredGroupIds.includes('deterministic.search'));
 assert(narrowed.executionBlockers.some(row=>row.reason==='unknown-impact'));
});

test('candidate duplicate owner produces an explicit execution blocker',()=>{
 const candidate=structuredClone(catalog);
 candidate.groups['deterministic.gameplay'].specs.push('tests/semantic-search.mjs');
 const p=buildVerificationPlan({repository:'Oteryn/Oteryn-Atlas',headSha:'a'.repeat(40),integrationBaseSha:'b'.repeat(40),mergeBaseSha:'c'.repeat(40),changedFiles:[{path:'tests/semantic-search.mjs'}],trustedImpactManifest:manifest([]),candidateImpactManifest:manifest([]),trustedVerificationCatalog:catalog,candidateVerificationCatalog:candidate});
 assert(p.executionBlockers.some(row=>row.reason==='ambiguous-test-owner'));
});

test('dependency manifests and lockfiles are protected semantic impacts instead of unknown paths',()=>{
 const empty=manifest([]);
 const dependencyPaths=[
  'package.json','package-lock.json','e2e/package.json','e2e/package-lock.json',
  'ui/pnpm-lock.yaml','ui/yarn.lock','ui/bun.lock','deno.json',
  'Cargo.toml','crates/core/Cargo.lock','pyproject.toml','requirements-dev.txt','services/api/uv.lock',
  'go.mod','services/gateway/go.sum','Gemfile.lock','composer.lock','pom.xml','build.gradle.kts',
  'gradle/libs.versions.toml','src/Atlas.Core.csproj','Directory.Packages.props','Package.resolved',
  'mix.lock','pubspec.lock','.terraform.lock.hcl','infra/providers.tf','Dockerfile','containers/worker.Dockerfile',
  'compose.yaml','.github/dependabot.yml','renovate.json','.gitmodules','Chart.lock',
 ];
 for(const path of dependencyPaths){
  const p=plan(empty,empty,path);
  assert.equal(p.profile,'full',path);
  assert(p.impactDomains.includes('dependency-governance'),path);
  assert(!p.executionBlockers.some(row=>row.reason==='unknown-impact'&&row.path===path),path);
  for(const id of catalog.groups['e2e.full'].dependsOnGroups)assert(p.requiredGroupIds.includes(id),`${path}: ${id}`);
 }
});

test('dependency routing cannot be narrowed by candidate default metadata',()=>{
 const candidateDefault=manifest([{pathPrefix:'e2e/',defaultRule:true,domains:['candidate-default'],minimumProfile:'none',requiredGroups:[]}]);
 const p=plan(manifest([]),candidateDefault,'e2e/package-lock.json');
 assert.equal(p.profile,'full');
 assert(p.impactDomains.includes('dependency-governance'));
 assert(!p.executionBlockers.some(row=>row.reason==='unknown-impact'));
});

test('unrecognized source paths remain fail-closed after dependency routing',()=>{
 const p=plan(manifest([]),manifest([]),'new-runtime-family/opaque.source');
 assert(p.executionBlockers.some(row=>row.reason==='unknown-impact'&&row.path==='new-runtime-family/opaque.source'));
});
