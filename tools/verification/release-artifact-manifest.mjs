import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const SHA = /^[a-f0-9]{40}$/i;
const SHA256 = /^sha256:[a-f0-9]{64}$/;

function fail(message) {
  throw new Error(`release-artifact-manifest: ${message}`);
}

function sha256(bytes) {
  return `sha256:${crypto.createHash('sha256').update(bytes).digest('hex')}`;
}

function parseArgs(argv) {
  const out = {};
  for (let index = 0; index < argv.length; index += 2) {
    const flag = argv[index];
    const value = argv[index + 1];
    if (!flag?.startsWith('--') || value == null || Object.hasOwn(out, flag)) fail('requires unique --flag value pairs');
    out[flag] = value;
  }
  return out;
}

export function sourceTreeDigest(root) {
  const resolved = path.resolve(root);
  if (!fs.statSync(resolved).isDirectory()) fail('source tree is not a directory');
  const records = [];
  const walk = (directory) => {
    for (const name of fs.readdirSync(directory).sort()) {
      if (name === '.git') continue;
      const absolute = path.join(directory, name);
      const relative = path.relative(resolved, absolute).split(path.sep).join('/');
      const stat = fs.lstatSync(absolute);
      if (stat.isDirectory()) walk(absolute);
      else if (stat.isFile()) records.push(`${relative}\0${sha256(fs.readFileSync(absolute))}\0${stat.mode & 0o111 ? 'x' : '-'}`);
      else fail(`unsupported source entry: ${relative}`);
    }
  };
  walk(resolved);
  return sha256(Buffer.from(`${records.join('\n')}\n`, 'utf8'));
}

export function createReleaseArtifactManifest({ atlasRevision, artifactPath, sourceTreePath, productRoots = {} }) {
  if (!SHA.test(atlasRevision ?? '')) fail('invalid atlasRevision');
  const artifact = path.resolve(artifactPath);
  const stat = fs.statSync(artifact);
  if (!stat.isFile() || stat.size <= 0) fail('artifact must be a non-empty file');
  for (const [name, digest] of Object.entries(productRoots)) {
    if (typeof name !== 'string' || !name || !SHA256.test(digest)) fail(`invalid product root: ${name}`);
  }
  return Object.freeze({
    schemaVersion: 1,
    kind: 'atlas-merged-main-release-artifact',
    atlasRevision: atlasRevision.toLowerCase(),
    artifactSha256: sha256(fs.readFileSync(artifact)),
    artifactBytes: stat.size,
    sourceTreeSha256: sourceTreeDigest(sourceTreePath),
    productRoots: Object.fromEntries(Object.entries(productRoots).sort(([a], [b]) => a.localeCompare(b))),
  });
}

function runCli() {
  const args = parseArgs(process.argv.slice(2));
  for (const flag of ['--atlas-revision', '--artifact', '--source-tree', '--output']) {
    if (!Object.hasOwn(args, flag)) fail(`missing ${flag}`);
  }
  const productRoots = args['--product-roots'] ? JSON.parse(fs.readFileSync(args['--product-roots'], 'utf8')) : {};
  const manifest = createReleaseArtifactManifest({
    atlasRevision: args['--atlas-revision'],
    artifactPath: args['--artifact'],
    sourceTreePath: args['--source-tree'],
    productRoots,
  });
  fs.writeFileSync(path.resolve(args['--output']), `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
  process.stdout.write(`${manifest.artifactSha256}\n`);
}

if (pathToFileURL(path.resolve(process.argv[1] ?? '')).href === import.meta.url) {
  try { runCli(); } catch (error) { process.stderr.write(`${error.message}\n`); process.exitCode = 1; }
}
