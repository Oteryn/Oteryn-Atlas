const REPOSITORY = 'Oteryn/Oteryn-Atlas';
const AUTHORIZED_ASSOCIATIONS = new Set(['OWNER', 'MEMBER', 'COLLABORATOR']);
const RESOURCE_CLASSES = new Set([
  'cpu-light', 'browser-targeted', 'browser-broad', 'browser-full',
  'render-geometry', 'native-gpu', 'performance', 'soak', 'artifact-build',
]);

function validSha(value) {
  return typeof value === 'string' && /^[a-f0-9]{40}$/i.test(value);
}

function isBot(login) {
  return typeof login === 'string' && /\[bot\]$/i.test(login);
}

function reject(input, reason) {
  return Object.freeze({
    schemaVersion: 1,
    decision: 'reject',
    state: 'rejected',
    reason,
    trustLevel: 'untrusted',
    repository: input?.repository ?? null,
    headSha: input?.headSha ?? null,
    resourceClass: input?.resourceClass ?? null,
  });
}

export function decideTrustAdmission(input) {
  if (!input || typeof input !== 'object') return reject(input, 'invalid-admission-input');
  if (input.repository !== REPOSITORY) return reject(input, 'unexpected-repository');
  if (input.eventName !== 'pull_request_target') return reject(input, 'untrusted-workflow-context');
  if (input.baseRef !== 'main') return reject(input, 'protected-base-required');
  if (!validSha(input.headSha)) return reject(input, 'invalid-head-sha');
  if (!validSha(input.currentHeadSha)) return reject(input, 'invalid-current-head-sha');
  if (input.headSha.toLowerCase() !== input.currentHeadSha.toLowerCase()) return reject(input, 'superseded-head');
  if (input.headRepository !== REPOSITORY) return reject(input, 'fork-head-rejected');
  if (isBot(input.author)) return reject(input, 'bot-candidate-rejected');
  if (isBot(input.actor)) return reject(input, 'bot-actor-rejected');
  if (!AUTHORIZED_ASSOCIATIONS.has(input.authorAssociation)) return reject(input, 'author-association-not-authorized');
  if (!RESOURCE_CLASSES.has(input.resourceClass)) return reject(input, 'unsupported-resource-class');

  return Object.freeze({
    schemaVersion: 1,
    decision: 'admit',
    state: 'admitted',
    reason: 'trusted-same-repository-member',
    trustLevel: 'trusted-same-repository',
    repository: REPOSITORY,
    headSha: input.headSha.toLowerCase(),
    resourceClass: input.resourceClass,
  });
}
