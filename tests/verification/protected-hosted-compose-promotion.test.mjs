import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

function readRequired(relativePath, label) {
  const url = new URL(`../../${relativePath}`, import.meta.url);
  assert.equal(fs.existsSync(url), true, `${label} is missing from protected control`);
  return fs.readFileSync(url, 'utf8').replace(/\r\n/g, '\n');
}

test('protected hosted executor compose is present and remains fail-closed', () => {
  const compose = readRequired('e2e/compose.protected-hosted-executor.yml', 'protected hosted executor compose');
  assert.match(compose, /ATLAS_EXECUTION_CONTEXT:\?ATLAS_EXECUTION_CONTEXT is required/);
  assert.match(compose, /ATLAS_PROTECTED_TEST_LIST:\?ATLAS_PROTECTED_TEST_LIST is required/);
  assert.match(compose, /--test-list=\/run\/atlas-protected-test-list\.txt/);
  assert.match(compose, /--workers=\$\{ATLAS_E2E_WORKERS:-1\}/);
  assert.match(compose, /--retries=0/);
  assert.match(compose, /networks:\n\s+default:\n\s+internal:\s*true/);
  assert.doesNotMatch(compose, /ipc:\s*host|network_mode:\s*host|192\.168\.|synology|molehill/i);
});

test('protected GitHub-hosted qualification publication is self-contained and LAN-free', () => {
  const override = readRequired('e2e/compose.github-hosted.yml', 'GitHub-hosted qualification compose override');
  const nginx = readRequired('e2e/nginx/qualification-publication.conf', 'qualification publication nginx config');
  assert.match(override, /ghcr\.io\/nginx\/nginx-unprivileged:1\.31\.3-alpine3\.24-slim@sha256:22f839c5fb4007dc24d203a170a9e03fc185d660bfefc34ac6823a7aef085cbc/);
  assert.match(override, /ATLAS_QUALIFICATION_PUBLICATION_HOST:\?/);
  assert.match(override, /qualification-publication\.conf:\/etc\/nginx\/conf\.d\/default\.conf:ro/);
  assert.match(override, /atlas-publication:[\s\S]*condition: service_healthy/);
  assert.match(override, /ATLAS_QUALIFICATION_TRUST_JSON:\?/);
  assert.doesNotMatch(override, /192\.168\.|synology|molehill/i);
  assert.match(nginx, /listen 8081;/);
  assert.match(nginx, /location = \/__atlas\/readiness/);
  assert.match(nginx, /location \^~ \/fullworld\//);
  assert.match(nginx, /location \^~ \/data\/creatures\//);
  assert.doesNotMatch(nginx, /proxy_pass|192\.168\.|synology|molehill/i);
});
