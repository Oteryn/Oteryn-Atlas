import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const modulePath = 'e2e/support/user-journey-actions.mjs';
const desktopSpec = 'e2e/tests/user-journey-desktop.spec.mjs';
const mobileSpec = 'e2e/tests/user-journey-mobile.spec.mjs';

const requiredDesktop = new Set([
  'search', 'zoom', 'pan', 'mode', 'floor', 'creature', 'playback', 'history', 'reload',
]);
const requiredMobile = new Set([
  'drawer', 'search', 'mode', 'floor', 'creature', 'playback', 'resize', 'history', 'reload',
]);

test('real-user journey verification layer exists in the Playwright suite', () => {
  assert.equal(fs.existsSync(modulePath), true, `${modulePath} is missing`);
  assert.equal(fs.existsSync(desktopSpec), true, `${desktopSpec} is missing`);
  assert.equal(fs.existsSync(mobileSpec), true, `${mobileSpec} is missing`);
});

if (fs.existsSync(modulePath)) {
  const {
    generateUserJourney,
    parseUserJourney,
    serializeUserJourney,
  } = await import('../../e2e/support/user-journey-actions.mjs');

  test('desktop user journey is deterministic and contains the required behavior backbone', () => {
    const first = generateUserJourney(0x158, { surface: 'desktop', length: 12 });
    const second = generateUserJourney(0x158, { surface: 'desktop', length: 12 });
    assert.deepEqual(first, second);
    assert.equal(first.length, 12);
    const types = new Set(first.map((action) => action.type));
    for (const type of requiredDesktop) assert.equal(types.has(type), true, `desktop journey missing ${type}`);
  });

  test('mobile user journey is deterministic and contains touch/responsive behavior backbone', () => {
    const first = generateUserJourney(0x9158, { surface: 'mobile', length: 12 });
    const second = generateUserJourney(0x9158, { surface: 'mobile', length: 12 });
    assert.deepEqual(first, second);
    assert.equal(first.length, 12);
    const types = new Set(first.map((action) => action.type));
    for (const type of requiredMobile) assert.equal(types.has(type), true, `mobile journey missing ${type}`);
  });

  test('user journey action log round-trips exactly for replay', () => {
    const actions = generateUserJourney(0xdeadbeef, { surface: 'desktop', length: 14 });
    assert.deepEqual(parseUserJourney(serializeUserJourney(actions)), actions);
  });

  test('user journey parser rejects unknown and unbounded actions', () => {
    assert.throws(() => parseUserJourney('[{"type":"teleport"}]'), /action type invalid/);
    assert.throws(() => parseUserJourney('[{"type":"pan","dx":9999,"dy":0}]'), /pan action invalid/);
    assert.throws(() => parseUserJourney('[]'), /1-64 actions/);
  });
}

test('local E2E status publisher accounts for all four new user-journey scenarios', () => {
  const publisher = fs.readFileSync('e2e/publish-local-e2e-status.ps1', 'utf8');
  const readme = fs.readFileSync('e2e/README.md', 'utf8');
  assert.match(publisher, /\$ExpectedScenarioCount = 64\b/);
  assert.match(readme, /64-scenario exact-head PR gate/);
});
