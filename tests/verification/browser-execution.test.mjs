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
