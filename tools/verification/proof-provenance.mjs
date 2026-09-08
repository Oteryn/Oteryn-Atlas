import { bytesDigest, canonicalDigest, deepFreeze, exactDigest, exactSha, isPlainObject, safeRepositoryPath } from './anti-loop-common.mjs';
import { canonicalJson } from './verification-plan-schema.mjs';
import { CANONICAL_GAME_REPOSITORY, COMPLETE_PRODUCT_AUTHENTICATION_ERROR } from './complete-product-proof.mjs';

export { CANONICAL_GAME_REPOSITORY };
export const PUBLICATION_AUTHORITY_ID = 'oteryn-atlas-publication-authority-v1';
export const PUBLICATION_PROFILE = 'oteryn-atlas-fullworld-publication-v0';
const PUBLICATION_DOMAIN = 'OTERYN-ATLAS-FULLWORLD-PUBLICATION-V0\0';
const CAPABILITIES = new Set(['qualification_fixture', 'bounded_real_world', 'real_fullworld']);

function fail(detail) { throw new TypeError(`publication provenance invalid: ${detail}`); }
function exactKeys(value, keys, label) {
  if (!isPlainObject(value) || JSON.stringify(Object.keys(value).sort()) !== JSON.stringify([...keys].sort())) fail(`${label} fields mismatch`);
}
function bytes(value, label) {
  if (!(typeof value === 'string' || Buffer.isBuffer(value) || value instanceof Uint8Array)) fail(`${label} must be raw bytes`);
  return Buffer.from(value);
}
function canonicalBytes(value) { return Buffer.from(`${canonicalJson(value)}\n`); }
function parseCanonicalJson(rawValue, label) {
  const raw = bytes(rawValue, label);
  let value;
  try { value = JSON.parse(raw.toString('utf8')); } catch { fail(`${label} is not JSON`); }
  if (!isPlainObject(value) || !raw.equals(canonicalBytes(value))) fail(`${label} is not canonical JSON`);
  return { raw, value };
}
function publicationRoot(manifest) {
  const core = { ...manifest }; delete core.rootContentId;
  return bytesDigest(Buffer.concat([Buffer.from(PUBLICATION_DOMAIN), canonicalBytes(core)]));
}
function normalizeSelectedExpectations(value, capability) {
  if (!Array.isArray(value)) fail('selected source expectations must be an array');
  if (capability !== 'bounded_real_world' && value.length !== 0) fail(`${capability} must not assume selected Game bytes`);
  if (capability === 'bounded_real_world' && value.length === 0) fail('bounded real authority requires selected Game bytes');
  const ids = new Set(); const paths = new Set();
  return value.map((item) => {
    exactKeys(item, ['digest', 'id', 'path'], 'selected source expectation');
    if (typeof item.id !== 'string' || !/^[A-Za-z][A-Za-z0-9_.-]*$/.test(item.id) || ids.has(item.id)) fail('selected source id invalid or duplicate');
    if (!safeRepositoryPath(item.path, { allowDirectory: false }) || paths.has(item.path)) fail('selected source path unsafe or duplicate');
    ids.add(item.id); paths.add(item.path);
    return { id: item.id, path: item.path, digest: exactDigest(item.digest, `selected source ${item.id} digest`) };
  }).sort((a, b) => a.id.localeCompare(b.id));
}
function normalizeAuthorityCore(value) {
  exactKeys(value, ['authorityId', 'completeProductContractDigest', 'dataCapability', 'product', 'publication', 'schemaVersion', 'source'], 'authority');
  if (value.schemaVersion !== 1 || value.authorityId !== PUBLICATION_AUTHORITY_ID || !CAPABILITIES.has(value.dataCapability)) fail('authority identity/capability invalid');
  const capability = value.dataCapability;
  exactKeys(value.product, ['digest', 'id', 'manifestPath'], 'authority product');
  if (typeof value.product.id !== 'string' || value.product.id.length === 0) fail('authority product id invalid');
  exactKeys(value.publication, ['digest', 'manifestPath'], 'authority publication');
  if (!safeRepositoryPath(value.publication.manifestPath, { allowDirectory: false })) fail('publication manifest path unsafe');
  exactKeys(value.source, ['kind', 'repository', 'revision', 'selectedBytes'], 'authority source');
  const selectedBytes = normalizeSelectedExpectations(value.source.selectedBytes, capability);
  let source;
  if (capability === 'qualification_fixture') {
    if (value.source.kind !== 'atlas-owned-fixture' || value.source.repository !== null || value.source.revision !== null) fail('qualification fixture must not claim Game repository bytes');
    source = { kind: value.source.kind, repository: null, revision: null, selectedBytes };
  } else {
    const expectedKind = capability === 'bounded_real_world' ? 'selected-game-bytes' : 'complete-game-product';
    if (value.source.kind !== expectedKind || value.source.repository !== CANONICAL_GAME_REPOSITORY) fail(`${capability} source authority is not canonical Game`);
    source = { kind: value.source.kind, repository: value.source.repository, revision: exactSha(value.source.revision, `${capability} Game revision`), selectedBytes };
  }
  const pinned = capability !== 'real_fullworld';
  const product = {
    id: value.product.id,
    manifestPath: pinned && safeRepositoryPath(value.product.manifestPath, { allowDirectory: false }) ? value.product.manifestPath : value.product.manifestPath,
    digest: pinned ? exactDigest(value.product.digest, 'expected product digest') : value.product.digest,
  };
  if (pinned && !safeRepositoryPath(product.manifestPath, { allowDirectory: false })) fail('product manifest path unsafe');
  if (!pinned && (product.manifestPath !== null || product.digest !== null)) fail('fullworld product identity comes from complete proof, not a synthetic product manifest');
  const publication = { manifestPath: value.publication.manifestPath, digest: pinned ? exactDigest(value.publication.digest, 'expected publication manifest digest') : value.publication.digest };
  if (!pinned && publication.digest !== null) fail('fullworld publication digest must be derived from the complete build');
  const completeProductContractDigest = capability === 'real_fullworld'
    ? exactDigest(value.completeProductContractDigest, 'complete product contract digest')
    : value.completeProductContractDigest;
  if (!pinned && selectedBytes.length !== 0) fail('fullworld uses the complete source fingerprint, not a selected-byte subset');
  if (pinned && value.completeProductContractDigest !== null) fail(`${capability} must not claim complete-product proof`);
  return { schemaVersion: 1, authorityId: PUBLICATION_AUTHORITY_ID, dataCapability: capability, product, publication, source, completeProductContractDigest };
}

export function buildProtectedExpectedAuthority(input) {
  const core = normalizeAuthorityCore(input);
  return deepFreeze({ ...core, authorityDigest: canonicalDigest(core) });
}
function validateAuthority(candidate) {
  if (!isPlainObject(candidate)) fail('protected expected authority missing');
  const authorityDigest = exactDigest(candidate.authorityDigest, 'protected authority digest');
  const coreInput = { ...candidate }; delete coreInput.authorityDigest;
  const core = normalizeAuthorityCore(coreInput);
  if (canonicalDigest(core) !== authorityDigest) fail('protected expected authority digest mismatch');
  return { ...core, authorityDigest };
}

function normalizeProductFiles(value) {
  if (!Array.isArray(value)) fail('product files must be an array');
  const paths = new Set();
  const files = value.map((item) => {
    exactKeys(item, ['bytes', 'path'], 'product file');
    if (!safeRepositoryPath(item.path, { allowDirectory: false }) || paths.has(item.path)) fail('product file path unsafe or duplicate');
    paths.add(item.path);
    const raw = bytes(item.bytes, `product file ${item.path}`);
    return { path: item.path, raw, descriptor: { path: item.path, bytes: raw.byteLength, digest: bytesDigest(raw) } };
  }).sort((a, b) => a.path.localeCompare(b.path));
  return files;
}
function verifySelectedBytes(expected, actual) {
  if (!Array.isArray(actual) || actual.length !== expected.length) fail('selected source byte census mismatch');
  const byId = new Map();
  for (const item of actual) {
    exactKeys(item, ['bytes', 'id', 'path'], 'selected source bytes');
    if (byId.has(item.id)) fail('selected source bytes duplicate id');
    byId.set(item.id, item);
  }
  return expected.map((entry) => {
    const item = byId.get(entry.id);
    if (!item || item.path !== entry.path) fail(`selected source ${entry.id} path mismatch`);
    const digest = bytesDigest(bytes(item.bytes, `selected source ${entry.id}`));
    if (digest !== entry.digest) fail(`selected source ${entry.id} digest mismatch`);
    return { ...entry };
  });
}
function verifyPublication(rawValue, authority) {
  const { raw, value } = parseCanonicalJson(rawValue, 'publication manifest');
  if (value.profile !== PUBLICATION_PROFILE || value.rootContentId !== publicationRoot(value)) fail('publication manifest root/profile invalid');
  if (value.source?.authority !== CANONICAL_GAME_REPOSITORY) fail('publication source authority invalid');
  const digest = bytesDigest(raw);
  if (authority.publication.digest !== null && digest !== authority.publication.digest) fail('publication manifest digest does not match protected authority');
  return { raw, manifest: value, digest };
}
function authenticatePinnedProduct(proof, authority, publication) {
  const { raw, value: manifest } = parseCanonicalJson(proof.productManifestBytes, 'product manifest');
  if (manifest.fixtureId !== authority.product.id || manifest.dataCapability !== authority.dataCapability) fail('product manifest identity/capability mismatch');
  const files = normalizeProductFiles(proof.productFiles);
  const descriptors = files.map(({ descriptor }) => descriptor);
  // Existing proof fixtures hash canonical JSON without LF; immutable world
  // builders hash the same inventory with LF. Recompute both exact encodings
  // from raw files; the protected authority below still pins one exact digest.
  const inventoryDigest = canonicalDigest(descriptors);
  const worldInventoryDigest = bytesDigest(canonicalBytes(descriptors));
  if (inventoryDigest !== canonicalDigest(manifest.files) || ![inventoryDigest, worldInventoryDigest].includes(manifest.productDigest)) fail('product manifest does not close over exact file bytes');
  if (manifest.productDigest !== authority.product.digest) fail('product digest does not match protected authority');
  const publicationFile = files.find(({ path }) => path === authority.publication.manifestPath);
  if (!publicationFile || !publicationFile.raw.equals(publication.raw)) fail('publication manifest is not the exact product file');
  if (manifest.publicationRoot !== publication.manifest.rootContentId) fail('product/publication root linkage mismatch');
  if (manifest.sourceFingerprint !== publication.manifest.source?.sourceFingerprint) fail('product/publication source fingerprint mismatch');
  if (authority.dataCapability === 'qualification_fixture') {
    if (proof.source !== null || publication.manifest.source?.gameSha !== 'fixture') fail('qualification fixture claimed Game source bytes');
  } else {
    exactKeys(proof.source, ['repository', 'revision', 'selectedBytes'], 'bounded source proof');
    if (proof.source.repository !== authority.source.repository || proof.source.revision !== authority.source.revision) fail('bounded Game repository/revision mismatch');
    if (publication.manifest.source?.gameSha !== authority.source.revision) fail('publication does not bind exact bounded Game revision');
    const selected = verifySelectedBytes(authority.source.selectedBytes, proof.source.selectedBytes);
    if (!isPlainObject(manifest.sourceDigests)) fail('bounded product source digest linkage missing');
    for (const item of selected) if (manifest.sourceDigests[item.id] !== item.digest) fail(`bounded product does not bind selected source ${item.id}`);
  }
  return { productRootDigest: manifest.productDigest, productManifestDigest: bytesDigest(raw), productManifest: manifest, fileInventoryDigest: canonicalDigest(descriptors) };
}
function authenticateFullProduct() {
  // No current raw format proves independent execution, exact filesystem bytes,
  // source-derived coverage, or corruption rejection. Do not turn a submitted
  // schema containing PASS strings into an authenticated publication identity.
  fail(`real_fullworld authentication unavailable: ${COMPLETE_PRODUCT_AUTHENTICATION_ERROR}`);
}

export function authenticatePublicationProof({ publicationProof, protectedExpectedAuthority, protectedBaseSha } = {}) {
  const authority = validateAuthority(protectedExpectedAuthority);
  exactSha(protectedBaseSha, 'protected base SHA');
  exactKeys(publicationProof, ['completeProduct', 'dataCapability', 'productFiles', 'productManifestBytes', 'publicationManifestBytes', 'source'], 'publication proof');
  if (publicationProof.dataCapability !== authority.dataCapability) fail('proof/authority capability mismatch');
  const publication = verifyPublication(publicationProof.publicationManifestBytes, authority);
  const product = authority.dataCapability === 'real_fullworld'
    ? authenticateFullProduct(publicationProof, authority, publication)
    : authenticatePinnedProduct(publicationProof, authority, publication);
  const receiptCore = {
    schemaVersion: 1,
    capability: authority.dataCapability,
    protectedBaseSha,
    authorityDigest: authority.authorityDigest,
    publicationManifestDigest: publication.digest,
    publicationRoot: publication.manifest.rootContentId,
    productRootDigest: product.productRootDigest,
    sourceRepository: authority.source.repository,
    sourceRevision: authority.source.revision,
    productClosureDigest: canonicalDigest(product),
  };
  const trustReceiptDigest = canonicalDigest(receiptCore);
  return deepFreeze({
    publicationManifestDigest: publication.digest,
    productRootDigest: product.productRootDigest,
    sourceRepository: authority.source.repository,
    sourceRevision: authority.source.revision,
    trustReceiptDigest,
  });
}

export function authenticatePublicationProofs({ publicationProofs, protectedExpectedAuthorities, protectedBaseSha } = {}) {
  exactSha(protectedBaseSha, 'protected base SHA');
  if (!isPlainObject(publicationProofs) || Object.keys(publicationProofs).length === 0 || !isPlainObject(protectedExpectedAuthorities)) fail('proof/authority maps required');
  const authenticatedPublicationIdentities = {};
  for (const capability of Object.keys(publicationProofs).sort()) {
    if (!CAPABILITIES.has(capability) || publicationProofs[capability]?.dataCapability !== capability) fail(`publication proof map key invalid: ${capability}`);
    authenticatedPublicationIdentities[capability] = authenticatePublicationProof({ publicationProof: publicationProofs[capability], protectedExpectedAuthority: protectedExpectedAuthorities[capability], protectedBaseSha });
  }
  const trustReceiptDigest = canonicalDigest(Object.entries(authenticatedPublicationIdentities).map(([capability, identity]) => ({ capability, trustReceiptDigest: identity.trustReceiptDigest })));
  return deepFreeze({ authenticatedPublicationIdentities, trustReceiptDigest });
}
