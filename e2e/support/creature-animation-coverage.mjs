const CONTENT_ID = /^sha256:[0-9a-f]{64}$/;
const PRESENTATION_ID = /^outfit-presentation:sha256:[0-9a-f]{64}$/;
const SUPPORTED_LOOPS = new Set(['infinite', 'pingpong', 'counted']);
const PROFILE = 'oteryn-atlas-animation-runtime-v2';
const ENVELOPE_POLICY = 'tile-bottom-right-minus-sprite-overhang-and-displacement-v1';

function requireValue(condition, message) {
  if (!condition) throw new Error(`creature animation coverage: ${message}`);
}

function positiveInteger(value) {
  return Number.isSafeInteger(value) && value > 0;
}

function validDisplacement(value) {
  return Number.isSafeInteger(value?.x) && Number.isSafeInteger(value?.y);
}

function validateAnimation(program) {
  const animation = program.animation;
  requireValue(animation && typeof animation === 'object', 'multi-phase animation metadata missing');
  const durations = animation.presentation_durations_ms;
  requireValue(Array.isArray(durations) && durations.length === program.phase_count, 'animation duration cardinality mismatch');
  requireValue(durations.every(positiveInteger), 'animation duration invalid');
  requireValue(SUPPORTED_LOOPS.has(animation.loop_type), 'unsupported animation loop type');
  requireValue(typeof animation.synchronized === 'boolean', 'animation synchronized flag invalid');
  requireValue(Number.isSafeInteger(animation.default_start_phase)
    && animation.default_start_phase >= 0
    && animation.default_start_phase < program.phase_count, 'animation default start phase invalid');
  requireValue(Number.isSafeInteger(animation.loop_count) && animation.loop_count >= 0, 'animation loop count invalid');
}

function validateBlob(blob, program, contentId) {
  requireValue(blob && typeof blob === 'object', `missing animation blob ${contentId}`);
  requireValue(positiveInteger(blob.width) && positiveInteger(blob.height), `animation blob geometry invalid for ${contentId}`);
  requireValue(blob.width === program.width && blob.height === program.height, `animation blob geometry drift for ${contentId}`);
  requireValue(positiveInteger(blob.bytes) && blob.bytes === blob.width * blob.height * 4, `animation blob byte geometry mismatch for ${contentId}`);
}

function validateVisualProgram(program, presentationId, mode, blobIndex) {
  requireValue(program && typeof program === 'object', `${mode} creature program missing`);
  requireValue(program.outfit_presentation_id === presentationId, `${mode} creature presentation identity mismatch`);
  requireValue(program.presentation_mode === mode, `${mode} creature presentation mode mismatch`);
  requireValue(positiveInteger(program.phase_count), `${mode} creature phase count invalid`);
  requireValue(positiveInteger(program.width) && positiveInteger(program.height), `${mode} creature program geometry invalid`);
  requireValue(validDisplacement(program.displacement), `${mode} creature displacement invalid`);
  const phaseIds = program.phase_content_ids;
  requireValue(Array.isArray(phaseIds) && phaseIds.length === program.phase_count, `${mode} creature phase content cardinality mismatch`);
  requireValue(phaseIds.every((value) => CONTENT_ID.test(value ?? '')), `${mode} creature phase content id invalid`);
  for (const contentId of phaseIds) validateBlob(blobIndex[contentId], program, contentId);
  if (program.phase_count > 1) validateAnimation(program);
  return program;
}

function summarizePrograms(programs) {
  const phaseCountHistogram = {};
  const staticEquivalentProgramIds = [];
  let multiPhasePrograms = 0;
  let visuallyDynamicPrograms = 0;
  let phaseContentReferences = 0;

  for (const program of programs) {
    const phaseIds = program.phase_content_ids;
    phaseContentReferences += phaseIds.length;
    phaseCountHistogram[program.phase_count] = (phaseCountHistogram[program.phase_count] ?? 0) + 1;
    if (program.phase_count === 1) continue;
    multiPhasePrograms += 1;
    if (new Set(phaseIds).size > 1) visuallyDynamicPrograms += 1;
    else staticEquivalentProgramIds.push(program.outfit_presentation_id);
  }

  staticEquivalentProgramIds.sort();
  return Object.freeze({
    multiPhasePrograms,
    phaseContentReferences,
    phaseCountHistogram: Object.freeze({ ...phaseCountHistogram }),
    staticEquivalentProgramIds: Object.freeze(staticEquivalentProgramIds),
    visuallyDynamicPrograms,
  });
}

function validateEnvelope(entry, staticProgram, walkingProgram) {
  const envelope = entry.presentation_envelope;
  requireValue(envelope && typeof envelope === 'object', 'creature presentation envelope missing');
  requireValue(positiveInteger(envelope.width) && envelope.width >= staticProgram.width,
    'creature presentation envelope width invalid');
  requireValue(positiveInteger(envelope.height) && envelope.height >= staticProgram.height,
    'creature presentation envelope height invalid');
  requireValue(validDisplacement(envelope.displacement), 'creature presentation envelope displacement invalid');
  requireValue(envelope.displacement.x === staticProgram.displacement.x
    && envelope.displacement.y === staticProgram.displacement.y, 'creature presentation envelope displacement drift');
  requireValue(envelope.anchor_policy === ENVELOPE_POLICY, 'creature presentation envelope anchor policy invalid');
  if (walkingProgram) {
    requireValue(envelope.width >= walkingProgram.width && envelope.height >= walkingProgram.height,
      'creature presentation envelope excludes walking program');
    requireValue(walkingProgram.displacement.x === staticProgram.displacement.x
      && walkingProgram.displacement.y === staticProgram.displacement.y, 'creature playback displacement drift');
  }
}

export function analyzeCreatureAnimationCoverage(product) {
  requireValue(product && typeof product === 'object', 'animation product missing');
  requireValue(product.profile === PROFILE, 'animation product profile mismatch');
  requireValue(Array.isArray(product.creature_programs), 'creature program list missing');
  requireValue(product.blob_index && typeof product.blob_index === 'object', 'animation blob index missing');

  const seen = new Set();
  const staticPrograms = [];
  const walkingPrograms = [];
  const fallbackReasons = {};
  let walkingFallbacks = 0;

  for (const entry of product.creature_programs) {
    const presentationId = entry?.outfit_presentation_id;
    requireValue(PRESENTATION_ID.test(presentationId ?? ''), 'creature presentation id invalid');
    requireValue(!seen.has(presentationId), `duplicate creature presentation ${presentationId}`);
    seen.add(presentationId);

    const staticProgram = validateVisualProgram(entry.static_program, presentationId, 'static', product.blob_index);
    staticPrograms.push(staticProgram);
    const walkingProgram = entry.walking_program;
    if (walkingProgram == null) {
      const reason = entry.walking_fallback_reason;
      requireValue(typeof reason === 'string' && reason.length > 0, 'creature walking fallback reason missing');
      walkingFallbacks += 1;
      fallbackReasons[reason] = (fallbackReasons[reason] ?? 0) + 1;
    } else {
      requireValue(entry.walking_fallback_reason == null, 'resolved walking program must not carry fallback reason');
      walkingPrograms.push(validateVisualProgram(walkingProgram, presentationId, 'moving-in-place', product.blob_index));
    }
    validateEnvelope(entry, staticProgram, walkingProgram);
  }

  return Object.freeze({
    static: summarizePrograms(staticPrograms),
    totalPrograms: product.creature_programs.length,
    walking: summarizePrograms(walkingPrograms),
    walkingFallbackReasons: Object.freeze(Object.fromEntries(Object.entries(fallbackReasons).sort())),
    walkingFallbacks,
    walkingPrograms: walkingPrograms.length,
  });
}
