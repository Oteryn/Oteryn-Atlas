import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const buildPath = '.github/workflows/atlas-release-artifact.yml';
const livePath = '.github/workflows/synology-live-acceptance.yml';
const manifestToolPath = 'tools/verification/release-artifact-manifest.mjs';
const build = fs.existsSync(buildPath) ? fs.readFileSync(buildPath, 'utf8').replace(/\r\n/g, '\n') : '';
const live = fs.existsSync(livePath) ? fs.readFileSync(livePath, 'utf8').replace(/\r\n/g, '\n') : '';
const tool = fs.existsSync(manifestToolPath) ? fs.readFileSync(manifestToolPath, 'utf8').replace(/\r\n/g, '\n') : '';

test('release artifact is built only from exact protected main on non-Synology compute', () => {
  assert.equal(fs.existsSync(buildPath), true, `${buildPath} is missing`);
  assert.match(build, /push:[\s\S]*branches:\s*\[main\]|push:[\s\S]*- main/);
  assert.match(build, /github\.ref == 'refs\/heads\/main'|GITHUB_REF.*refs\/heads\/main/);
  assert.match(build, /group: atlas-runners/);
  assert.match(build, /labels: oteryn-atlas-pc/);
  assert.doesNotMatch(build, /labels: oteryn-atlas\s*$/m);
  assert.match(build, /Acquire-AtlasExclusiveHostAdmission/);
  assert.match(build, /ResourceClass 'artifact-build'/);
  assert.match(build, /Release-AtlasExclusiveHostAdmission/);
  assert.match(build, /git rev-parse HEAD/);
  assert.match(build, /github\.sha|GITHUB_SHA/);
});

test('artifact manifest binds exact merged-main revision and content digest', () => {
  assert.equal(fs.existsSync(manifestToolPath), true, `${manifestToolPath} is missing`);
  assert.match(tool, /atlasRevision/);
  assert.match(tool, /artifactSha256/);
  assert.match(tool, /artifactBytes/);
  assert.match(tool, /sourceTreeSha256|sourceTreeDigest/);
  assert.match(tool, /sha256:/);
  assert.match(tool, /refus|reject|throw/i);
  assert.doesNotMatch(tool, /Date\.now|new Date|randomUUID|Math\.random/);
});

test('Synology consumes an immutable artifact and does not rebuild reproducible products', () => {
  assert.match(live, /release-artifact|artifact manifest|artifactSha256/i);
  assert.match(live, /sha256sum|Get-FileHash|digest/i);
  assert.match(live, /ATLAS_REV|github\.sha/);
  assert.doesNotMatch(live, /Build exact animated Game and Atlas products/);
  assert.doesNotMatch(live, /game-atlas-appearances\/export\.py/);
  assert.doesNotMatch(live, /build-creature-index\.py/);
  assert.doesNotMatch(live, /animation-runtime\/build\.py/);
  assert.match(live, /rollback/i);
  assert.match(live, /X-Oteryn-Atlas-Revision/);
});

test('task-branch or mismatched release evidence cannot reach deployment', () => {
  assert.match(build, /refs\/heads\/main/);
  assert.match(live, /refs\/heads\/main/);
  assert.match(live, /artifact.*revision|revision.*artifact/is);
  assert.match(live, /artifact.*digest|digest.*artifact/is);
});
