import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { test } from 'node:test';
import { validateVerificationCatalog } from '../../tools/verification/verification-plan-schema.mjs';

const root = new URL('../../', import.meta.url);
const read = (path) => readFileSync(new URL(path, root), 'utf8');
const sorted = (values) => [...values].sort();
const load = () => JSON.parse(read('tools/verification/browser-semantic-ownership.json'));
const inventory = () => readdirSync(new URL('e2e/tests/', root)).filter((p) => p.endsWith('.spec.mjs')).map((p) => `e2e/tests/${p}`);
function sourceFrames(spec) {
  const source = read(spec);
  return [...source.matchAll(/captureUserVisualEvidence\(page, testInfo, '([^']+)'/g)].map((match) => {
    const tests = [...source.slice(0, match.index).matchAll(/\btest\('([^']+)'/g)];
    assert.ok(tests.length, `unresolved capture test: ${spec}`);
    return { frameId: match[1], stableTestId: `${spec.includes('mobile') ? 'mobile' : 'desktop'}-chromium::${spec}::${tests.at(-1)[1]}` };
  });
}
function check(data) {
  validateVerificationCatalog(data.catalog);
  assert.deepEqual(sorted(data.specs.map((row) => row.spec)), sorted(inventory()));
  assert.equal(new Set(data.specs.map((row) => row.spec)).size, data.specs.length);
  for (const row of data.specs) {
    assert.ok(row.oracle.length > 20);
    assert.ok(row.capabilityRationale.length > 20);
    assert.ok(row.semanticGroups.length);
    assert.equal(row.machineGroups.length, 1, 'one canonical execution owner per spec');
    assert.ok(row.execution.argv.includes(row.spec));
    assert.equal(row.execution.runtime, 'playwright');
    assert.ok(row.execution.argv.includes(`--project=${row.execution.project}`));
    assert.ok(row.resourceClass);
    assert.deepEqual(row.requiredFrames, sourceFrames(row.spec));
    for (const groupId of row.machineGroups) {
      const group = data.catalog.groups[groupId];
      assert.ok(group, `unresolved owner ${groupId}`);
      assert.ok(group.specs.includes(row.spec));
      assert.equal(group.capabilities.dataCapability, row.minimumDataCapability);
      assert.equal(group.resourceClass, row.resourceClass);
      assert.equal(group.evidence, 'machine-summary');
    }
    assert.equal(row.reviewGroups.length, row.requiredFrames.length ? 1 : 0);
    for (const id of row.reviewGroups) {
      assert.equal(data.catalog.groups[id].evidence, 'restricted-visual-review');
      assert.equal(data.catalog.groups[id].capabilities.visualReview, true);
      assert.deepEqual(data.reviewGroups[id].requiredFrames, row.requiredFrames);
      assert.equal(data.reviewGroups[id].machineExecution, 'reuse-exact-spec-project-result');
    }
  }
  for (const [id, group] of Object.entries(data.catalog.groups)) {
    assert.ok(group.specs.length);
    assert.ok(group.specs.every((spec) => data.specs.some((row) => row.spec === spec && [...row.machineGroups, ...row.reviewGroups].includes(id))));
  }
}

test('browser inventory is closed with schema-valid semantic owners, explicit commands and source-exact frames', () => check(load()));
test('omitted specs, missing owners and missing creature frames fail closed', () => {
  for (const mutate of [
    (d) => d.specs.pop(),
    (d) => { d.specs[0].machineGroups = []; },
    (d) => { d.specs.find((r) => r.spec.endsWith('creature-presentation-desktop.spec.mjs')).requiredFrames.pop(); },
    (d) => { d.specs[0].execution.argv = []; },
  ]) {
    const data = load(); mutate(data); assert.throws(() => check(data));
  }
});
test('minimum capabilities preserve two bounded-source and one complete-product proof', () => {
  const data = load();
  assert.equal(data.specs.filter((r) => r.minimumDataCapability === 'qualification_fixture').length, 33);
  assert.deepEqual(data.specs.filter((r) => r.minimumDataCapability === 'bounded_real_world').map((r) => r.spec), [
    'e2e/tests/api-contract-desktop.spec.mjs', 'e2e/tests/creature-gameplay-source-contract-desktop.spec.mjs',
  ]);
  const full = data.specs.filter((r) => r.minimumDataCapability === 'real_fullworld');
  assert.equal(full.length, 1);
  assert.equal(full[0].spec, 'e2e/tests/fullworld-animation-census-desktop.spec.mjs');
  assert.equal(full[0].execution.browser, true, 'current page fixture still launches a browser');
  assert.equal(data.specs.find((r) => r.spec.includes('gameplay-source-contract')).execution.browser, false);
});
test('bounded workload resources preserve separate performance/stress and soak contracts', () => {
  const rows = load().specs;
  for (const name of ['performance', 'stress', 'scale']) assert.equal(rows.find((r) => r.spec.endsWith(`${name}-desktop.spec.mjs`)).resourceClass, 'performance');
  assert.equal(rows.find((r) => r.spec.endsWith('soak-desktop.spec.mjs')).resourceClass, 'soak');
});
test('all 30 frames are additive review, including the 13 absent from protected legacy inventory', () => {
  const data = load();
  const rows = data.specs.filter((r) => r.requiredFrames.length);
  assert.equal(rows.length, 9);
  const frames = rows.flatMap((r) => r.requiredFrames);
  assert.equal(frames.length, 30);
  assert.equal(new Set(frames.map((r) => r.frameId)).size, 30);
  const legacy = JSON.parse(read('tools/verification/protected-visual-capture-contract.json')).requiredFrames;
  for (const old of legacy) {
    const current = frames.find((r) => r.frameId === old.frameId);
    assert.ok(current);
    if (current.stableTestId !== old.stableTestId) {
      assert.deepEqual(data.legacyFrameMigration.stableTestIdRemaps.find((r) => r.frameId === old.frameId), { frameId: old.frameId, previousStableTestId: old.stableTestId, stableTestId: current.stableTestId });
    }
  }
  assert.equal(data.legacyFrameMigration.stableTestIdRemaps.length, 2);
  assert.equal(data.legacyFrameMigration.addedFrameIds.length, 13);
  assert.equal(frames.filter((r) => !legacy.some((old) => old.frameId === r.frameId)).length, 13);
  assert.equal(data.executionContract.deduplicateBy, 'exact-revision+spec+project+data-capability+environment-digest');
  assert.equal(data.executionContract.reviewDischargedByMachinePass, false);
  assert.equal(data.fallback.groupId, 'e2e.full');
  assert.equal(data.fallback.routineOwner, false);
  assert.equal(data.fallback.resolvesUnknownOwnership, false);
  assert.equal(data.reviewContract.missingOrDisabledCapture, 'fail');
  assert.deepEqual(data.reviewContract.requiredBindings, ['reviewerIdentity', 'independentReview', 'atlasRevision', 'playwrightResultDigest', 'screenshotDigest', 'frameId', 'stableTestId']);
});
