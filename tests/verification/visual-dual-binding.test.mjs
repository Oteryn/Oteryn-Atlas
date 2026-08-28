import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import { visualSourceScenarios } from '../../e2e/support/visual-source-scenarios.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const digest = `sha256:${'a'.repeat(64)}`;

function trust({ marker, fixtureId, dataCapability }) {
  return JSON.stringify({
    marker, fixtureId, dataCapability,
    publicationRoot: digest, semanticRoot: digest, pixelRoot: digest, overviewRoot: digest,
    minimapRoot: digest, runtimeIndexRoot: digest, pixelBucketRoot: digest,
    sourceFingerprint: digest, productDigest: digest,
  });
}

test('visual specs retain the exact protected Q/B dual binding with distinct source facts', () => {
  const catalog = JSON.parse(fs.readFileSync(path.join(ROOT, 'tools/verification/verification-catalog.json'), 'utf8'));
  const qualificationSpecs = new Set(catalog.groups['e2e.full'].specs);
  const boundedVisualSpecs = catalog.groups['visual.creatures'].specs;
  assert.deepEqual([...qualificationSpecs].filter((spec) => boundedVisualSpecs.includes(spec)).sort(), [...boundedVisualSpecs].sort());

  const qualification = visualSourceScenarios(trust({
    marker: 'oteryn-atlas-qualification-trust-v1', fixtureId: 'atlas-qualification-world-v2', dataCapability: 'qualification_fixture',
  }));
  const bounded = visualSourceScenarios(trust({
    marker: 'oteryn-atlas-bounded-real-trust-v1', fixtureId: 'atlas-bounded-real-world-v1', dataCapability: 'bounded_real_world',
  }));

  assert.deepEqual(qualification.identity, {
    marker: 'oteryn-atlas-qualification-trust-v1', fixtureId: 'atlas-qualification-world-v2', dataCapability: 'qualification_fixture',
  });
  assert.deepEqual(bounded.identity, {
    marker: 'oteryn-atlas-bounded-real-trust-v1', fixtureId: 'atlas-bounded-real-world-v1', dataCapability: 'bounded_real_world',
  });
  assert.notDeepEqual(qualification.desktop, bounded.desktop, 'desktop reviewer path must retain bounded-real source facts');
  assert.notDeepEqual(qualification.mobile, bounded.mobile, 'mobile reviewer path must retain bounded-real source facts');
  assert.deepEqual(qualification.desktop.semantic, { query: 'Fixture Harbor', label: 'Fixture Harbor' });
  assert.deepEqual(bounded.desktop.semantic, { query: 'Thais', label: 'Thais' });

  const qualificationDesktop = new URL(qualification.desktop.visualEntry, 'http://atlas.invalid');
  const boundedDesktop = new URL(bounded.desktop.visualEntry, 'http://atlas.invalid');
  assert.deepEqual(
    [qualificationDesktop.searchParams.get('x'), qualificationDesktop.searchParams.get('y'), qualificationDesktop.searchParams.get('floor')],
    ['32280', '32155', '-7'],
  );
  assert.deepEqual(
    [boundedDesktop.searchParams.get('x'), boundedDesktop.searchParams.get('y'), boundedDesktop.searchParams.get('floor')],
    ['32369', '32241', '-7'],
  );
  assert.notEqual(qualification.desktop.creatureOnlyPlaybackEntry, bounded.desktop.creatureOnlyPlaybackEntry);
  assert.notEqual(qualification.mobile.monsterPlaybackEntry, bounded.mobile.monsterPlaybackEntry);
});
