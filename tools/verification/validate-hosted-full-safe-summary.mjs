const SHA40 = /^[a-f0-9]{40}$/;
const SHA256 = /^sha256:[a-f0-9]{64}$/;

function invalid(detail) {
  throw new TypeError(`hosted full-safety summary invalid: ${detail}`);
}

function exactStableIds(values, kind) {
  if (!Array.isArray(values) || values.length === 0 || values.some((value) => typeof value !== 'string' || value.length === 0)) {
    invalid(`${kind} stable IDs must be non-empty strings`);
  }
  if (new Set(values).size !== values.length) invalid(`${kind} contains duplicate stable IDs`);
  return [...values].sort();
}

export function validateHostedFullSafeSummary({
  summary,
  expectedStableTestIds,
  expectedHeadSha,
  expectedPlanDigest,
  expectedWorkers,
  expectedPublicationOrigin,
}) {
  if (!summary || typeof summary !== 'object' || Array.isArray(summary)) invalid('summary must be an object');
  if (summary.status !== 'passed') invalid('summary status must be passed');
  if (!summary.metadata || typeof summary.metadata !== 'object' || Array.isArray(summary.metadata)) {
    invalid('summary metadata is missing');
  }
  if (!SHA40.test(expectedHeadSha) || summary.metadata.expectedRevision !== expectedHeadSha) {
    invalid('revision does not match exact candidate head');
  }
  if (!SHA256.test(expectedPlanDigest) || summary.metadata.verificationPlanSha256 !== expectedPlanDigest) {
    invalid('plan digest does not match authoritative plan');
  }
  if (summary.metadata.targetMode !== 'checkout-overlay') invalid('target mode must be checkout-overlay');
  if (typeof expectedPublicationOrigin !== 'string' || expectedPublicationOrigin.length === 0
    || summary.metadata.publicationOrigin !== expectedPublicationOrigin) {
    invalid('publication origin does not match ready qualification publication');
  }
  if (!Number.isInteger(expectedWorkers) || expectedWorkers < 1 || summary.metadata.workers !== expectedWorkers) {
    invalid('worker count does not match the required execution policy');
  }

  const expected = exactStableIds(expectedStableTestIds, 'expected');
  if (!Array.isArray(summary.scenarios)) invalid('scenarios array is missing');
  const actual = [];
  for (const scenario of summary.scenarios) {
    if (!scenario || typeof scenario !== 'object' || Array.isArray(scenario)
      || typeof scenario.stableTestId !== 'string' || scenario.stableTestId.length === 0) {
      invalid('scenario stable ID is malformed');
    }
    if (scenario.status !== 'passed') invalid(`scenario ${scenario.stableTestId} status must be passed`);
    if (scenario.retry !== 0) invalid(`scenario ${scenario.stableTestId} retry must be zero`);
    actual.push(scenario.stableTestId);
  }
  const sortedActual = exactStableIds(actual, 'actual');
  const expectedSet = new Set(expected);
  const actualSet = new Set(sortedActual);
  const missing = expected.filter((stableTestId) => !actualSet.has(stableTestId));
  if (missing.length) invalid(`missing stable IDs: ${missing.join(', ')}`);
  const unexpected = sortedActual.filter((stableTestId) => !expectedSet.has(stableTestId));
  if (unexpected.length) invalid(`unexpected stable IDs: ${unexpected.join(', ')}`);

  return Object.freeze({
    status: 'success',
    candidateHeadSha: expectedHeadSha,
    planDigest: expectedPlanDigest,
    workers: expectedWorkers,
    stableTestIds: Object.freeze(sortedActual),
  });
}
