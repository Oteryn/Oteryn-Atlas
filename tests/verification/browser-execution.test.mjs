import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { resolveBrowserExecution } from '../../tools/verification/browser-execution.mjs';
const registry = () => JSON.parse(readFileSync(new URL('../../tools/verification/browser-semantic-ownership.json', import.meta.url)));
const publications = () => Object.fromEntries(['qualification_fixture', 'bounded_real_world', 'real_fullworld'].map((capability) => [capability, { publicationManifestDigest: 'sha256:' + 'c'.repeat(64), productRootDigest: 'sha256:' + 'd'.repeat(64), sourceRepository: capability === 'qualification_fixture' ? null : 'Oteryn/Oteryn-Game', sourceRevision: capability === 'qualification_fixture' ? null : 'e'.repeat(40) }]));
const resolve = (requiredGroups, protectedRegistry = registry(), overrides = {}) => resolveBrowserExecution({ protectedRegistry, requiredGroups, atlasRevision: 'a'.repeat(40), environmentDigest: 'b'.repeat(64), policyResolved: true, protectedBaseSha: 'f'.repeat(40), publicationIdentities: publications(), ...overrides });

test('all 28 selected groups conserve 19 machine groups, 36 commands and 30 additive review frames', () => {
  const r = registry(); const result = resolve(Object.keys(r.catalog.groups));
  assert.equal(result.machineGroups.length, 19);
  assert.equal(new Set(result.machineGroups).size, 19);
  assert.equal(result.commands.length, 36);
  assert.equal(new Set(result.commands.map((c) => c.executionKey)).size, 36);
  assert.equal(result.partitions.hostedPlaywright.length, 35);
  assert.equal(result.partitions.specialistPlaywright.length, 1);
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
  const result = resolve(['fullworld.animation-census', 'e2e.bounded-performance', 'e2e.bounded-stress', 'e2e.bounded-soak']);
  const full = result.commands.find((c) => c.dataCapability === 'real_fullworld');
  assert.equal(full.browser, true);
  assert.equal(full.specialistReason, 'real-fullworld-product');
  assert.deepEqual(result.partitions.specialistPlaywright, [full.executionKey]);
  assert.equal(result.commands.find((c) => c.spec.includes('soak-desktop')).resourceClass, 'soak');
  for (const name of ['performance', 'scale', 'stress']) assert.equal(result.commands.find((c) => c.spec.endsWith(`${name}-desktop.spec.mjs`)).resourceClass, 'performance');
});
test('unknown groups, empty obligations, invalid revision and unresolved policy fail closed', () => {
  for (const groups of [[], ['unknown.group'], ['e2e.full']]) assert.throws(() => resolve(groups));
  assert.throws(() => resolve(['e2e.common-smoke'], registry(), { policyResolved: false }));
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
test('publication, source, protected base and protected registry policy identities bind every execution key', () => {
  const group = ['integration.source-contract-http'];
  const baseline = resolve(group);
  for (const [field, value] of Object.entries({ publicationManifestDigest: 'sha256:' + '1'.repeat(64), productRootDigest: 'sha256:' + '2'.repeat(64), sourceRepository: 'Oteryn/Another-Game', sourceRevision: '3'.repeat(40) })) {
    const identities = publications(); identities.bounded_real_world[field] = value;
    const changed = resolve(group, registry(), { publicationIdentities: identities });
    assert.notEqual(changed.commands[0].executionKey, baseline.commands[0].executionKey, field);
    assert.equal(changed.commands[0].identity.publication[field], value);
  }
  const base = resolve(group, registry(), { protectedBaseSha: '4'.repeat(40) });
  assert.notEqual(base.commands[0].executionKey, baseline.commands[0].executionKey);
  const policy = registry(); policy.executionContract.resultRequirements.push('additional protected obligation');
  const changed = resolve(group, policy);
  assert.notEqual(changed.protectedRegistryDigest, baseline.protectedRegistryDigest);
  assert.notEqual(changed.commands[0].executionKey, baseline.commands[0].executionKey);
  const review = resolve(['review.audit-desktop']);
  assert.equal(review.reviews[0].identity.protectedRegistryDigest, review.protectedRegistryDigest);
  assert.deepEqual(review.reviews[0].identity.publication, publications().qualification_fixture);
});
test('missing or malformed publication/source/base bindings fail closed', () => {
  const group = ['integration.source-contract-http'];
  for (const field of ['publicationManifestDigest', 'productRootDigest', 'sourceRepository', 'sourceRevision']) {
    for (const invalid of [undefined, null, '', '../escape']) {
      const identities = publications(); identities.bounded_real_world[field] = invalid;
      assert.throws(() => resolve(group, registry(), { publicationIdentities: identities }), field);
    }
  }
  assert.throws(() => resolve(group, registry(), { publicationIdentities: {} }));
  assert.throws(() => resolve(group, registry(), { protectedBaseSha: 'main' }));
  assert.throws(() => resolve(group, registry(), { protectedBaseSha: undefined }));
  const fixture = publications(); fixture.qualification_fixture.sourceRevision = 'e'.repeat(40);
  assert.throws(() => resolve(['e2e.common-smoke'], registry(), { publicationIdentities: fixture }));
});
