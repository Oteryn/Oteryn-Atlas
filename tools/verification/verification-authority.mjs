import {
  SAFE_IDENTIFIER_PATTERN,
  bytesDigest,
  canonicalDigest,
  deepFreeze,
  exactDigest,
  isPlainObject,
  safeRepositoryPath,
} from './anti-loop-common.mjs';

function normalizeManifest(manifest) {
  if (!isPlainObject(manifest) || manifest.schemaVersion !== 1
    || typeof manifest.authorityId !== 'string' || !SAFE_IDENTIFIER_PATTERN.test(manifest.authorityId)
    || !Array.isArray(manifest.components) || manifest.components.length === 0) {
    throw new TypeError('verification authority manifest is invalid');
  }

  const components = manifest.components.map((component) => {
    if (!isPlainObject(component) || typeof component.id !== 'string'
      || !SAFE_IDENTIFIER_PATTERN.test(component.id)
      || !safeRepositoryPath(component.path, { allowDirectory: false })) {
      throw new TypeError('verification authority component id/path is unsafe');
    }
    return { id: component.id, path: component.path };
  });

  if (new Set(components.map(({ id }) => id)).size !== components.length
    || new Set(components.map(({ path }) => path)).size !== components.length) {
    throw new TypeError('verification authority manifest contains duplicate components');
  }
  const canonical = [...components].sort((left, right) => left.id.localeCompare(right.id) || left.path.localeCompare(right.path));
  if (canonical.some((component, index) => component.id !== components[index].id || component.path !== components[index].path)) {
    throw new TypeError('verification authority components must use canonical sorted order');
  }

  return { schemaVersion: 1, authorityId: manifest.authorityId, components };
}

export async function buildVerificationAuthorityIdentity({ manifest, readFile }) {
  const normalizedManifest = normalizeManifest(manifest);
  if (typeof readFile !== 'function') throw new TypeError('verification authority readFile must be a function');

  const components = [];
  for (const component of normalizedManifest.components) {
    let bytes;
    try {
      bytes = await readFile(component.path);
    } catch (error) {
      throw new TypeError(`verification authority component is unreadable or missing: ${component.path}`, { cause: error });
    }
    if (!(typeof bytes === 'string' || Buffer.isBuffer(bytes) || bytes instanceof Uint8Array)) {
      throw new TypeError(`verification authority component is unreadable: ${component.path}`);
    }
    components.push({ ...component, digest: bytesDigest(bytes) });
  }

  const core = {
    schemaVersion: 1,
    authorityId: normalizedManifest.authorityId,
    manifestDigest: canonicalDigest(normalizedManifest),
    components,
  };
  return deepFreeze({ ...core, authorityDigest: canonicalDigest(core) });
}

export function validateVerificationAuthorityIdentity(identity) {
  if (!isPlainObject(identity) || identity.schemaVersion !== 1
    || typeof identity.authorityId !== 'string' || !SAFE_IDENTIFIER_PATTERN.test(identity.authorityId)
    || !Array.isArray(identity.components) || identity.components.length === 0) {
    throw new TypeError('verification authority identity is invalid');
  }
  const manifest = normalizeManifest({
    schemaVersion: 1,
    authorityId: identity.authorityId,
    components: identity.components.map(({ id, path }) => ({ id, path })),
  });
  const components = identity.components.map((component, index) => {
    if (!isPlainObject(component)
      || component.id !== manifest.components[index].id
      || component.path !== manifest.components[index].path) {
      throw new TypeError('verification authority identity component is invalid');
    }
    return { id: component.id, path: component.path, digest: exactDigest(component.digest, `authority component ${component.id} digest`) };
  });
  const manifestDigest = exactDigest(identity.manifestDigest, 'authority manifest digest');
  if (manifestDigest !== canonicalDigest(manifest)) throw new TypeError('authority manifest digest mismatch');
  const core = { schemaVersion: 1, authorityId: identity.authorityId, manifestDigest, components };
  const authorityDigest = exactDigest(identity.authorityDigest, 'authority digest');
  if (authorityDigest !== canonicalDigest(core)) throw new TypeError('authorityDigest identity mismatch');
  return deepFreeze({ ...core, authorityDigest });
}
