import assert from 'node:assert/strict';
import test from 'node:test';

import {
  buildSemanticExperimentIdentity,
  validateSelectorObligations,
} from '../../tools/verification/semantic-experiment-identity.mjs';

const digest = (character) => `sha256:${character.repeat(64)}`;

function experimentInput(overrides = {}) {
  return {
    candidateHeadSha: 'a'.repeat(40),
    authorityDigest: digest('1'),
    environmentDigest: digest('2'),
    productIdentitiesDigest: digest('3'),
    executionPolicyDigest: digest('4'),
    workloadDigest: digest('5'),
    harnessDigest: digest('6'),
    selectorIdentity: {
      plannerDigest: digest('7'),
      catalogDigest: digest('8'),
      censusDigest: digest('9'),
      requiredStableTestIds: [
        'desktop-chromium::e2e/tests/desktop.spec.mjs::loads fixture',
      ],
      specialistObligations: [],
      forceFull: false,
      selectorEscape: false,
    },
    ...overrides,
  };
}

function experiment(overrides = {}) {
  return buildSemanticExperimentIdentity(experimentInput(overrides));
}

test('Phase E repetitions retain semantic identity across unrelated main SHAs', () => {
  const first = experiment({ protectedBaseSha: 'b'.repeat(40) });
  const second = experiment({ protectedBaseSha: 'c'.repeat(40) });
  assert.equal(first.experimentDigest, second.experimentDigest);
});

test('Phase E semantic experiment identity changes for harness, authority, environment, product, policy or workload', () => {
  const baseline = experiment();
  for (const [field, value] of [
    ['harnessDigest', digest('a')],
    ['authorityDigest', digest('b')],
    ['environmentDigest', digest('c')],
    ['productIdentitiesDigest', digest('d')],
    ['executionPolicyDigest', digest('e')],
    ['workloadDigest', digest('f')],
  ]) assert.notEqual(experiment({ [field]: value }).experimentDigest, baseline.experimentDigest, field);
});

test('Phase F evidence cannot bypass newly required stable IDs or specialist obligations', () => {
  const previous = experiment();
  const addedStableId = validateSelectorObligations(previous.selectorIdentity, {
    ...previous.selectorIdentity,
    requiredStableTestIds: [
      ...previous.selectorIdentity.requiredStableTestIds,
      'mobile-chromium::e2e/tests/mobile.spec.mjs::new obligation',
    ],
  });
  assert.equal(addedStableId.reusable, false);
  assert.deepEqual(addedStableId.addedStableTestIds, [
    'mobile-chromium::e2e/tests/mobile.spec.mjs::new obligation',
  ]);

  const addedSpecialist = validateSelectorObligations(previous.selectorIdentity, {
    ...previous.selectorIdentity,
    specialistObligations: ['real-fullworld-product'],
  });
  assert.equal(addedSpecialist.reusable, false);
  assert.deepEqual(addedSpecialist.addedSpecialistObligations, ['real-fullworld-product']);
});

test('force-full and selector escape remain widening-only', () => {
  assert.throws(
    () => buildSemanticExperimentIdentity(experimentInput({
      selectorIdentity: {
        ...experimentInput().selectorIdentity,
        forceFull: true,
        requiredStableTestIds: [],
      },
    })),
    /widen|force.full/i,
  );
  assert.throws(
    () => buildSemanticExperimentIdentity(experimentInput({
      selectorIdentity: {
        ...experimentInput().selectorIdentity,
        selectorEscape: true,
        requiredStableTestIds: [],
      },
    })),
    /widen|selector.escape/i,
  );
});
