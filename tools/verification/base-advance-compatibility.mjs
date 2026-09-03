import {
  canonicalDigest,
  deepFreeze,
  exactDigest,
  exactSha,
  isPlainObject,
  safeRepositoryPath,
  sortedUniqueStrings,
} from './anti-loop-common.mjs';

const DISPOSITIONS = new Set(['REUSE', 'PARTIAL_RERUN', 'FULL_RERUN', 'REINTEGRATE']);

function pathMatches(dependency, changed) {
  if (dependency.endsWith('/')) return changed.startsWith(dependency);
  return changed === dependency || changed.startsWith(`${dependency}/`);
}

function normalizeProducts(products, label) {
  if (!isPlainObject(products)) throw new TypeError(`${label} products must be an object`);
  return Object.fromEntries(Object.entries(products).sort(([left], [right]) => left.localeCompare(right)).map(([capability, value]) => {
    if (typeof capability !== 'string' || capability.length === 0) throw new TypeError(`${label} product capability is invalid`);
    if (typeof value === 'string') return [capability, exactDigest(value, `${label} ${capability} product digest`)];
    if (!isPlainObject(value) || typeof value.id !== 'string') throw new TypeError(`${label} ${capability} product identity is invalid`);
    return [capability, { id: value.id, digest: exactDigest(value.digest, `${label} ${capability} product digest`) }];
  }));
}

function normalizeIdentities(value, label) {
  if (!isPlainObject(value)) throw new TypeError(`${label} identities are invalid`);
  return {
    authorityDigest: exactDigest(value.authorityDigest, `${label} authority digest`),
    environmentDigest: exactDigest(value.environmentDigest, `${label} environment digest`),
    products: normalizeProducts(value.products ?? {}, label),
  };
}

function normalizeEvidence(evidence) {
  if (!Array.isArray(evidence) || evidence.length === 0) throw new TypeError('base compatibility evidence must be non-empty');
  const normalized = evidence.map((entry) => {
    if (!isPlainObject(entry) || typeof entry.id !== 'string' || entry.id.length === 0
      || typeof entry.dependsOnAuthority !== 'boolean' || typeof entry.dependsOnEnvironment !== 'boolean') {
      throw new TypeError('base compatibility evidence declaration is invalid');
    }
    return {
      id: entry.id,
      dependencyPaths: sortedUniqueStrings(entry.dependencyPaths ?? [], `${entry.id} dependency paths`, {
        validate: (value) => safeRepositoryPath(value),
      }),
      dependsOnAuthority: entry.dependsOnAuthority,
      dependsOnEnvironment: entry.dependsOnEnvironment,
      productCapabilities: sortedUniqueStrings(entry.productCapabilities ?? [], `${entry.id} product capabilities`),
    };
  }).sort((left, right) => left.id.localeCompare(right.id));
  if (new Set(normalized.map(({ id }) => id)).size !== normalized.length) {
    throw new TypeError('base compatibility evidence declarations contain duplicate IDs');
  }
  return normalized;
}

function productChanged(previous, current, capability) {
  return JSON.stringify(previous[capability]) !== JSON.stringify(current[capability]);
}

export function classifyBaseAdvance(input) {
  if (!isPlainObject(input)) throw new TypeError('base advance compatibility input is invalid');
  const oldBaseSha = exactSha(input.oldBaseSha, 'old base SHA');
  const newBaseSha = exactSha(input.newBaseSha, 'new base SHA');
  const changedPaths = sortedUniqueStrings(input.changedPaths ?? [], 'base advance changed paths', {
    validate: (value) => safeRepositoryPath(value),
  });
  if (!['clean', 'conflict'].includes(input.mergeStatus)) throw new TypeError('base advance merge status is invalid');
  const previousIdentities = normalizeIdentities(input.previousIdentities, 'previous');
  const currentIdentities = normalizeIdentities(input.currentIdentities, 'current');
  const authorityPaths = sortedUniqueStrings(input.authorityPaths ?? [], 'authority paths', {
    validate: (value) => safeRepositoryPath(value),
  });
  const candidateRequiredPaths = sortedUniqueStrings(input.candidateRequiredPaths ?? [], 'candidate-required paths', {
    validate: (value) => safeRepositoryPath(value),
  });
  const evidence = normalizeEvidence(input.evidence);

  let disposition = 'REUSE';
  const affected = new Set();
  const reasons = [];

  if (input.mergeStatus === 'conflict') {
    disposition = 'REINTEGRATE';
    evidence.forEach(({ id }) => affected.add(id));
    reasons.push('protected base has a merge conflict with the candidate');
  }

  const requiredChanges = changedPaths.filter((path) => candidateRequiredPaths.some((required) => pathMatches(required, path)));
  if (requiredChanges.length > 0) {
    disposition = 'REINTEGRATE';
    evidence.forEach(({ id }) => affected.add(id));
    reasons.push(`candidate-required protected source changed: ${requiredChanges.join(', ')}`);
  }

  const authorityChanged = previousIdentities.authorityDigest !== currentIdentities.authorityDigest;
  const environmentChanged = previousIdentities.environmentDigest !== currentIdentities.environmentDigest;
  const productCapabilities = [...new Set([
    ...Object.keys(previousIdentities.products),
    ...Object.keys(currentIdentities.products),
  ])].sort();
  const changedProducts = productCapabilities.filter((capability) => (
    productChanged(previousIdentities.products, currentIdentities.products, capability)
  ));

  if (disposition !== 'REINTEGRATE') {
    for (const node of evidence) {
      const pathDependencyChanged = changedPaths.some((path) => node.dependencyPaths.some((dependency) => pathMatches(dependency, path)));
      const nodeProductChanged = node.productCapabilities.some((capability) => changedProducts.includes(capability));
      if ((authorityChanged && node.dependsOnAuthority)
        || (environmentChanged && node.dependsOnEnvironment)
        || nodeProductChanged
        || pathDependencyChanged) {
        affected.add(node.id);
      }
    }

    if (authorityChanged) reasons.push('protected verification authority identity changed');
    if (environmentChanged) reasons.push('protected execution environment identity changed');
    if (changedProducts.length > 0) reasons.push(`protected product identities changed: ${changedProducts.join(', ')}`);
    const dependencyChanges = changedPaths.filter((path) => evidence.some((node) => node.dependencyPaths.some((dependency) => pathMatches(dependency, path))));
    if (dependencyChanges.length > 0) reasons.push(`evidence dependency paths changed: ${dependencyChanges.join(', ')}`);
    const changedAuthorityPaths = changedPaths.filter((path) => authorityPaths.some((prefix) => pathMatches(prefix, path)));
    if (changedAuthorityPaths.length > 0 && !authorityChanged && !environmentChanged && changedProducts.length === 0) {
      throw new TypeError(`authority closure escaped canonical identity: ${changedAuthorityPaths.join(', ')}`);
    }

    if (affected.size === evidence.length && affected.size > 0) disposition = 'FULL_RERUN';
    else if (affected.size > 0) disposition = 'PARTIAL_RERUN';
  }

  if (!DISPOSITIONS.has(disposition)) throw new TypeError('base advance compatibility disposition is invalid');
  if (reasons.length === 0) reasons.push('protected base movement is outside candidate, authority and evidence dependency closure');

  const core = {
    schemaVersion: 1,
    disposition,
    affectedEvidenceIds: [...affected].sort(),
    reasons,
    oldBaseSha,
    newBaseSha,
    changedPaths,
    previousIdentities,
    currentIdentities,
  };
  return deepFreeze({ ...core, compatibilityDigest: canonicalDigest(core) });
}
