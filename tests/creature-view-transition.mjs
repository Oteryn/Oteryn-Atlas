import assert from 'node:assert/strict';
import test from 'node:test';
import { creatureAnimationTransition } from '../src/browser/creature-view-transition.mjs';

test('creature animation state transitions require prepared-frame revalidation', () => {
  assert.deepEqual(creatureAnimationTransition(null, { animation: 'off' }), { animationOn: false, requiresReprepare: false });
  assert.deepEqual(creatureAnimationTransition({ animation: 'off' }, { animation: 'off' }), { animationOn: false, requiresReprepare: false });
  assert.deepEqual(creatureAnimationTransition({ animation: 'off' }, { animation: 'on' }), { animationOn: true, requiresReprepare: true });
  assert.deepEqual(creatureAnimationTransition({ animation: 'on' }, { animation: 'off' }), { animationOn: false, requiresReprepare: true });
});