import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const overrideUrl = new URL('../../e2e/compose.github-hosted.yml', import.meta.url);
const publicationNginxUrl = new URL('../../e2e/nginx/qualification-publication.conf', import.meta.url);

function readRequired(url, label) {
  assert.equal(fs.existsSync(url), true, `${label} is missing`);
  return fs.readFileSync(url, 'utf8').replace(/\r\n/g, '\n');
}

test('GitHub-hosted qualification compose serves the ready fixture without LAN or specialist dependencies', () => {
  const override = readRequired(overrideUrl, 'GitHub-hosted Compose override');
  assert.match(override, /atlas-publication:/);
  assert.match(override, /ghcr\.io\/nginx\/nginx-unprivileged:1\.31\.3-alpine3\.24-slim@sha256:22f839c5fb4007dc24d203a170a9e03fc185d660bfefc34ac6823a7aef085cbc/);
  assert.match(override, /\$\{ATLAS_QUALIFICATION_PUBLICATION_HOST:\?[^}]+\}:\/srv\/atlas\/fullworld:ro/);
  assert.match(override, /qualification-publication\.conf:\/etc\/nginx\/conf\.d\/default\.conf:ro/);
  assert.match(override, /__atlas\/readiness/);
  assert.match(override, /publication\/publication\.json/);
  assert.match(override, /atlas-web:[\s\S]*depends_on:[\s\S]*atlas-publication:[\s\S]*condition: service_healthy/);
  assert.match(override, /ATLAS_PUBLICATION_UPSTREAM: atlas-publication:8081/);
  assert.match(override, /ATLAS_PUBLICATION_HOST_HEADER: atlas-publication/);
  assert.match(override, /e2e:[\s\S]*ATLAS_QUALIFICATION_TRUST_JSON: \$\{ATLAS_QUALIFICATION_TRUST_JSON:\?/);
  assert.doesNotMatch(override, /192\.168\.|synology|molehill/i);
});

test('qualification publication nginx exposes readiness and immutable fixture bytes as static content', () => {
  const nginx = readRequired(publicationNginxUrl, 'qualification publication nginx config');
  assert.match(nginx, /listen 8081;/);
  assert.match(nginx, /root \/srv\/atlas;/);
  assert.match(nginx, /location = \/__atlas\/readiness[\s\S]*alias \/srv\/atlas\/fullworld\/atlas-publication-readiness\.json;/);
  assert.match(nginx, /location \^~ \/fullworld\/[\s\S]*try_files \$uri =404;/);
  assert.match(nginx, /Cache-Control "no-store"/);
  assert.doesNotMatch(nginx, /proxy_pass|192\.168\.|synology|molehill/i);
});
