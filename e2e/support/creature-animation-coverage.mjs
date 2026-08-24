const CONTENT_ID = /^sha256:[0-9a-f]{64}$/;
const PRESENTATION_ID = /^outfit-presentation:sha256:[0-9a-f]{64}$/;
const SUPPORTED_LOOPS = new Set(['infinite', 'pingpong', 'counted']);
const PROFILE = 'oteryn-atlas-animation-runtime-v1';

function requireValue(condition, message) {
  if (!condition) throw new Error(`creature animation coverage: ${message}`);
}

function positiveInteger(value) {
  return Number.isSafeInteger(value) && value > 0;
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

export function analyzeCreatureAnimationCoverage(product) {
  requireValue(product && typeof product === 'object', 'animation product missing');
  requireValue(product.profile === PROFILE, 'animation product profile mismatch');
  requireValue(Array.isArray(product.creature_programs), 'creature program list missing');
  requireValue(product.blob_index && typeof product.blob_index === 'object', 'animation blob index missing');

  const seen = new Set();
  const staticEquivalentProgramIds = [];
  const phaseCountHistogram = {};
  let multiPhasePrograms = 0;
  let visuallyDynamicPrograms = 0;
  let phaseContentReferences = 0;

  for (const program of product.creature_programs) {
    requireValue(program && typeof program === 'object', 'creature program invalid');
    requireValue(PRESENTATION_ID.test(program.outfit_presentation_id ?? ''), 'creature presentation id invalid');
    requireValue(!seen.has(program.outfit_presentation_id), `duplicate creature presentation ${program.outfit_presentation_id}`);
    seen.add(program.outfit_presentation_id);
    requireValue(positiveInteger(program.phase_count), 'creature phase count invalid');
    requireValue(positiveInteger(program.width) && positiveInteger(program.height), 'creature program geometry invalid');
    const phaseIds = program.phase_content_ids;
    requireValue(Array.isArray(phaseIds) && phaseIds.length === program.phase_count, 'creature phase content cardinality mismatch');
    requireValue(phaseIds.every((value) => CONTENT_ID.test(value ?? '')), 'creature phase content id invalid');
    for (const contentId of phaseIds) validateBlob(product.blob_index[contentId], program, contentId);

    phaseContentReferences += phaseIds.length;
    phaseCountHistogram[program.phase_count] = (phaseCountHistogram[program.phase_count] ?? 0) + 1;
    if (program.phase_count === 1) continue;

    multiPhasePrograms += 1;
    validateAnimation(program);
    if (new Set(phaseIds).size > 1) visuallyDynamicPrograms += 1;
    else staticEquivalentProgramIds.push(program.outfit_presentation_id);
  }

  staticEquivalentProgramIds.sort();
  return Object.freeze({
    multiPhasePrograms,
    phaseContentReferences,
    phaseCountHistogram: Object.freeze({ ...phaseCountHistogram }),
    staticEquivalentProgramIds: Object.freeze(staticEquivalentProgramIds),
    totalPrograms: product.creature_programs.length,
    visuallyDynamicPrograms,
  });
}
