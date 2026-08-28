import assert from 'node:assert/strict';
import test from 'node:test';

import { buildProtectedPlaywrightSelection } from '../../tools/verification/protected-playwright-selection.mjs';

const fixtureId = 'desktop-chromium::e2e/tests/desktop.spec.mjs::fixture';
const boundedId = 'desktop-chromium::e2e/tests/bounded.spec.mjs::bounded';
const additionId = 'desktop-chromium::e2e/tests/bounded.spec.mjs::bounded addition';
const list = [
  'Listing tests:',
  '  [desktop-chromium] › desktop.spec.mjs:1:1 › fixture',
  '  [desktop-chromium] › bounded.spec.mjs:2:1 › bounded',
  '  [desktop-chromium] › bounded.spec.mjs:3:1 › bounded addition',
  'Total: 3 tests in 2 files',
].join('\n');

const execution = {
  schemaVersion: 1,
  hosted: {
    groupIds: ['e2e.full', 'integration.bounded'],
    stableTestIds: [fixtureId, boundedId, additionId],
    protectedStableTestIds: [fixtureId, boundedId],
    candidateAdditionalStableTestIds: [additionId],
    partitions: [
      {
        dataCapability: 'qualification_fixture',
        groupIds: ['e2e.full'],
        stableTestIds: [fixtureId],
        protectedStableTestIds: [fixtureId],
        candidateAdditionalStableTestIds: [],
      },
      {
        dataCapability: 'bounded_real_world',
        groupIds: ['integration.bounded'],
        stableTestIds: [boundedId, additionId],
        protectedStableTestIds: [boundedId],
        candidateAdditionalStableTestIds: [additionId],
      },
    ],
  },
  specialist: { groupIds: [], stableTestIds: [] },
};

test('selection intersects source placement with one exact hosted data-capability partition', () => {
  const protectedBounded = buildProtectedPlaywrightSelection(list, execution, {
    placement: 'protected', dataCapability: 'bounded_real_world',
  });
  assert.deepEqual(protectedBounded.stableTestIds, [boundedId]);

  const additionsBounded = buildProtectedPlaywrightSelection(list, execution, {
    placement: 'candidate-additions', dataCapability: 'bounded_real_world',
  });
  assert.deepEqual(additionsBounded.stableTestIds, [additionId]);

  const protectedFixture = buildProtectedPlaywrightSelection(list, execution, {
    placement: 'protected', dataCapability: 'qualification_fixture',
  });
  assert.deepEqual(protectedFixture.stableTestIds, [fixtureId]);
});

test('selection fails closed on unknown, duplicate, or missing hosted data-capability partitions', () => {
  assert.throws(() => buildProtectedPlaywrightSelection(list, execution, {
    placement: 'protected', dataCapability: 'real_fullworld',
  }), /data capability|partition/i);

  const duplicate = structuredClone(execution);
  duplicate.hosted.partitions.push(structuredClone(duplicate.hosted.partitions[1]));
  assert.throws(() => buildProtectedPlaywrightSelection(list, duplicate, {
    placement: 'protected', dataCapability: 'bounded_real_world',
  }), /duplicate|partition/i);
});
