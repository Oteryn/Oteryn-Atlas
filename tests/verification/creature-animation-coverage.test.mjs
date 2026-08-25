import test from 'node:test';
import assert from 'node:assert/strict';
import { analyzeCreatureAnimationCoverage } from '../../e2e/support/creature-animation-coverage.mjs';

const sha = (digit) => `sha256:${digit.repeat(64)}`;
const presentationId = (digit) => `outfit-presentation:sha256:${digit.repeat(64)}`;

function visualProgram({ id, mode, phaseIds, durations = null, width = 64, height = 64 }) {
  const phaseCount = phaseIds.length;
  return {
    animation: phaseCount > 1 ? {
      default_start_phase: 0,
      loop_count: 0,
      loop_type: 'infinite',
      presentation_durations_ms: durations ?? phaseIds.map(() => 100),
      synchronized: false,
    } : null,
    displacement: { x: 0, y: 0 },
    height,
    outfit_presentation_id: id,
    phase_content_ids: phaseIds,
    phase_count: phaseCount,
    presentation_mode: mode,
    width,
  };
}

function entry({ id, staticPhaseIds, walkingPhaseIds = null, fallbackReason = 'MOVING_GROUP_UNAVAILABLE' }) {
  const staticProgram = visualProgram({ id, mode: 'static', phaseIds: staticPhaseIds });
  const walkingProgram = walkingPhaseIds
    ? visualProgram({ id, mode: 'moving-in-place', phaseIds: walkingPhaseIds })
    : null;
  return {
    outfit_presentation_id: id,
    presentation_envelope: {
      anchor_policy: 'tile-bottom-right-minus-sprite-overhang-and-displacement-v1',
      displacement: { x: 0, y: 0 },
      height: Math.max(staticProgram.height, walkingProgram?.height ?? 0),
      width: Math.max(staticProgram.width, walkingProgram?.width ?? 0),
    },
    static_program: staticProgram,
    walking_fallback_reason: walkingProgram ? null : fallbackReason,
    walking_program: walkingProgram,
  };
}

function product(entries) {
  const blobIndex = {};
  for (const item of entries) {
    for (const program of [item.static_program, item.walking_program].filter(Boolean)) {
      for (const contentId of program.phase_content_ids) {
        blobIndex[contentId] ??= { bucket: 'b0000', bytes: program.width * program.height * 4,
          height: program.height, offset: 0, width: program.width };
      }
    }
  }
  return {
    profile: 'oteryn-atlas-animation-runtime-v2',
    creature_programs: entries,
    blob_index: blobIndex,
  };
}

test('census distinguishes verified static and walking playback coverage', () => {
  const dynamicId = presentationId('1');
  const equivalentId = presentationId('2');
  const fallbackId = presentationId('3');
  const value = product([
    entry({ id: dynamicId, staticPhaseIds: [sha('1')], walkingPhaseIds: [sha('2'), sha('3')] }),
    entry({ id: equivalentId, staticPhaseIds: [sha('4'), sha('4')], walkingPhaseIds: [sha('5'), sha('5')] }),
    entry({ id: fallbackId, staticPhaseIds: [sha('6')] }),
  ]);
  const result = analyzeCreatureAnimationCoverage(value);
  assert.equal(result.totalPrograms, 3);
  assert.equal(result.walkingPrograms, 2);
  assert.equal(result.walkingFallbacks, 1);
  assert.deepEqual(result.walkingFallbackReasons, { MOVING_GROUP_UNAVAILABLE: 1 });
  assert.deepEqual(result.static.phaseCountHistogram, { 1: 2, 2: 1 });
  assert.equal(result.static.phaseContentReferences, 4);
  assert.equal(result.static.multiPhasePrograms, 1);
  assert.equal(result.static.visuallyDynamicPrograms, 0);
  assert.deepEqual(result.static.staticEquivalentProgramIds, [equivalentId]);
  assert.deepEqual(result.walking.phaseCountHistogram, { 2: 2 });
  assert.equal(result.walking.phaseContentReferences, 4);
  assert.equal(result.walking.multiPhasePrograms, 2);
  assert.equal(result.walking.visuallyDynamicPrograms, 1);
  assert.deepEqual(result.walking.staticEquivalentProgramIds, [equivalentId]);
});

test('census rejects duplicate presentation ids', () => {
  const id = presentationId('5');
  assert.throws(() => analyzeCreatureAnimationCoverage(product([
    entry({ id, staticPhaseIds: [sha('5')], walkingPhaseIds: [sha('6'), sha('7')] }),
    entry({ id, staticPhaseIds: [sha('8')], walkingPhaseIds: [sha('9'), sha('a')] }),
  ])), /duplicate creature presentation/i);
});

test('census rejects walking phase cardinality and missing blob references', () => {
  const cardinality = product([entry({ id: presentationId('6'), staticPhaseIds: [sha('b')], walkingPhaseIds: [sha('c'), sha('d')] })]);
  cardinality.creature_programs[0].walking_program.phase_count = 3;
  assert.throws(() => analyzeCreatureAnimationCoverage(cardinality), /phase content cardinality/i);

  const missingBlob = product([entry({ id: presentationId('7'), staticPhaseIds: [sha('e')], walkingPhaseIds: [sha('f'), sha('1')] })]);
  delete missingBlob.blob_index[sha('1')];
  assert.throws(() => analyzeCreatureAnimationCoverage(missingBlob), /missing animation blob/i);
});

test('census rejects invalid walking timing metadata', () => {
  const value = product([entry({ id: presentationId('8'), staticPhaseIds: [sha('2')], walkingPhaseIds: [sha('3'), sha('4')] })]);
  value.creature_programs[0].walking_program.animation.presentation_durations_ms = [100];
  assert.throws(() => analyzeCreatureAnimationCoverage(value), /duration cardinality/i);

  const badLoop = product([entry({ id: presentationId('9'), staticPhaseIds: [sha('5')], walkingPhaseIds: [sha('6'), sha('7')] })]);
  badLoop.creature_programs[0].walking_program.animation.loop_type = 'mystery';
  assert.throws(() => analyzeCreatureAnimationCoverage(badLoop), /loop type/i);
});

test('census rejects walking blob geometry drift and malformed fallback envelope', () => {
  const contentId = sha('8');
  const value = product([entry({ id: presentationId('a'), staticPhaseIds: [sha('9')], walkingPhaseIds: [contentId, sha('a')] })]);
  value.blob_index[contentId].width = 32;
  assert.throws(() => analyzeCreatureAnimationCoverage(value), /blob geometry/i);

  const malformed = product([entry({ id: presentationId('b'), staticPhaseIds: [sha('b')] })]);
  malformed.creature_programs[0].walking_fallback_reason = null;
  assert.throws(() => analyzeCreatureAnimationCoverage(malformed), /fallback reason/i);

  const badEnvelope = product([entry({ id: presentationId('c'), staticPhaseIds: [sha('c')], walkingPhaseIds: [sha('d'), sha('e')] })]);
  badEnvelope.creature_programs[0].presentation_envelope.width = 1;
  assert.throws(() => analyzeCreatureAnimationCoverage(badEnvelope), /envelope/i);
});
