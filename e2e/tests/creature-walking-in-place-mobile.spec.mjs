import { test } from '@playwright/test';
import { proveCreatureWalkingInPlace } from '../support/creature-walking-in-place-proof.mjs';

const CHICKEN = Object.freeze({
  name: 'Chicken',
  layer: 'monster',
  recordId: 'monster:b831f379cb1373b87cf3f330f2562fc9',
  position: Object.freeze({ x: 32881, y: 31330, floor: -7 }),
});

test('verified monster walking playback changes pixels in place and OFF restores exact static pixels', async ({ page }, testInfo) => {
  await proveCreatureWalkingInPlace(page, testInfo, CHICKEN);
});
