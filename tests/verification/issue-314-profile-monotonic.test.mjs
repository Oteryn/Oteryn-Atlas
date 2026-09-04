import assert from 'node:assert/strict';
import test from 'node:test';

import { validateQualificationRepairTransition } from '../../tools/verification/qualification-repair-policy.mjs';

const basePlan = {
  requiredGroupIds: ['deterministic.core', 'e2e.full'],
  requiredDataCapabilities: ['qualification_fixture'],
  retryPolicy: { retries: 0 },
};

test('qualification repair uses canonical focused < targeted profile ordering', () => {
  assert.throws(() => validateQualificationRepairTransition({
    changedPaths: ['web/fullworld-creatures.mjs'],
    protectedPlan: { ...basePlan, profile: 'targeted' },
    candidatePlan: { ...basePlan, profile: 'focused' },
  }), /narrows protected verification profile/i);
});
