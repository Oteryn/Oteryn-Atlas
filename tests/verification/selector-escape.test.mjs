import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

import {
  recordSelectorMiss,
  resolveSelectorFallback,
  validateSelectorEscapeState,
} from '../../tools/verification/selector-escape.mjs';

const A = 'desktop-chromium::e2e/tests/a.spec.mjs::alpha';
const B = 'desktop-chromium::e2e/tests/b.spec.mjs::beta';
const C = 'mobile-chromium::e2e/tests/c.spec.mjs::gamma';
const HEAD = 'a'.repeat(40);
const DIGEST = `sha256:${'b'.repeat(64)}`;

function inactiveState(overrides = {}) {
  return {
    schemaVersion: 1,
    selectiveExecutionEnabled: false,
    escapeActive: false,
    events: [],
    ...overrides,
  };
}

test('committed selector escape state is inactive and selective execution is disabled', () => {
  const state = JSON.parse(fs.readFileSync('tools/verification/selector-escape-state.json', 'utf8'));
  const validated = validateSelectorEscapeState(state);
  assert.equal(validated.selectiveExecutionEnabled, false);
  assert.equal(validated.escapeActive, false);
  assert.deepEqual(validated.events, []);
});

test('a proven selector miss appends deterministic audit evidence and activates escape', () => {
  const state = recordSelectorMiss({
    state: inactiveState(),
    evidence: {
      caseId: 'historical-pr-88-creature-pan-drift',
      candidateHeadSha: HEAD,
      planDigest: DIGEST,
      falseNegativeStableTestIds: [B],
    },
    fullSafeStableTestIds: [A, B, C],
  });
  assert.equal(state.escapeActive, true);
  assert.equal(state.events.length, 1);
  assert.equal(state.events[0].caseId, 'historical-pr-88-creature-pan-drift');
  assert.deepEqual(state.events[0].falseNegativeStableTestIds, [B]);
  assert.match(state.events[0].evidenceDigest, /^sha256:[a-f0-9]{64}$/);

  const second = recordSelectorMiss({
    state,
    evidence: {
      caseId: 'second-miss',
      candidateHeadSha: HEAD,
      planDigest: DIGEST,
      falseNegativeStableTestIds: [A],
    },
    fullSafeStableTestIds: [A, B, C],
  });
  assert.equal(second.events.length, 2);
  assert.deepEqual(second.events[0], state.events[0]);
});

test('disabled rollout, force-full and active selector escape all resolve to exact full-safe IDs', () => {
  const full = [A, B, C];
  const disabled = resolveSelectorFallback({
    state: inactiveState(),
    forceFull: false,
    selectiveStableTestIds: [A],
    fullSafeStableTestIds: full,
  });
  assert.equal(disabled.mode, 'FULL_SAFE');
  assert.equal(disabled.reason, 'selective-execution-disabled');
  assert.deepEqual(disabled.stableTestIds, full);

  const futureEnabled = inactiveState({ selectiveExecutionEnabled: true });
  const forced = resolveSelectorFallback({ state: futureEnabled, forceFull: true, selectiveStableTestIds: [A], fullSafeStableTestIds: full });
  assert.equal(forced.reason, 'force-full');
  assert.deepEqual(forced.stableTestIds, full);

  const escaped = resolveSelectorFallback({ state: { ...futureEnabled, escapeActive: true }, forceFull: false, selectiveStableTestIds: [A], fullSafeStableTestIds: full });
  assert.equal(escaped.reason, 'selector-escape-active');
  assert.deepEqual(escaped.stableTestIds, full);
});

test('inactive future selector mode may use only a validated subset and cannot introduce IDs outside full safe', () => {
  const state = inactiveState({ selectiveExecutionEnabled: true });
  const selected = resolveSelectorFallback({ state, selectiveStableTestIds: [B, A], fullSafeStableTestIds: [A, B, C] });
  assert.equal(selected.mode, 'SELECTIVE_SHADOW');
  assert.deepEqual(selected.stableTestIds, [A, B]);
  assert.throws(() => resolveSelectorFallback({ state, selectiveStableTestIds: ['desktop::bad::outside'], fullSafeStableTestIds: [A, B, C] }), /outside full-safe universe/);
});

test('malformed feedback and attempted inactive state with prior escape events fail closed', () => {
  assert.throws(() => recordSelectorMiss({
    state: inactiveState(),
    evidence: { caseId: 'bad', candidateHeadSha: HEAD, planDigest: DIGEST, falseNegativeStableTestIds: [] },
    fullSafeStableTestIds: [A],
  }), /non-empty/);
  assert.throws(() => validateSelectorEscapeState({
    ...inactiveState(),
    events: [{ caseId: 'x' }],
  }), /escapeActive must remain true/);
});

test('force-full and selector escape widen hosted full-safe without dropping selected specialist obligations', () => {
  const specialist = 'desktop-chromium::e2e/tests/fullworld-animation-census-desktop.spec.mjs::complete census';
  const state = inactiveState({ selectiveExecutionEnabled: true });
  const forced = resolveSelectorFallback({
    state,
    forceFull: true,
    selectiveStableTestIds: [specialist],
    fullSafeStableTestIds: [A, B],
    allowedAdditionalStableTestIds: [specialist],
  });
  assert.deepEqual(forced.stableTestIds, [A, B, specialist].sort());

  const escaped = resolveSelectorFallback({
    state: { ...state, escapeActive: true },
    selectiveStableTestIds: [specialist],
    fullSafeStableTestIds: [A, B],
    allowedAdditionalStableTestIds: [specialist],
  });
  assert.deepEqual(escaped.stableTestIds, [A, B, specialist].sort());
});

test('selector miss feedback records specialist false negatives from the explicit additional universe', () => {
  const specialist = 'desktop-chromium::e2e/tests/fullworld-animation-census-desktop.spec.mjs::complete census';
  const state = recordSelectorMiss({
    state: inactiveState(),
    evidence: {
      caseId: 'specialist-miss',
      candidateHeadSha: HEAD,
      planDigest: DIGEST,
      falseNegativeStableTestIds: [specialist],
    },
    fullSafeStableTestIds: [A, B],
    allowedAdditionalStableTestIds: [specialist],
  });
  assert.equal(state.escapeActive, true);
  assert.deepEqual(state.events[0].falseNegativeStableTestIds, [specialist]);
});
