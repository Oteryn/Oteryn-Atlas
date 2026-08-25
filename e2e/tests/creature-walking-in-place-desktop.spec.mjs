import { test } from '@playwright/test';
import { proveCreatureWalkingInPlace } from '../support/creature-walking-in-place-proof.mjs';

const PIG = Object.freeze({
  name: 'Pig',
  layer: 'npc',
  recordId: 'npc:d0c8fe31f4e4269a4d8059acc2a781c2',
  position: Object.freeze({ x: 32401, y: 32232, floor: -7 }),
});

test('verified NPC walking playback changes pixels in place and OFF restores exact static pixels', async ({ page }, testInfo) => {
  await proveCreatureWalkingInPlace(page, testInfo, PIG);
});
