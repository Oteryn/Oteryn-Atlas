const REPOSITORY = 'Oteryn/Oteryn-Atlas';
const AUTHORIZED_ASSOCIATIONS = new Set(['OWNER', 'MEMBER', 'COLLABORATOR']);
const RESOURCE_CLASSES = new Set([
  'cpu-light', 'browser-targeted', 'browser-broad', 'browser-full',
  'render-geometry', 'native-gpu', 'performance', 'soak', 'artifact-build',
]);
const SPECIALIST_CAPABILITIES = Object.freeze({
  'restricted-visual': new Set(['browser-full']),
  'native-windows': new Set(['browser-targeted', 'browser-broad', 'browser-full']),
  'native-gpu': new Set(['native-gpu']),
  'lan-smoke': new Set(['browser-targeted']),
  'hardware-repro': new Set(['render-geometry', 'native-gpu']),
  'specialist-benchmark': new Set(['performance']),
});
const REASON_CAPABILITY = Object.freeze({
  'user-facing-visual-review': 'restricted-visual',
  'windows-browser-differential': 'native-windows',
  'gpu-driver-render-truth': 'native-gpu',
  'lan-publication-smoke': 'lan-smoke',
  'hardware-driver-reproduction': 'hardware-repro',
  'measured-specialist-benchmark': 'specialist-benchmark',
});

function validSha(value) {
  return typeof value === 'string' && /^[a-f0-9]{40}$/i.test(value);
}

function isBot(login) {
  return typeof login === 'string' && /\[bot\]$/i.test(login);
}

function reject(input, reason) {
  return Object.freeze({
    schemaVersion: 2,
    decision: 'reject',
    state: 'rejected',
    reason,
    trustLevel: 'untrusted',
    repository: input?.repository ?? null,
    headSha: input?.headSha ?? null,
    resourceClass: input?.resourceClass ?? null,
    reasonCode: input?.reasonCode ?? null,
    requiredCapability: input?.requiredCapability ?? null,
  });
}

export function decideTrustAdmission(input) {
  if (!input || typeof input !== 'object') return reject(input, 'invalid-admission-input');
  if (input.repository !== REPOSITORY) return reject(input, 'unexpected-repository');
  if (input.eventName !== 'workflow_dispatch') return reject(input, 'untrusted-workflow-context');
  if (input.baseRef !== 'main') return reject(input, 'protected-base-required');
  if (!validSha(input.headSha)) return reject(input, 'invalid-head-sha');
  if (!validSha(input.currentHeadSha)) return reject(input, 'invalid-current-head-sha');
  if (input.headSha.toLowerCase() !== input.currentHeadSha.toLowerCase()) return reject(input, 'superseded-head');
  if (input.headRepository !== REPOSITORY) return reject(input, 'fork-head-rejected');
  if (isBot(input.author)) return reject(input, 'bot-candidate-rejected');
  if (isBot(input.actor)) return reject(input, 'bot-actor-rejected');
  if (!AUTHORIZED_ASSOCIATIONS.has(input.authorAssociation)) return reject(input, 'author-association-not-authorized');
  if (!RESOURCE_CLASSES.has(input.resourceClass)) return reject(input, 'unsupported-resource-class');

  const expectedCapability = REASON_CAPABILITY[input.reasonCode];
  if (!expectedCapability) return reject(input, 'unsupported-specialist-reason');
  if (!Object.hasOwn(SPECIALIST_CAPABILITIES, input.requiredCapability)) return reject(input, 'unsupported-specialist-capability');
  if (expectedCapability !== input.requiredCapability) return reject(input, 'reason-capability-mismatch');
  if (!SPECIALIST_CAPABILITIES[input.requiredCapability].has(input.resourceClass)) {
    return reject(input, 'resource-class-not-authorized-for-capability');
  }

  return Object.freeze({
    schemaVersion: 2,
    decision: 'admit',
    state: 'admitted',
    reason: 'trusted-specialist-exception',
    trustLevel: 'trusted-same-repository',
    repository: REPOSITORY,
    headSha: input.headSha.toLowerCase(),
    resourceClass: input.resourceClass,
    reasonCode: input.reasonCode,
    requiredCapability: input.requiredCapability,
  });
}
