import test from 'node:test';
import assert from 'node:assert/strict';
import { analyzeCreatureAnimationCoverage } from '../../e2e/support/creature-animation-coverage.mjs';

const sha = (digit) => `sha256:${digit.repeat(64)}`;
const presentationId = (digit) => `outfit-presentation:sha256:${digit.repeat(64)}`;

function program({ id, phaseIds, durations = null, width = 64, height = 64 }) {
  const phaseCount = phaseIds.length;
  return {
    animation: phaseCount > 1 ? {
      default_start_phase: 0,
      loop_count: 0,
      loop_type: 'infinite',
      presentation_durations_ms: durations ?? phaseIds.map(() => 100),
      synchronized: false,
    } : null,
    height,
    outfit_presentation_id: id,
    phase_content_ids: phaseIds,
    phase_count: phaseCount,
    width,
  };
}

function product(programs) {
  const blobIndex = {};
  for (const entry of programs) for (const contentId of entry.phase_content_ids) {
    blobIndex[contentId] ??= {
      bucket: 'b0000',
      bytes: entry.width * entry.height * 4,
      height: entry.height,
      offset: 0,
      width: entry.width,
    };
  }
  return {
    profile: 'oteryn-atlas-animation-runtime-v1',
    creature_programs: programs,
    blob_index: blobIndex,
  };
}

test('census distinguishes static, dynamic multi-phase and static-equivalent multi-phase programs', () => {
  const staticId = presentationId('1');
  const dynamicId = presentationId('2');
  const equivalentId = presentationId('3');
  const value = product([
    program({ id: staticId, phaseIds: [sha('1')] }),
    program({ id: dynamicId, phaseIds: [sha('2'), sha('3')] }),
    program({ id: equivalentId, phaseIds: [sha('4'), sha('4')] }),
  ]);
  const result = analyzeCreatureAnimationCoverage(value);
  assert.equal(result.totalPrograms, 3);
  assert.equal(result.multiPhasePrograms, 2);
  assert.equal(result.visuallyDynamicPrograms, 1);
  assert.equal(result.phaseContentReferences, 5);
  assert.deepEqual(result.phaseCountHistogram, { 1: 1, 2: 2 });
  assert.deepEqual(result.staticEquivalentProgramIds, [equivalentId]);
});

test('census rejects duplicate presentation ids', () => {
  const id = presentationId('5');
  assert.throws(() => analyzeCreatureAnimationCoverage(product([
    program({ id, phaseIds: [sha('5')] }),
    program({ id, phaseIds: [sha('6')] }),
  ])), /duplicate creature presentation/i);
});

test('census rejects phase cardinality and missing blob references', () => {
  const cardinality = product([program({ id: presentationId('6'), phaseIds: [sha('7'), sha('8')] })]);
  cardinality.creature_programs[0].phase_count = 3;
  assert.throws(() => analyzeCreatureAnimationCoverage(cardinality), /phase content cardinality/i);

  const missingBlob = product([program({ id: presentationId('7'), phaseIds: [sha('9'), sha('a')] })]);
  delete missingBlob.blob_index[sha('a')];
  assert.throws(() => analyzeCreatureAnimationCoverage(missingBlob), /missing animation blob/i);
});

test('census rejects invalid multi-phase timing metadata', () => {
  const value = product([program({ id: presentationId('8'), phaseIds: [sha('b'), sha('c')] })]);
  value.creature_programs[0].animation.presentation_durations_ms = [100];
  assert.throws(() => analyzeCreatureAnimationCoverage(value), /duration cardinality/i);

  const badLoop = product([program({ id: presentationId('9'), phaseIds: [sha('d'), sha('e')] })]);
  badLoop.creature_programs[0].animation.loop_type = 'mystery';
  assert.throws(() => analyzeCreatureAnimationCoverage(badLoop), /loop type/i);
});

test('census rejects phase blob geometry drift', () => {
  const contentId = sha('f');
  const value = product([program({ id: presentationId('a'), phaseIds: [contentId] })]);
  value.blob_index[contentId].width = 32;
  assert.throws(() => analyzeCreatureAnimationCoverage(value), /blob geometry/i);
});
