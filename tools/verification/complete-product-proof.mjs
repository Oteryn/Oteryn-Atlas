import { bytesDigest, canonicalDigest, deepFreeze, exactDigest, exactSha, isPlainObject, safeRepositoryPath } from './anti-loop-common.mjs';
import { canonicalJson } from './verification-plan-schema.mjs';

export const COMPLETE_PRODUCT_PROOF_KIND = 'oteryn-atlas-complete-product-proof-v1';
export const COMPLETE_PRODUCT_GROUP_ID = 'fullworld.complete-integrity';
export const CANONICAL_GAME_REPOSITORY = 'Oteryn/Oteryn-Game';
export const COMPLETE_PRODUCT_AUTHENTICATION_ERROR = 'missing trusted complete-product execution receipt/verifier';

const SOURCE_DOMAIN = 'OTERYN-ATLAS-FULLWORLD-SOURCE-FINGERPRINT-V0\0';
const REQUIRED_ARTIFACTS = Object.freeze([
  'fabric/handoff.json',
  'publication/publication.json',
  'publication/semantic/world.json',
  'publication/pixels/manifest.json',
  'runtime-index/world.json',
  'pixel-buckets/manifest.json',
  'overview/world.json',
  'minimap/world.json',
]);
const REQUIRED_PROBES = Object.freeze([
  'missing-described-shard',
  'corrupt-semantic-chunk',
  'corrupt-pixel-pack',
  'missing-runtime-chunk',
  'corrupt-pixel-bucket',
  'missing-overview-chunk',
  'corrupt-minimap-tile',
]);

// These obligations explain why a submitted manifest cannot currently prove a
// complete product. They remain protected contract data until trusted executors
// and independent verifiers produce the named evidence.
export const COMPLETE_PRODUCT_AUTHENTICATION_BLOCKERS = deepFreeze([
  { id: 'raw-artifact-byte-closure', requirement: 'protected executor enumerates two isolated artifact trees, rejects unsafe or extra entries, and independently hashes every regular-file byte' },
  { id: 'candidate-and-source-byte-identity', requirement: 'protected executor reads candidate files at the exact Atlas revision and source inputs at exact Game and legacy revisions, independently hashes them, and verifies the source fingerprint' },
  { id: 'protected-source-census', requirement: 'protected source tuple supplies exact logical floor and address sets derived from raw source manifests; product coverage equals those sets' },
  { id: 'two-build-execution-receipts', requirement: 'two distinct protected build-job receipts bind candidate revision, source tuple, code digests, argv, cwd, environment, clean workdir, exit status, attempt, budget, and produced artifact digest' },
  { id: 'raw-publication-linkage', requirement: 'independent parser binds raw publication, semantic, pixel, fabric, source-fingerprint, and derived-product roots' },
  { id: 'independent-derived-verifiers', requirement: 'independent verifier receipts cover runtime index, pixel buckets, overview, minimap, and complete filesystem closure' },
  { id: 'corruption-execution-receipts', requirement: 'each exact mutation binds clean-a pre/post digests, isolated root, verifier command, nonzero rejection status, and log digest' },
]);

// Exact source ownership for the future real-product executor. Individual files
// are listed because directory membership is not a source-code identity.
export const COMPLETE_PRODUCT_SOURCE_ASSIGNMENTS = deepFreeze({
  'tools/verification/verify-complete-product-artifacts.mjs': ['runtime-index-verification', 'pixel-buckets-verification', 'minimap-verification'],
  'tools/fullworld-generation/fabric.py': ['fabric'],
  'tools/fullworld-generation/verify_handoff.py': ['fabric-verification'],
  'tools/fullworld-publication/publication.py': ['publication'],
  'tools/fullworld-publication/verify_publication.py': ['publication-verification'],
  'tools/fullworld-publication/negative_tests.py': ['corruption-rejection'],
  'tools/fullworld-runtime/build_runtime_index.py': ['runtime-index'],
  'tools/fullworld-runtime/build_pixel_buckets.py': ['pixel-buckets'],
  'tools/fullworld-layers/build_overview.py': ['overview'],
  'tools/fullworld-layers/verify_overview.py': ['overview-verification'],
  'tools/fullworld-minimap/build_minimap.py': ['minimap'],
});

// These are planning descriptors, not execution receipts. A future protected
// specialist executor must resolve every token and record the actual invocation.
export const COMPLETE_PRODUCT_COMMAND_SPECS = deepFreeze([
  { id: 'fabric', tool: 'tools/fullworld-generation/fabric.py', role: 'producer', evidence: 'json-stdout', argvTemplate: ['python', 'tools/fullworld-generation/fabric.py', '--game-root', '${GAME_ROOT}', '--game-sha', '${GAME_SHA}', '--legacy-root', '${LEGACY_ROOT}', '--legacy-sha', '${LEGACY_SHA}', '--map', '${MAP}', '--asset-zip', '${ASSET_ZIP}', '--assets', '${ASSETS}', '--workdir', '${WORK}', '--output', '${FABRIC}'] },
  { id: 'verify-handoff', tool: 'tools/fullworld-generation/verify_handoff.py', role: 'independent-verifier', evidence: 'json-stdout', argvTemplate: ['python', 'tools/fullworld-generation/verify_handoff.py', '${HANDOFF}'] },
  { id: 'publication', tool: 'tools/fullworld-publication/publication.py', role: 'producer', evidence: 'json-stdout', argvTemplate: ['python', 'tools/fullworld-publication/publication.py', '--repo-root', '${ATLAS_ROOT}', '--fabric-dir', '${FABRIC}', '--handoff', '${HANDOFF}', '--asset-zip', '${ASSET_ZIP}', '--output', '${PUBLICATION}', '--expected-handoff-sha256', '${HANDOFF_SHA256}'] },
  { id: 'verify-publication', tool: 'tools/fullworld-publication/verify_publication.py', role: 'independent-verifier', evidence: 'json-stdout', argvTemplate: ['python', 'tools/fullworld-publication/verify_publication.py', '--repo-root', '${ATLAS_ROOT}', '--publication', '${PUBLICATION}', '--handoff', '${HANDOFF}', '--asset-zip', '${ASSET_ZIP}', '--expected-handoff-sha256', '${HANDOFF_SHA256}'] },
  { id: 'runtime-index', tool: 'tools/fullworld-runtime/build_runtime_index.py', role: 'producer', evidence: 'json-stdout', argvTemplate: ['python', 'tools/fullworld-runtime/build_runtime_index.py', '--publication', '${PUBLICATION}', '--output', '${RUNTIME_INDEX}', '--expected-publication-root', '${PUBLICATION_ROOT}'] },
  { id: 'pixel-buckets', tool: 'tools/fullworld-runtime/build_pixel_buckets.py', role: 'producer', evidence: 'json-stdout', argvTemplate: ['python', 'tools/fullworld-runtime/build_pixel_buckets.py', '--publication', '${PUBLICATION}', '--output', '${PIXEL_BUCKETS}', '--expected-publication-root', '${PUBLICATION_ROOT}', '--expected-pixel-root', '${PIXEL_ROOT}'] },
  { id: 'overview', tool: 'tools/fullworld-layers/build_overview.py', role: 'producer', evidence: 'text-stdout-plus-manifest', argvTemplate: ['python', 'tools/fullworld-layers/build_overview.py', '${PUBLICATION}', '${OVERVIEW}', '--expected-publication-root', '${PUBLICATION_ROOT}'] },
  { id: 'verify-overview', tool: 'tools/fullworld-layers/verify_overview.py', role: 'independent-verifier', evidence: 'text-stdout-plus-manifest', argvTemplate: ['python', 'tools/fullworld-layers/verify_overview.py', '${OVERVIEW}', '--source-publication', '${PUBLICATION}', '--expected-publication-root', '${PUBLICATION_ROOT}'] },
  { id: 'minimap', tool: 'tools/fullworld-minimap/build_minimap.py', role: 'producer', evidence: 'text-stdout-plus-manifest', argvTemplate: ['python', 'tools/fullworld-minimap/build_minimap.py', '--publication', '${PUBLICATION}', '--output', '${MINIMAP}'] },
  { id: 'verify-runtime-index', tool: 'tools/verification/verify-complete-product-artifacts.mjs', role: 'independent-verifier', evidence: 'json-stdout', argvTemplate: ['node', 'tools/verification/verify-complete-product-artifacts.mjs', '--mode', 'runtime-index', '--publication', '${PUBLICATION}', '--runtime-index', '${RUNTIME_INDEX}', '--expected-publication-root', '${PUBLICATION_ROOT}', '--expected-runtime-index-root', '${RUNTIME_ROOT}'] },
  { id: 'verify-pixel-buckets', tool: 'tools/verification/verify-complete-product-artifacts.mjs', role: 'independent-verifier', evidence: 'json-stdout', argvTemplate: ['node', 'tools/verification/verify-complete-product-artifacts.mjs', '--mode', 'pixel-buckets', '--publication', '${PUBLICATION}', '--pixel-buckets', '${PIXEL_BUCKETS}', '--expected-publication-root', '${PUBLICATION_ROOT}', '--expected-pixel-bucket-root', '${PIXEL_BUCKET_ROOT}'] },
  { id: 'verify-minimap', tool: 'tools/verification/verify-complete-product-artifacts.mjs', role: 'independent-verifier', evidence: 'json-stdout', argvTemplate: ['node', 'tools/verification/verify-complete-product-artifacts.mjs', '--mode', 'minimap', '--publication', '${PUBLICATION}', '--minimap', '${MINIMAP}', '--expected-publication-root', '${PUBLICATION_ROOT}', '--expected-minimap-root', '${MINIMAP_ROOT}'] },
]);

function fail(detail) { throw new TypeError(`complete-product proof invalid: ${detail}`); }
function exactKeys(value, keys, label) {
  if (!isPlainObject(value) || JSON.stringify(Object.keys(value).sort()) !== JSON.stringify([...keys].sort())) fail(`${label} fields mismatch`);
}
function integer(value, label, { positive = false } = {}) {
  if (!Number.isSafeInteger(value) || value < (positive ? 1 : 0)) fail(`${label} must be a ${positive ? 'positive' : 'non-negative'} integer`);
  return value;
}
function digestDescriptor(value, label) {
  exactKeys(value, ['bytes', 'digest'], label);
  return { bytes: integer(value.bytes, `${label} bytes`, { positive: true }), digest: exactDigest(value.digest, `${label} digest`) };
}
function sourceFingerprint(source) {
  const core = {
    format: 'oteryn-atlas-fullworld-generation-fabric-v0',
    game_sha: source.game.revision,
    legacy_sha: source.legacyImporter.revision,
    world_otbm_sha256: source.worldOtbm.digest.slice(7),
    asset_zip_sha256: source.assetZip.digest.slice(7),
    catalog_sha256: source.catalog.digest.slice(7),
    appearance_sha256: source.appearance.digest.slice(7),
    fabric_code_sha256: source.fabricCodeDigest.slice(7),
    region_span: source.regionSpan,
  };
  return bytesDigest(`${SOURCE_DOMAIN}${canonicalJson(core)}\n`);
}
function normalizeSource(value) {
  exactKeys(value, ['appearance', 'assetZip', 'catalog', 'fabricCodeDigest', 'game', 'legacyImporter', 'regionSpan', 'sourceFingerprint', 'worldOtbm'], 'source');
  exactKeys(value.game, ['repository', 'revision'], 'Game source');
  if (value.game.repository !== CANONICAL_GAME_REPOSITORY) fail('Game repository is not canonical');
  exactKeys(value.legacyImporter, ['repository', 'revision'], 'legacy source');
  if (typeof value.legacyImporter.repository !== 'string' || !/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(value.legacyImporter.repository)) fail('legacy repository invalid');
  const source = {
    game: { repository: value.game.repository, revision: exactSha(value.game.revision, 'Game revision') },
    legacyImporter: { repository: value.legacyImporter.repository, revision: exactSha(value.legacyImporter.revision, 'legacy revision') },
    worldOtbm: digestDescriptor(value.worldOtbm, 'world OTBM'),
    assetZip: digestDescriptor(value.assetZip, 'asset ZIP'),
    catalog: digestDescriptor(value.catalog, 'catalog'),
    appearance: digestDescriptor(value.appearance, 'appearance'),
    fabricCodeDigest: exactDigest(value.fabricCodeDigest, 'fabric code digest'),
    regionSpan: integer(value.regionSpan, 'region span', { positive: true }),
    sourceFingerprint: exactDigest(value.sourceFingerprint, 'source fingerprint'),
  };
  if (source.sourceFingerprint !== sourceFingerprint(source)) fail('source fingerprint does not bind exact source identities');
  return source;
}
function normalizeCodeFiles(value) {
  if (!Array.isArray(value) || value.length === 0) fail('candidate code file inventory missing');
  const seen = new Set();
  const files = value.map((item) => {
    exactKeys(item, ['digest', 'path'], 'candidate code file');
    if (!safeRepositoryPath(item.path, { allowDirectory: false }) || seen.has(item.path)) fail('candidate code path unsafe or duplicate');
    seen.add(item.path);
    return { path: item.path, digest: exactDigest(item.digest, `candidate code ${item.path}`) };
  }).sort((a, b) => a.path.localeCompare(b.path));
  for (const path of Object.keys(COMPLETE_PRODUCT_SOURCE_ASSIGNMENTS)) if (!seen.has(path)) fail(`candidate code inventory missing ${path}`);
  return files;
}

export function buildCompleteProductProofContract(input) {
  exactKeys(input, ['atlasRevision', 'candidateCodeFiles', 'source'], 'contract input');
  const candidateCodeFiles = normalizeCodeFiles(input.candidateCodeFiles);
  const source = normalizeSource(input.source);
  const fabric = candidateCodeFiles.find(({ path }) => path === 'tools/fullworld-generation/fabric.py');
  if (fabric.digest !== source.fabricCodeDigest) fail('fabric code digest does not match exact candidate fabric.py descriptor');
  const core = {
    schemaVersion: 1,
    kind: 'oteryn-atlas-complete-product-contract-v1',
    group: { id: COMPLETE_PRODUCT_GROUP_ID, dataCapability: 'real_fullworld', hosted: false, specialistReason: 'real-fullworld-product', resourceClass: 'artifact-build', evidence: 'machine-summary', sequential: true, visualReview: false },
    atlasRevision: exactSha(input.atlasRevision, 'Atlas revision'),
    candidateCodeFiles,
    candidateCodeDigest: canonicalDigest(candidateCodeFiles),
    source,
    commands: structuredClone(COMPLETE_PRODUCT_COMMAND_SPECS),
    requiredArtifacts: [...REQUIRED_ARTIFACTS],
    requiredNegativeProbes: [...REQUIRED_PROBES],
    authentication: { status: 'blocked', blockers: structuredClone(COMPLETE_PRODUCT_AUTHENTICATION_BLOCKERS) },
    buildIds: ['clean-a', 'clean-b'],
  };
  return deepFreeze({ ...core, contractDigest: canonicalDigest(core) });
}

// There is deliberately no schema-only success path. Descriptors, PASS strings,
// duplicated JSON builds and arbitrary rejection labels are claims rather than
// evidence. A future implementation may accept only protected executor receipts
// satisfying every blocker embedded in the authenticated contract.
export function validateCompleteProductProof(_candidate, { contract } = {}) {
  if (!isPlainObject(contract)) fail('authenticated contract required');
  const core = { ...contract }; delete core.contractDigest;
  if (contract.contractDigest !== canonicalDigest(core)) fail('authenticated contract required');
  if (contract.authentication?.status !== 'blocked' || canonicalDigest(contract.authentication.blockers) !== canonicalDigest(COMPLETE_PRODUCT_AUTHENTICATION_BLOCKERS)) fail('authenticated blocked contract required');
  fail(COMPLETE_PRODUCT_AUTHENTICATION_ERROR);
}
