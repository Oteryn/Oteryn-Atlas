import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const agents = fs.readFileSync(new URL('../../AGENTS.md', import.meta.url), 'utf8').replace(/\r\n/g, '\n');

test('execution policy separates verification profile from data capability', () => {
  assert.match(agents, /verification profile.*independent.*data capability/i);
  for (const capability of ['qualification_fixture', 'bounded_real_world', 'real_fullworld']) {
    assert.match(agents, new RegExp(`\\b${capability}\\b`));
  }
  assert.match(agents, /profile.?=.?full.*does not imply.*real_fullworld/i);
});

test('ordinary functional E2E is GitHub-hosted and Molehill is specialist-only', () => {
  assert.match(agents, /GitHub-hosted.*ordinary functional E2E/i);
  assert.match(agents, /Molehill-PC.*specialist/i);
  assert.match(agents, /requiresRealFullWorld/i);
  assert.match(agents, /Synology.*deployment.*live acceptance/i);
  assert.doesNotMatch(agents, /GitHub-hosted CI owns[\s\S]{0,300}does not replace the heavy physical browser qualification/i);
  assert.doesNotMatch(agents, /Molehill-PC[^\n]*owns heavy exact-head browser verification:[^\n]*full Docker Playwright PR gate/i);
});

test('legacy atlas-local-e2e is explicitly transitional rather than target architecture', () => {
  assert.match(agents, /atlas-local-e2e.*legacy|legacy.*atlas-local-e2e/i);
  assert.match(agents, /not (?:the )?target architecture/i);
});
