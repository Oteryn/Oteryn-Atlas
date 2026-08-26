import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

const SHA256 = /^sha256:[a-f0-9]{64}$/;
const SHA = /^[a-f0-9]{40}$/;
const MANIFEST_NAME = 'atlas-publication-readiness.json';

function digest(value) {
  return `sha256:${crypto.createHash('sha256').update(value).digest('hex')}`;
}

function requireIdentity({ repository, candidateSha, planDigest, producerRunId, harnessDigest }) {
  if (repository !== 'Oteryn/Oteryn-Atlas' || !SHA.test(candidateSha) || !SHA256.test(planDigest)
    || typeof producerRunId !== 'string' || !/^[0-9]+-[1-9][0-9]*$/.test(producerRunId) || !SHA256.test(harnessDigest)) {
    throw new TypeError('publication readiness identity is invalid');
  }
  return { repository, candidateSha, planDigest, producerRunId, harnessDigest };
}

function filesUnder(root) {
  const files = [];
  const walk = (directory) => {
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      const absolute = path.join(directory, entry.name);
      const relative = path.relative(root, absolute).replaceAll(path.sep, '/');
      if (entry.isDirectory()) walk(absolute);
      else if (entry.isFile() && relative !== MANIFEST_NAME) files.push(relative);
      else if (!entry.isFile()) throw new TypeError('publication contains an unsupported filesystem entry');
    }
  };
  walk(root);
  return files.sort();
}

function measure(root) {
  const entries = filesUnder(root).map((relative) => {
    const bytes = fs.readFileSync(path.join(root, relative));
    return { path: relative, bytes: bytes.length, digest: digest(bytes) };
  });
  return {
    fileCount: entries.length,
    byteSize: entries.reduce((total, entry) => total + entry.bytes, 0),
    productDigest: digest(JSON.stringify(entries)),
  };
}

function equalIdentity(manifest, identity) {
  return manifest.repository === identity.repository
    && manifest.candidateSha === identity.candidateSha
    && manifest.planDigest === identity.planDigest
    && manifest.producerRunId === identity.producerRunId
    && manifest.harnessDigest === identity.harnessDigest;
}

export function validateReadyPublication({ publicationDir, manifest, ...identityInput }) {
  const identity = requireIdentity(identityInput);
  if (!manifest || manifest.schemaVersion !== 1 || manifest.complete !== true || !equalIdentity(manifest, identity)
    || !Number.isSafeInteger(manifest.fileCount) || manifest.fileCount < 1 || !Number.isSafeInteger(manifest.byteSize)
    || manifest.byteSize < 1 || !SHA256.test(manifest.productDigest)) {
    throw new TypeError('publication readiness manifest is invalid or stale for this candidate');
  }
  const root = path.resolve(publicationDir);
  if (!fs.statSync(root).isDirectory()) throw new TypeError('publication root is unavailable');
  const onDisk = JSON.parse(fs.readFileSync(path.join(root, MANIFEST_NAME), 'utf8'));
  if (JSON.stringify(onDisk) !== JSON.stringify(manifest)) throw new TypeError('publication readiness manifest does not match published bytes');
  const observed = measure(root);
  if (observed.fileCount !== manifest.fileCount || observed.byteSize !== manifest.byteSize || observed.productDigest !== manifest.productDigest) {
    throw new TypeError('publication product digest or size does not match its readiness manifest');
  }
  return Object.freeze({ ...manifest });
}

export function publishReadyPublication({ sourceDir, destinationDir, ...identityInput }) {
  const identity = requireIdentity(identityInput);
  const source = path.resolve(sourceDir);
  const destination = path.resolve(destinationDir);
  if (!fs.statSync(source).isDirectory()) throw new TypeError('publication source is unavailable');
  if (fs.existsSync(destination)) throw new TypeError('refusing to overwrite an existing publication destination');
  const temporary = `${destination}.tmp-${process.pid}-${crypto.randomUUID()}`;
  try {
    fs.cpSync(source, temporary, { recursive: true, errorOnExist: true, force: false });
    const measured = measure(temporary);
    if (measured.fileCount === 0 || measured.byteSize === 0) throw new TypeError('publication source is empty');
    const manifest = Object.freeze({ schemaVersion: 1, complete: true, ...identity, ...measured });
    fs.writeFileSync(path.join(temporary, MANIFEST_NAME), `${JSON.stringify(manifest)}\n`, { flag: 'wx' });
    fs.renameSync(temporary, destination);
    return validateReadyPublication({ publicationDir: destination, manifest, ...identity });
  } catch (error) {
    fs.rmSync(temporary, { recursive: true, force: true, maxRetries: 2 });
    throw error;
  }
}

export const publicationReadinessManifestName = MANIFEST_NAME;
