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
  assert.match(compose, /atlas-web:[\s\S]*ATLAS_QUALIFICATION_TRUST_JSON:\s*\$\{ATLAS_QUALIFICATION_TRUST_JSON:\?ATLAS_QUALIFICATION_TRUST_JSON is required\}/);
  assert.match(compose, /healthcheck:[\s\S]*\$\$ATLAS_QUALIFICATION_TRUST_JSON[\s\S]*\/web\/fullworld\.html/);
  assert.match(compose, /--test-list=\/run\/atlas-protected-test-list\.txt/);
  assert.match(compose, /--workers=\$\{ATLAS_E2E_WORKERS:-1\}/);
  assert.match(compose, /--retries=0/);
  assert.match(compose, /networks:\n\s+default:\n\s+internal:\s*true/);
  assert.doesNotMatch(compose, /ipc:\s*host|network_mode:\s*host|192\.168\.|synology|molehill/i);
});

test('protected GitHub-hosted qualification publication is atomically readied, self-contained and LAN-free', () => {
  const override = readRequired('e2e/compose.github-hosted.yml', 'GitHub-hosted qualification compose override');
  const nginx = readRequired('e2e/nginx/qualification-publication.conf', 'qualification publication nginx config');

  assert.match(override, /atlas-publication-ready:/);
  assert.match(override, /mcr\.microsoft\.com\/playwright:v1\.62\.0-noble@sha256:baed2032d533817f3dbe6425de795788430ba345e819a1201337009ba17c9d07/);
  assert.match(override, /network_mode:\s*none/);
  assert.match(override, /cap_drop:\s*\n\s+- ALL/);
  assert.match(override, /no-new-privileges:true/);
  assert.match(override, /publication-readiness\.mjs/);
  assert.match(override, /publishReadyPublication/);
  assert.match(override, /validateReadyPublication/);
  assert.match(override, /publicationDir\s*=\s*'\/ready\/fullworld'/);
  assert.match(override, /producerRunId:\s*process\.env\.GITHUB_RUN_ID \+ '-' \+ shardOrdinal/);
  assert.match(override, /atlas-ready-publication:\/ready/);
  assert.match(override, /atlas-publication-ready:[\s\S]*condition: service_completed_successfully/);

  assert.match(override, /ghcr\.io\/nginx\/nginx-unprivileged:1\.31\.3-alpine3\.24-slim@sha256:22f839c5fb4007dc24d203a170a9e03fc185d660bfefc34ac6823a7aef085cbc/);
  assert.match(override, /atlas-ready-publication:\/srv\/atlas:ro/);
  assert.doesNotMatch(override, /ATLAS_QUALIFICATION_PUBLICATION_HOST[^\n]*:\/srv\/atlas\/fullworld/);
  assert.match(override, /qualification-publication\.conf:\/etc\/nginx\/conf\.d\/default\.conf:ro/);
  assert.match(override, /atlas-publication:[\s\S]*condition: service_healthy/);
  assert.match(override, /ATLAS_QUALIFICATION_TRUST_JSON:\?/);
  assert.doesNotMatch(override, /192\.168\.|synology|molehill/i);

  assert.match(nginx, /listen 8081;/);
  assert.match(nginx, /location = \/__atlas\/readiness/);
  assert.match(nginx, /alias \/srv\/atlas\/fullworld\/atlas-publication-readiness\.json/);
  assert.match(nginx, /location = \/fullworld\/atlas-publication-readiness\.json[\s\S]*return 404/);
  assert.match(nginx, /location \^~ \/fullworld\//);
  assert.match(nginx, /location \^~ \/data\/creatures\/[\s\S]*root \/srv\/atlas\/fullworld;/);
  assert.doesNotMatch(nginx, /proxy_pass|192\.168\.|synology|molehill/i);
});

test('protected hosted web bootstrap injects immutable qualification trust before candidate modules without changing navigation', () => {
  const override = readRequired('e2e/compose.github-hosted.yml', 'GitHub-hosted qualification compose override');
  assert.match(override, /atlas-web-ready:/);
  assert.match(override, /network_mode:\s*none/);
  assert.match(override, /ATLAS_QUALIFICATION_TRUST_JSON:\s*\$\{ATLAS_QUALIFICATION_TRUST_JSON:\?ATLAS_QUALIFICATION_TRUST_JSON must identify verified qualification roots\}/);
  assert.match(override, /ATLAS_EXECUTION_CONTEXT:\?ATLAS_EXECUTION_CONTEXT is required\}\/web:\/source-web:ro/);
  assert.match(override, /atlas-ready-web:\/ready-web/);
  assert.match(override, /const expectedWeb = '\/tmp\/expected-web'/);
  assert.match(override, /fs\.cpSync\('\/source-web', expectedWeb, \{ recursive: true \}\)/);
  assert.match(override, /__OTERYN_ATLAS_QUALIFICATION_TRUST__/);
  assert.match(override, /Object\.defineProperty\(globalThis/);
  assert.match(override, /Object\.freeze\('/);
  assert.match(override, /writable: false, configurable: false, enumerable: false/);
  assert.match(override, /const head = '<head>'/);
  assert.match(override, /source\.indexOf\('<script'\)/);
  assert.match(override, /atlas-web-ready:[\s\S]*condition: service_completed_successfully/);
  assert.match(override, /atlas-ready-web:\/usr\/share\/nginx\/html\/web:ro/);
  assert.match(override, /volumes:[\s\S]*atlas-ready-web:/);
  assert.doesNotMatch(override, /\/source-web:(?!ro)|\/ready-web:ro/);
  assert.doesNotMatch(override, /qualificationEntry|history\.replaceState|searchParams\.set\(['"](?:x|y|floor)['"]/);
});

test('protected hosted web bootstrap reentry is exact validation only and never overwrites stale bytes', () => {
  const override = readRequired('e2e/compose.github-hosted.yml', 'GitHub-hosted qualification compose override');
  assert.match(override, /function treeDigest\(root\)/);
  assert.match(override, /fs\.lstatSync\(absolute\)/);
  assert.match(override, /stat\.isSymbolicLink\(\)/);
  assert.match(override, /const expectedDigest = treeDigest\(expectedWeb\)/);
  assert.match(override, /const readyEntries = fs\.readdirSync\('\/ready-web'\)/);
  assert.match(override, /if \(readyEntries\.length === 0\) \{/);
  assert.match(override, /copyDirectoryContents\(expectedWeb, '\/ready-web'\)/);
  assert.match(override, /const readyDigest = treeDigest\('\/ready-web'\)/);
  assert.match(override, /if \(readyDigest !== expectedDigest\)/);
  assert.match(override, /protected web bootstrap re-entry digest mismatch/);
  assert.doesNotMatch(override, /rmSync\('\/ready-web'|force:\s*true[^\n]*\/ready-web|overwrite/i);
});

test('protected readiness init is re-entry safe only by exact validation, never overwrite', () => {
  const override = readRequired('e2e/compose.github-hosted.yml', 'GitHub-hosted qualification compose override');
  const publicationReadyBlock = override.match(/  atlas-publication-ready:[\s\S]*?\n  atlas-publication:/)?.[0] ?? '';
  assert.notEqual(publicationReadyBlock, '', 'atlas-publication-ready compose block is missing');
  assert.match(publicationReadyBlock, /const readinessPath = publicationDir \+ '\/atlas-publication-readiness\.json'/);
  assert.match(publicationReadyBlock, /if \(fs\.existsSync\(readinessPath\)\) \{[\s\S]*JSON\.parse\(fs\.readFileSync\(readinessPath, 'utf8'\)\)/);
  assert.match(publicationReadyBlock, /else \{[\s\S]*publishReadyPublication\([\s\S]*destinationDir: publicationDir/);
  assert.match(publicationReadyBlock, /validateReadyPublication\([\s\S]*publicationDir,[\s\S]*manifest,[\s\S]*\.\.\.identity/);
  assert.doesNotMatch(publicationReadyBlock, /force:\s*true|overwrite|rmSync\(publicationDir/);
});

test('protected hosted executor materializes dedicated exact browser trust for qualification fixture', () => {
  const workflow = readRequired('.github/workflows/protected-hosted-executor.yml', 'protected hosted executor workflow');
  assert.match(workflow, /qualificationTrustDescriptor/);
  assert.match(workflow, /product-trust/);
  assert.match(workflow, /qualification_fixture\.json/);
  assert.match(workflow, /JSON\.stringify\(qualificationTrustDescriptor\(manifest\)\)/);
  assert.doesNotMatch(workflow, /trustPath:\s*path\.join\(destination,\s*'fixture-manifest\.json'\)/);
});