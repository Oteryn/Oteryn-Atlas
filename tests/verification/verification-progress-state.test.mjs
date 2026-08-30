import assert from 'node:assert/strict';
import test from 'node:test';

import {
  VERIFICATION_STATES,
  advanceProgress,
} from '../../tools/verification/verification-progress-state.mjs';

const semantic = `sha256:${'1'.repeat(64)}`;
const sha = 'a'.repeat(40);

function attempt(failureClass, failureSignature, overrides = {}) {
  return {
    candidateHeadSha: sha,
    planSemanticDigest: semantic,
    failureClass,
    failureSignature,
    stage: 'FANIN',
    ...overrides,
  };
}

test('state machine exposes the required lifecycle and blocked terminal states', () => {
  for (const state of [
    'DISCOVERED', 'AUTHORITY_PREFLIGHT', 'ENVIRONMENT_QUALIFIED', 'PLANNED',
    'EXECUTING', 'FANIN', 'QUALIFIED', 'BASE_COMPATIBILITY', 'MERGE_READY',
    'DONE', 'BLOCKED_CANDIDATE', 'BLOCKED_AUTHORITY', 'BLOCKED_ENVIRONMENT',
    'BLOCKED_PRODUCT', 'BLOCKED_EXTERNAL', 'STALLED',
    'ARCHITECTURE_STABILIZATION_REQUIRED',
  ]) assert.ok(VERIFICATION_STATES.includes(state), state);
});

test('normal successful lifecycle is explicit and immutable', () => {
  let progress = { status: 'DISCOVERED', history: [] };
  for (const event of [
    'START_AUTHORITY_PREFLIGHT',
    'ENVIRONMENT_QUALIFIED',
    'PLAN_BUILT',
    'EXECUTION_STARTED',
    'EXECUTION_COMPLETED',
    'EVIDENCE_QUALIFIED',
    'BASE_UNCHANGED',
    'MERGED',
  ]) progress = advanceProgress(progress, { event });
  assert.equal(progress.status, 'DONE');
  assert.ok(Object.isFrozen(progress));
});

test('unrelated base movement from QUALIFIED enters compatibility instead of restarting discovery', () => {
  const progressed = advanceProgress(
    { status: 'QUALIFIED', history: [] },
    { event: 'BASE_ADVANCED' },
  );
  assert.equal(progressed.status, 'BASE_COMPATIBILITY');

  const reused = advanceProgress(progressed, {
    event: 'BASE_COMPATIBILITY_RESOLVED',
    compatibilityDisposition: 'REUSE',
  });
  assert.equal(reused.status, 'MERGE_READY');
  assert.equal(reused.heavyExecutionsRequired, 0);
});

test('unchanged semantic inputs cannot be repeatedly retriggered after identical deterministic failure', () => {
  const signature = `sha256:${'2'.repeat(64)}`;
  const first = attempt('ENVIRONMENT_FAILURE', signature);
  const second = attempt('ENVIRONMENT_FAILURE', signature);
  const state = advanceProgress(
    { status: 'EXECUTING', history: [first] },
    { event: 'FAILED', failure: second },
  );
  assert.equal(state.status, 'STALLED');
  assert.equal(state.nextAttemptAllowed, false);
});

test('changed semantic input resets identical-failure circuit breaker', () => {
  const signature = `sha256:${'2'.repeat(64)}`;
  const state = advanceProgress(
    { status: 'EXECUTING', history: [attempt('ENVIRONMENT_FAILURE', signature)] },
    {
      event: 'FAILED',
      failure: attempt('ENVIRONMENT_FAILURE', signature, {
        planSemanticDigest: `sha256:${'9'.repeat(64)}`,
      }),
    },
  );
  assert.equal(state.status, 'BLOCKED_ENVIRONMENT');
  assert.equal(state.nextAttemptAllowed, true);
});

test('third serial closeout environment/control-plane defect requires architecture stabilization', () => {
  const history = [
    attempt('ENVIRONMENT_FAILURE', `sha256:${'3'.repeat(64)}`, { code: 'READ_ONLY_LINK', stage: 'FANIN' }),
    attempt('AUTHORITY_FAILURE', `sha256:${'4'.repeat(64)}`, { code: 'PROMOTION_WIRING', stage: 'FANIN' }),
  ];
  const state = advanceProgress(
    { status: 'FANIN', history },
    {
      event: 'FAILED',
      failure: attempt('ENVIRONMENT_FAILURE', `sha256:${'5'.repeat(64)}`, {
        code: 'PYTHON_PYCACHE',
        stage: 'FANIN',
      }),
    },
  );
  assert.equal(state.status, 'ARCHITECTURE_STABILIZATION_REQUIRED');
  assert.equal(state.nextAttemptAllowed, false);
});


test('full rerun uses an explicit unknown or positive heavy execution count, never a sentinel', () => {
  const unknown = advanceProgress(
    { status: 'BASE_COMPATIBILITY', history: [] },
    { event: 'BASE_COMPATIBILITY_RESOLVED', compatibilityDisposition: 'FULL_RERUN' },
  );
  assert.equal(unknown.status, 'EXECUTING');
  assert.equal(unknown.heavyExecutionsRequired, null);

  const known = advanceProgress(
    { status: 'BASE_COMPATIBILITY', history: [] },
    {
      event: 'BASE_COMPATIBILITY_RESOLVED',
      compatibilityDisposition: 'FULL_RERUN',
      heavyExecutionsRequired: 4,
    },
  );
  assert.equal(known.heavyExecutionsRequired, 4);
  assert.throws(
    () => advanceProgress(
      { status: 'BASE_COMPATIBILITY', history: [] },
      {
        event: 'BASE_COMPATIBILITY_RESOLVED',
        compatibilityDisposition: 'FULL_RERUN',
        heavyExecutionsRequired: -1,
      },
    ),
    /positive integer/i,
  );
});
