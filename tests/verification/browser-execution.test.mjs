import { deriveVerificationMetadata } from '../../tools/verification/verification-metadata.mjs';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { resolveBrowserExecution } from '../../tools/verification/browser-execution.mjs';
import { createPublicationProofFixtures } from './helpers/publication-proof-fixture.mjs';
const registry = () => deriveVerificationMetadata(JSON.parse(readFileSync(new URL('../../tools/verification/verification-catalog.json', import.meta.url)))).browser;
const proofInputs = (groups) => createPublicationProofFixtures([
  'qualification_fixture',
  'bounded_real_world',
]);
const resolve = (requiredGroups, protectedRegistry = registry(), overrides = {}) => resolveBrowserExecution({
  protectedRegistry,
  requiredGroups,
  atlasRevision: 'a'.repeat(40),
  environmentDigest: 'b'.repeat(64),
  protectedBaseSha: 'f'.repeat(40),
  ...proofInputs(requiredGroups),
  ...overrides,
});

test('all executable non-full groups conserve 18 machine groups, 35 commands and 30 additive review frames', () => {
  const r = registry(); const result = resolve(Object.keys(r.catalog.groups).filter(id=>id!=='fullworld.animation-census'));
  assert.equal(result.machineGroups.length, 18);
  assert.equal(new Set(result.machineGroups).size, 18);
  assert.equal(result.commands.length, 35);
  assert.equal(new Set(result.commands.map((c) => c.executionKey)).size, 35);
  assert.equal(result.partitions.hostedPlaywright.length, 35);
  assert.equal(result.partitions.specialistPlaywright.length, 0);
  assert.equal(result.reviews.length, 9);
  assert.equal(result.reviews.flatMap((r) => r.requiredFrames).length, 30);
  assert.ok(result.reviews.every((r) => r.discharged === false));
  assert.deepEqual(new Set([...result.partitions.hostedPlaywright, ...result.partitions.specialistPlaywright]), new Set(result.commands.map((c) => c.executionKey)));
});
test('request-only Playwright retains an exact real command in hosted partition', () => {
  const result = resolve(['integration.source-contract-http']);
  const [command] = result.commands;
  assert.equal(command.browser, false);
  assert.equal(command.cwd, 'e2e');
  assert.deepEqual(command.argv, ['npx', '--no-install', 'playwright', 'test', 'e2e/tests/creature-gameplay-source-contract-desktop.spec.mjs', '--project=desktop-chromium']);
  assert.equal(command.dataCapability, 'bounded_real_world');
  assert.equal(command.resourceClass, 'cpu-light');
  assert.deepEqual(result.partitions.hostedPlaywright, [command.executionKey]);
});
test('review selection adds canonical owner, deduplicates overlap and cannot be discharged by a machine pass', () => {
  const result = resolve(['review.creature-presentation-desktop', 'e2e.creature-presentation', 'review.creature-presentation-desktop']);
  assert.deepEqual(result.machineGroups, ['e2e.creature-presentation']);
  assert.equal(result.commands.length, 2);
  assert.equal(result.reviews.flatMap((r) => r.requiredFrames).length, 13);
  assert.ok(result.reviews.every((r) => r.discharged === false && r.evidence === 'restricted-visual-review'));
  assert.equal(result.reviews.find((r) => r.groupId === 'review.creature-presentation-desktop').requiredFrames.length, 11);
});
test('complete-product census stays specialist and bounded workload resources remain distinct', () => {
  assert.throws(()=>resolve(['fullworld.animation-census']),/raw publication proof|authentication unavailable/);
  const full=registry().catalog.groups['fullworld.animation-census'];
  assert.equal(full.capabilities.hosted,false);
  assert.equal(full.capabilities.specialistReason,'real-fullworld-product');
  const result=resolve(['e2e.bounded-performance','e2e.bounded-stress','e2e.bounded-soak']);
  assert.equal(result.commands.find((c) => c.spec.includes('soak-desktop')).resourceClass, 'soak');
  for (const name of ['performance', 'scale', 'stress']) assert.equal(result.commands.find((c) => c.spec.endsWith(`${name}-desktop.spec.mjs`)).resourceClass, 'performance');
});
test('unknown groups, empty obligations and invalid execution identities fail closed', () => {
  for (const groups of [[], ['unknown.group'], ['e2e.full']]) assert.throws(() => resolve(groups));
  assert.throws(() => resolve(['e2e.common-smoke'], registry(), { atlasRevision: 'main' }));
  assert.throws(() => resolve(['e2e.common-smoke'], registry(), { environmentDigest: '' }));
});
test('invalid protected ownership, path escape, command substitution, missing frames and capability mismatch fail closed', () => {
  const mutations = [
    (r) => { r.specs[0].machineGroups = []; },
    (r) => { r.specs[0].spec = '../escaped.spec.mjs'; },
    (r) => { r.specs[0].execution.argv = ['sh', '-c', 'anything']; },
    (r) => { delete r.catalog.groups[r.specs[0].machineGroups[0]]; },
    (r) => { r.catalog.groups['e2e.common-smoke'].specs.push('e2e/tests/missing.spec.mjs'); },
    (r) => { r.specs.find((s) => s.requiredFrames.length).requiredFrames = []; },
    (r) => { r.reviewGroups['review.audit-desktop'].requiredFrames.pop(); },
    (r) => { r.specs[0].minimumDataCapability = 'real_fullworld'; },
    (r) => { r.specs[0].execution.cwd = '../../'; },
    (r) => { r.specs[0].execution.project = 'firefox'; },
    (r) => { r.reviewContract.missingOrDisabledCapture = 'ignore'; },
  ];
  for (const mutate of mutations) { const r = registry(); mutate(r); assert.throws(() => resolve(['e2e.common-smoke'], r)); }
});

test('review-only selection adds machine commands without widening review to sibling specs', () => {
  const result = resolve(['review.creature-presentation-desktop']);
  assert.equal(result.commands.length, 2);
  assert.deepEqual(result.machineGroups, ['e2e.creature-presentation']);
  assert.equal(result.reviews.length, 1);
  assert.equal(result.reviews[0].requiredFrames.length, 11);
});
test('explicit protected project selects argv even when the spec filename names another project', () => {
  const protectedRegistry = registry();
  const row = protectedRegistry.specs.find((item) => item.spec === 'e2e/tests/creature-gameplay-source-contract-desktop.spec.mjs');
  row.execution.project = 'mobile-chromium';
  protectedRegistry.catalog.groups['integration.source-contract-http'].projects=['mobile-chromium'];
  row.execution.argv[row.execution.argv.length - 1] = '--project=mobile-chromium';
  const result = resolve(['integration.source-contract-http'], protectedRegistry);
  assert.equal(result.commands[0].project, 'mobile-chromium');
  assert.equal(result.commands[0].argv.at(-1), '--project=mobile-chromium');
});
test('catalog dependency edges are accepted only for an actual row review owner', () => {
  const actual = registry();
  actual.catalog.groups['e2e.map-navigation'].dependsOnGroups = ['review.audit-desktop'];
  assert.deepEqual(resolve(['e2e.map-navigation'], actual).reviews.map((review) => review.groupId), ['review.audit-desktop']);
  const sibling = registry();
  sibling.catalog.groups['e2e.map-navigation'].dependsOnGroups = ['review.visual-desktop'];
  assert.throws(() => resolve(['e2e.map-navigation'], sibling), /actual row review owner/);
  const backwards = registry();
  backwards.catalog.groups['review.audit-desktop'].dependsOnGroups = ['e2e.map-navigation'];
  assert.throws(() => resolve(['review.audit-desktop'], backwards), /unsafe catalog dependency/);
});
test('authenticated publication, protected base and protected registry identities bind every execution key', () => {
  const group = ['integration.source-contract-http'];
  const baseline = resolve(group);
  const base = resolve(group, registry(), { protectedBaseSha: '4'.repeat(40) });
  assert.notEqual(base.commands[0].executionKey, baseline.commands[0].executionKey);
  assert.notEqual(base.publicationTrustReceiptDigest, baseline.publicationTrustReceiptDigest);
  const policy = registry(); policy.executionContract.resultRequirements.push('additional protected obligation');
  const changed = resolve(group, policy);
  assert.notEqual(changed.protectedRegistryDigest, baseline.protectedRegistryDigest);
  assert.notEqual(changed.commands[0].executionKey, baseline.commands[0].executionKey);
  assert.deepEqual(Object.keys(baseline.authenticatedPublicationIdentities), ['bounded_real_world']);
  assert.equal(baseline.commands[0].identity.publication.sourceRepository, 'Oteryn/Oteryn-Game');
  assert.match(baseline.commands[0].identity.publication.trustReceiptDigest, /^sha256:[0-9a-f]{64}$/);
  const review = resolve(['review.audit-desktop']);
  assert.equal(review.reviews[0].identity.protectedRegistryDigest, review.protectedRegistryDigest);
  assert.deepEqual(review.reviews[0].identity.publication, review.authenticatedPublicationIdentities.qualification_fixture);
});
test('tampered raw publication, product and Game source evidence cannot produce an execution key', () => {
  const group = ['integration.source-contract-http'];
  const mutations = [
    (input) => { input.publicationProofs.bounded_real_world.publicationManifestBytes = Buffer.from('{}\n'); },
    (input) => { input.publicationProofs.bounded_real_world.productFiles[1].bytes = Buffer.from('different product byte\n'); },
    (input) => { input.publicationProofs.bounded_real_world.source.repository = 'Oteryn/Another-Game'; },
    (input) => { input.publicationProofs.bounded_real_world.source.revision = '3'.repeat(40); },
    (input) => { input.publicationProofs.bounded_real_world.source.selectedBytes[0].bytes = Buffer.from('different source bytes\n'); },
    (input) => { input.protectedExpectedAuthorities.bounded_real_world.source.revision = '3'.repeat(40); },
    (input) => { input.protectedExpectedAuthorities.bounded_real_world.authorityDigest = 'sha256:' + '3'.repeat(64); },
  ];
  for (const mutate of mutations) {
    const input = structuredClone(proofInputs(group)); mutate(input);
    assert.throws(() => resolve(group, registry(), input), /publication authentication failed/);
  }
});
test('missing raw proofs, fabricated identities and malformed protected base fail closed', () => {
  const group = ['integration.source-contract-http'];
  assert.throws(() => resolve(group, registry(), { publicationProofs: undefined }), /raw publication proof/);
  assert.throws(() => resolve(group, registry(), { protectedExpectedAuthorities: undefined }), /protected expected authority/);
  assert.throws(() => resolve(group, registry(), {
    publicationProofs: undefined,
    publicationIdentities: {
      bounded_real_world: {
        publicationManifestDigest: 'sha256:' + 'c'.repeat(64),
        productRootDigest: 'sha256:' + 'd'.repeat(64),
        sourceRepository: 'Oteryn/Oteryn-Game',
        sourceRevision: 'e'.repeat(40),
      },
    },
  }), /raw publication proof/);
  assert.throws(() => resolve(group, registry(), { protectedBaseSha: 'main' }));
  assert.throws(() => resolve(group, registry(), { protectedBaseSha: undefined }));
  const fixture = structuredClone(proofInputs(['e2e.common-smoke']));
  fixture.publicationProofs.qualification_fixture.source = { repository: 'Oteryn/Oteryn-Game', revision: 'e'.repeat(40), selectedBytes: [] };
  assert.throws(() => resolve(['e2e.common-smoke'], registry(), fixture), /publication authentication failed/);
});

// Exact output fixture from the pinned, unchanged Game producer; no execution claim.
import {gunzipSync} from 'node:zlib';
const selectedGameplayFixture=()=>Object.fromEntries(Object.entries(JSON.parse(gunzipSync(Buffer.from('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','base64')).toString())).map(([name,text])=>[name,Buffer.from(text)]));
test('selected derived gameplay authorizes only the exact HTTP group without synthetic map publication',()=>{
 const selectedGameplayFiles=selectedGameplayFixture();
 const result=resolve(['integration.source-contract-http'],registry(),{selectedGameplayFiles,publicationProofs:undefined,protectedExpectedAuthorities:undefined});
 const source=result.commands[0].identity.publication;
 assert.equal(source.kind,'game-producer-derived-selected-gameplay');assert.equal(source.mapAuthority,false);assert.equal(source.completeWorld,false);
 assert.equal(result.commands.length,1);assert.equal(result.reviews.length,0);
 for(const group of ['e2e.bounded-performance','fullworld.animation-census','e2e.common-smoke'])assert.throws(()=>resolve([group],registry(),{selectedGameplayFiles}));
 assert.throws(()=>resolve(['integration.source-contract-http','integration.source-contract-browser'],registry(),{selectedGameplayFiles}),/another bounded group/);
 for(const name of Object.keys(selectedGameplayFiles)){
  const bad=selectedGameplayFixture();bad[name][0]^=1;
  assert.throws(()=>resolve(['integration.source-contract-http'],registry(),{selectedGameplayFiles:bad}),/output digest/);
 }
 assert.equal(resolve(['integration.source-contract-http','e2e.layer-availability'],registry(),{selectedGameplayFiles}).commands.length,2);
 const changed=resolve(['integration.source-contract-http'],registry(),{selectedGameplayFiles,protectedBaseSha:'5'.repeat(40)});
 assert.notEqual(changed.commands[0].executionKey,result.commands[0].executionKey);
});

import { SELECTED_GAMEPLAY_INPUTS, SELECTED_GAMEPLAY_OUTPUTS, SELECTED_GAMEPLAY_ARGV, buildSelectedGameplaySource, verifySelectedGameplayInputs, verifySelectedGameplayProduct } from '../../tools/verification/shadow-gameplay-source.mjs';
{

const input = () => Object.fromEntries(SELECTED_GAMEPLAY_INPUTS.map(pin => [pin.id, Buffer.alloc(pin.bytes)]));
const output = () => Object.fromEntries(SELECTED_GAMEPLAY_OUTPUTS.map(pin => [pin.path, Buffer.alloc(pin.bytes)]));

test('source authority distinguishes exact Game producer from legacy evidence and is immutable', () => {
  assert.equal(SELECTED_GAMEPLAY_INPUTS.filter(x => x.role === 'game-producer' && x.repository === 'Oteryn/Oteryn-Game').length, 2);
  assert.equal(SELECTED_GAMEPLAY_INPUTS.filter(x => x.role === 'legacy-evidence' && x.repository === 'blakinio/Otheryn').length, 2);
  assert.throws(() => { SELECTED_GAMEPLAY_INPUTS[0].sha256 = 'forged'; }, TypeError);
  assert.throws(() => { SELECTED_GAMEPLAY_OUTPUTS.push({ path: 'extra' }); }, TypeError);
  assert.deepEqual(SELECTED_GAMEPLAY_ARGV.slice(0, 2), ['-I', '-B']);
});

test('extra and missing input identities fail before producer execution', () => {
  const missing = input(); delete missing.rat;
  for (const value of [missing, { ...input(), extra: Buffer.from('extra') }, [], null, Object.create(input())]) {
    assert.throws(() => buildSelectedGameplaySource(value), /input census mismatch/);
  }
});

test('untrusted bytes, text substitutions and repository metadata cannot supply source authority', () => {
  assert.throws(() => verifySelectedGameplayInputs(input()), /exporter bytes do not match protected repository pin/);
  assert.throws(() => verifySelectedGameplayInputs({ ...input(), exporter: 'trusted' }), /requires raw bytes/);
  assert.throws(() => verifySelectedGameplayInputs({ ...input(), exporter: { repository: 'Oteryn/Oteryn-Game', revision: SELECTED_GAMEPLAY_INPUTS[0].revision, digest: SELECTED_GAMEPLAY_INPUTS[0].sha256 } }), /requires raw bytes/);
});

test('selected output proof rejects missing shards, extra files, forged manifests and claimed digest strings', () => {
  const missing = output(); delete missing['shards/npc-f8.json'];
  assert.throws(() => verifySelectedGameplayProduct(missing), /output census mismatch/);
  assert.throws(() => verifySelectedGameplayProduct({ ...output(), 'shards/extra.json': Buffer.alloc(0) }), /output census mismatch/);
  assert.throws(() => verifySelectedGameplayProduct(output()), /manifest.json output digest mismatch/);
  assert.throws(() => verifySelectedGameplayProduct({ ...output(), 'manifest.json': SELECTED_GAMEPLAY_OUTPUTS[0].sha256 }), /requires raw bytes/);
});
}

import { GAMEPLAY_HTTP_TITLES, GAMEPLAY_HTTP_STABLE_IDS, validateGameplayHttpResults, startSelectedGameplayServer } from '../../tools/verification/shadow-gameplay-http.mjs';
{
const report = () => ({ config: { workers: 1, projects: [{ name: 'desktop-chromium', retries: 0 }] }, errors: [], suites: [{ specs: GAMEPLAY_HTTP_TITLES.map(title => ({ title, file: 'e2e/tests/creature-gameplay-source-contract-desktop.spec.mjs', tests: [{ projectName: 'desktop-chromium', expectedStatus: 'passed', status: 'expected', results: [{ status: 'passed', retry: 0, errors: [] }] }] })) }] });
test('exact two observed passing request tests discharge only the source contract', () => {
 assert.deepEqual(validateGameplayHttpResults(report()), GAMEPLAY_HTTP_STABLE_IDS);
});
test('missing, duplicate, unexpected, skipped, retried and failed tests fail closed', () => {
 const variants = [r => r.suites[0].specs.pop(), r => r.suites[0].specs.push(r.suites[0].specs[0]), r => r.suites[0].specs[0].title = 'forged', r => r.suites[0].specs[0].tests[0].results[0].status = 'skipped', r => r.suites[0].specs[0].tests[0].results[0].retry = 1, r => r.suites[0].specs[0].tests[0].expectedStatus = 'failed', r => r.config.workers = 2, r => r.config.projects[0].retries = 1, r => r.errors.push({ message: 'failure' })];
 for (const mutate of variants) { const r = report(); mutate(r); assert.throws(() => validateGameplayHttpResults(r), /selected gameplay HTTP invalid/); }
});
test('HTTP server rejects an unverified publication before listening', async () => {
 await assert.rejects(startSelectedGameplayServer({ 'manifest.json': Buffer.from('{}') }), /output census mismatch/);
});
}
