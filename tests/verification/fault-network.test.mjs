import assert from 'node:assert/strict';
import test from 'node:test';

import { installHeldRangeRequests } from '../../e2e/support/fault-network.mjs';

function fakeRoute() {
  return {
    continued: 0,
    async continue() { this.continued += 1; },
  };
}

function fakeRequest(id) {
  return {
    headers() { return { range: `bytes=${id}-${id}` }; },
    url() { return `http://atlas.test/range/${id}`; },
  };
}

test('releaseAll resumes pass-through for range requests that arrive later', async () => {
  let handler;
  const page = {
    async route(_pattern, value) { handler = value; },
    async unroute() {},
  };
  const faults = await installHeldRangeRequests(page, { limit: 8 });
  const firstRoute = fakeRoute();
  const first = handler(firstRoute, fakeRequest(1));
  await faults.waitForHeld(1);
  faults.releaseAll();
  await first;

  const secondRoute = fakeRoute();
  const second = handler(secondRoute, fakeRequest(2));
  await Promise.resolve();
  const seenAfterResume = faults.evidence().seen.length;
  if (seenAfterResume !== 1) faults.releaseAll();
  await second;
  await faults.dispose();

  assert.equal(seenAfterResume, 1, 'releaseAll must stop fault injection for later requests');
  assert.equal(secondRoute.continued, 1);
});
