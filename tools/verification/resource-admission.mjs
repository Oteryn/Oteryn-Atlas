const HEALTH_SIGNALS = Object.freeze([
  'cpu', 'hostRam', 'dockerMemory', 'wslMemory', 'sharedMemory', 'diskReserve', 'diskIo',
]);
const BROWSER_HEAVY = new Set(['browser-targeted', 'browser-broad', 'browser-full', 'render-geometry']);
const EXCLUSIVE = new Set(['native-gpu', 'performance', 'soak']);
const MEASURED_BROWSER_FULL_CAPACITY = 2;
const POLICY_ID = 'molehill-bootstrap-safe-v1';

function evidenceEligibility(authoritative, eligible = true) {
  if (!eligible) return 'ineligible';
  return authoritative ? 'authoritative' : 'diagnostic-only';
}

function decision(input, state, reason, eligible = true) {
  return Object.freeze({
    schemaVersion: 1,
    policyId: POLICY_ID,
    resourceClass: input?.resourceClass ?? null,
    state,
    decision: state === 'admitted' ? 'admit' : state,
    reason,
    evidenceEligibility: evidenceEligibility(Boolean(input?.authoritative), eligible),
    measuredBrowserFullCapacity: MEASURED_BROWSER_FULL_CAPACITY,
  });
}

function validateHostHealth(input) {
  const health = input?.hostHealth;
  if (!health || typeof health !== 'object') return 'host-health-missing';
  for (const signal of HEALTH_SIGNALS) {
    const value = health[signal];
    if (value !== 'ok') return `host-health-${signal}-${value ?? 'missing'}`;
  }
  if (input.resourceClass === 'native-gpu') {
    if (health.gpu !== 'ok') return `host-health-gpu-${health.gpu ?? 'missing'}`;
  } else if (!['ok', 'not-applicable'].includes(health.gpu)) {
    return `host-health-gpu-${health.gpu ?? 'missing'}`;
  }
  return null;
}

function runningHeavy(activeLeases) {
  if (!Array.isArray(activeLeases)) return null;
  return activeLeases.filter((lease) => (
    lease && lease.state === 'running'
    && (BROWSER_HEAVY.has(lease.resourceClass)
      || EXCLUSIVE.has(lease.resourceClass)
      || lease.resourceClass === 'artifact-build')
  ));
}

export function decideResourceAdmission(input) {
  if (!input || typeof input !== 'object') return decision(input, 'rejected', 'invalid-resource-input', false);
  if (input.resourceClass === 'deployment-live') return decision(input, 'rejected', 'deployment-live-not-heavy', false);

  const healthFailure = validateHostHealth(input);
  if (healthFailure) return decision(input, 'blocked', healthFailure);

  const active = runningHeavy(input.activeLeases);
  if (!active) return decision(input, 'blocked', 'active-lease-evidence-missing');

  if (EXCLUSIVE.has(input.resourceClass)) {
    if (active.length > 0) return decision(input, 'queued', 'exclusive-resource-conflict');
    if (input.authoritative) return decision(input, 'blocked', 'resource-policy-unmeasured');
    return decision(input, 'admitted', 'diagnostic-exclusive-admission');
  }

  if (input.resourceClass !== 'browser-full') {
    return decision(input, 'blocked', 'resource-policy-unmeasured');
  }

  const slotCount = Number(input.requestedSlotCount ?? MEASURED_BROWSER_FULL_CAPACITY);
  const slot = input.requestedSlot == null ? null : Number(input.requestedSlot);
  if (!Number.isInteger(slotCount) || slotCount < 1 || slotCount > 3) {
    return decision(input, 'rejected', 'invalid-slot-count', false);
  }
  if (slot != null && (!Number.isInteger(slot) || slot < 1 || slot > slotCount)) {
    return decision(input, 'rejected', 'invalid-slot', false);
  }

  if (input.authoritative
    && (slotCount > MEASURED_BROWSER_FULL_CAPACITY
      || (slot != null && slot > MEASURED_BROWSER_FULL_CAPACITY))) {
    return decision(input, 'rejected', 'unmeasured-authoritative-slot-capacity', false);
  }

  const browserRunning = active.filter((lease) => BROWSER_HEAVY.has(lease.resourceClass)).length;
  if (browserRunning >= MEASURED_BROWSER_FULL_CAPACITY) {
    return decision(input, 'queued', 'measured-browser-full-capacity-exhausted');
  }

  return decision(input, 'admitted', input.authoritative
    ? 'measured-browser-full-capacity-available'
    : 'diagnostic-browser-full-capacity-available');
}

export const resourceAdmissionPolicy = Object.freeze({
  schemaVersion: 1,
  id: POLICY_ID,
  measuredBrowserFullCapacity: MEASURED_BROWSER_FULL_CAPACITY,
  unmeasuredAuthoritativeClasses: Object.freeze([
    'browser-targeted', 'browser-broad', 'render-geometry',
    'native-gpu', 'performance', 'soak', 'artifact-build',
  ]),
});
