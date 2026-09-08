import assert from 'node:assert/strict';
import test from 'node:test';

import { bytesDigest, canonicalDigest } from '../../tools/verification/anti-loop-common.mjs';
import { canonicalJson } from '../../tools/verification/verification-plan-schema.mjs';
import { COMPLETE_PRODUCT_PROOF_KIND, COMPLETE_PRODUCT_SOURCE_ASSIGNMENTS, buildCompleteProductProofContract } from '../../tools/verification/complete-product-proof.mjs';
import { PUBLICATION_AUTHORITY_ID, authenticatePublicationProof, authenticatePublicationProofs, buildProtectedExpectedAuthority } from '../../tools/verification/proof-provenance.mjs';
import { createPublicationProofFixture } from './helpers/publication-proof-fixture.mjs';

const canonicalBytes = (value) => Buffer.from(`${canonicalJson(value)}\n`);
const digest = (seed) => `sha256:${seed.repeat(64).slice(0, 64)}`;
const sha = (seed) => seed.repeat(40).slice(0, 40);
function publication({ gameSha = 'fixture', sourceFingerprint = digest('9') } = {}) {
  const core = { profile: 'oteryn-atlas-fullworld-publication-v0', source: { authority: 'Oteryn/Oteryn-Game', gameSha, sourceFingerprint }, semantic: { path: 'semantic/world.json', rootContentId: digest('1') }, pixels: { path: 'pixels/manifest.json', rootContentId: digest('2') } };
  return { ...core, rootContentId: bytesDigest(Buffer.concat([Buffer.from('OTERYN-ATLAS-FULLWORLD-PUBLICATION-V0\0'), canonicalBytes(core)])) };
}
function pinnedFixture(capability, { publicationGameSha = capability === 'qualification_fixture' ? 'fixture' : sha('a') } = {}) {
  const pub = publication({ gameSha: publicationGameSha });
  const pubBytes = canonicalBytes(pub);
  const other = Buffer.from('exact product byte\n');
  const productFiles = [{ path: 'publication/publication.json', bytes: pubBytes }, { path: 'data/value.bin', bytes: other }];
  const descriptors = productFiles.map((item) => ({ path: item.path, bytes: item.bytes.length, digest: bytesDigest(item.bytes) })).sort((a, b) => a.path.localeCompare(b.path));
  const sourceRaw = Buffer.from('selected canonical Game bytes\n');
  const sourceDigest = bytesDigest(sourceRaw);
  const id = capability === 'qualification_fixture' ? 'atlas-qualification-world-v2' : 'atlas-bounded-real-world-v1';
  const manifest = { fixtureId: id, dataCapability: capability, publicationRoot: pub.rootContentId, sourceFingerprint: pub.source.sourceFingerprint, files: descriptors, productDigest: canonicalDigest(descriptors), ...(capability === 'bounded_real_world' ? { sourceDigests: { semanticSearch: sourceDigest } } : {}) };
  const source = capability === 'qualification_fixture' ? { kind: 'atlas-owned-fixture', repository: null, revision: null, selectedBytes: [] } : { kind: 'selected-game-bytes', repository: 'Oteryn/Oteryn-Game', revision: sha('a'), selectedBytes: [{ id: 'semanticSearch', path: 'tools/game-atlas/semantic.json', digest: sourceDigest }] };
  const authority = buildProtectedExpectedAuthority({ schemaVersion: 1, authorityId: PUBLICATION_AUTHORITY_ID, dataCapability: capability, product: { id, manifestPath: capability === 'qualification_fixture' ? 'fixture-manifest.json' : 'bounded-real-manifest.json', digest: manifest.productDigest }, publication: { manifestPath: 'publication/publication.json', digest: bytesDigest(pubBytes) }, source, completeProductContractDigest: null });
  const proof = { dataCapability: capability, productManifestBytes: canonicalBytes(manifest), publicationManifestBytes: pubBytes, productFiles, source: capability === 'qualification_fixture' ? null : { repository: 'Oteryn/Oteryn-Game', revision: sha('a'), selectedBytes: [{ id: 'semanticSearch', path: 'tools/game-atlas/semantic.json', bytes: sourceRaw }] }, completeProduct: null };
  return { authority, proof, manifest, pub };
}

function fullFixture() {
  const gameRevision = sha('a'); const legacyRevision = sha('b'); const fabricCodeDigest = digest('5'); const regionSpan = 256;
  const sourceFiles = { worldOtbm: { bytes: 10, digest: digest('1') }, assetZip: { bytes: 11, digest: digest('2') }, catalog: { bytes: 12, digest: digest('3') }, appearance: { bytes: 13, digest: digest('4') } };
  const fingerprintCore = { format: 'oteryn-atlas-fullworld-generation-fabric-v0', game_sha: gameRevision, legacy_sha: legacyRevision, world_otbm_sha256: sourceFiles.worldOtbm.digest.slice(7), asset_zip_sha256: sourceFiles.assetZip.digest.slice(7), catalog_sha256: sourceFiles.catalog.digest.slice(7), appearance_sha256: sourceFiles.appearance.digest.slice(7), fabric_code_sha256: fabricCodeDigest.slice(7), region_span: regionSpan };
  const sourceFingerprint = bytesDigest(`OTERYN-ATLAS-FULLWORLD-SOURCE-FINGERPRINT-V0\0${canonicalJson(fingerprintCore)}\n`);
  const candidateCodeFiles = Object.keys(COMPLETE_PRODUCT_SOURCE_ASSIGNMENTS).map((path, index) => ({ path, digest: path === 'tools/fullworld-generation/fabric.py' ? fabricCodeDigest : digest(String((index % 9) + 1)) }));
  const contract = buildCompleteProductProofContract({ atlasRevision: sha('c'), candidateCodeFiles, source: { game: { repository: 'Oteryn/Oteryn-Game', revision: gameRevision }, legacyImporter: { repository: 'Oteryn/legacy-importer', revision: legacyRevision }, ...sourceFiles, fabricCodeDigest, regionSpan, sourceFingerprint } });
  const pub = publication({ gameSha: gameRevision, sourceFingerprint }); const pubBytes = canonicalBytes(pub);
  const roots = { fabric: digest('1'), publication: pub.rootContentId, semantic: digest('3'), pixel: digest('4'), runtimeIndex: digest('5'), pixelBuckets: digest('6'), overview: digest('7'), minimap: digest('8') };
  const semanticCounts = { bytes: 5000, floors: 16, resolvedPrimitives: 3000, shards: 1197, tiles: 2000, uniqueSpriteRefs: 150 };
  const fabricCounts = { bytes: 5000, floors: 16, presentationRecords: 2500, resolvedPrimitives: 3000, shards: 1197, tiles: 2000, unresolvedPresentations: 0 };
  const pixelCounts = { dedupeBytesSaved: 1000, rawBytesAfterDedupe: 9000, rawBytesBeforeDedupe: 10000, spriteRefs: 150, uniquePixelBlobs: 120 };
  const derivedCounts = { runtimeIndex: { floors: 16, groups: 2200, resolvedPrimitives: 3000, shards: 1197, sourceBytes: 5000, tiles: 2000 }, pixelBuckets: { blobs: 120, buckets: 80, bytes: 9000 }, pixelPublication: { packs: 3 }, overview: { cells: 1800, chunks: 1197, floors: 16, resolvedPrimitives: 3000, tiles: 2000 }, minimap: { bytes: 7000, chunks: 1197, floors: 16, tiles: 2000 } };
  const paths = ['fabric/handoff.json', 'publication/publication.json', 'publication/build-evidence.json', 'publication/semantic/world.json', 'publication/pixels/manifest.json', 'runtime-index/world.json', 'pixel-buckets/manifest.json', 'pixel-buckets/local-max/all-pixels.rgba', 'overview/world.json', 'minimap/world.json'];
  for (let index = 0; index < 1197; index += 1) paths.push(`fabric/shards/s${index}/manifest.json`, `fabric/shards/s${index}/tiles.jsonl`, `publication/semantic/chunks/s${index}.jsonl`, `overview/chunks/s${index}.json`, `minimap/tiles/f0/s${index}.png`);
  for (let floor = 0; floor < 16; floor += 1) paths.push(`publication/semantic/floors/f${floor}.json`, `runtime-index/floors/f${floor}.json`, `overview/floors/f${floor}.json`, `minimap/floors/f${floor}.json`);
  for (let index = 0; index < 3; index += 1) paths.push(`publication/pixels/packs/p${index}.rgba`);
  for (let index = 0; index < 80; index += 1) paths.push(`pixel-buckets/buckets/b${index}.rgba`);
  const artifacts = paths.map((path, index) => ({ path, bytes: path === 'publication/publication.json' ? pubBytes.length : index + 10, digest: path === 'publication/publication.json' ? bytesDigest(pubBytes) : digest(String((index % 9) + 1)) }));
  const artifactInventoryDigest = canonicalDigest(artifacts.slice().sort((a, b) => a.path.localeCompare(b.path)));
  const linkage = { gameRevision, sourceFingerprint, publication: { fabricRoot: roots.fabric, semanticRoot: roots.semantic, pixelRoot: roots.pixel, sourceFingerprint, gameRevision }, runtimeIndex: { publicationRoot: roots.publication, semanticRoot: roots.semantic, pixelRoot: roots.pixel, sourceFingerprint }, pixelBuckets: { publicationRoot: roots.publication, pixelRoot: roots.pixel }, overview: { publicationRoot: roots.publication, semanticRoot: roots.semantic, sourceFingerprint }, minimap: { publicationRoot: roots.publication, semanticRoot: roots.semantic, pixelRoot: roots.pixel } };
  const verifiers = { handoff: { result: 'PASS', fabricRoot: roots.fabric, shards: 1197, tiles: 2000, finalJsonlBytes: 5000 }, publication: { result: 'PASS', publicationRoot: roots.publication, semanticRoot: roots.semantic, pixelRoot: roots.pixel, counts: semanticCounts, pixelCounts, authorizedSpriteMappings: 150 }, overview: { result: 'PASS', root: roots.overview, floors: 16, chunks: 1197, cells: 1800, tiles: 2000, resolvedPrimitives: 3000 }, artifactClosure: { result: 'PASS', artifacts: artifacts.length, inventoryDigest: artifactInventoryDigest } };
  const build = (buildId) => ({ buildId, cleanBuild: true, roots, fabricCounts, semanticCounts, pixelCounts, derivedCounts, artifacts, artifactInventoryDigest, linkage, verifiers });
  const productRootDigest = canonicalDigest({ roots, fabricCounts, semanticCounts, pixelCounts, derivedCounts, artifactInventoryDigest });
  const negativeProbes = ['missing-described-shard', 'corrupt-semantic-chunk', 'corrupt-pixel-pack', 'missing-runtime-chunk', 'corrupt-pixel-bucket', 'missing-overview-chunk', 'corrupt-minimap-tile'].map((id) => ({ id, buildId: 'clean-a', oracle: `complete-product:${id}`, result: 'REJECTED' }));
  const completeProof = { schemaVersion: 1, kind: COMPLETE_PRODUCT_PROOF_KIND, result: 'PASS', contractDigest: contract.contractDigest, productRootDigest, builds: [build('clean-a'), structuredClone(build('clean-b'))], negativeProbes };
  const authority = buildProtectedExpectedAuthority({ schemaVersion: 1, authorityId: PUBLICATION_AUTHORITY_ID, dataCapability: 'real_fullworld', product: { id: 'atlas-fullworld', manifestPath: null, digest: null }, publication: { manifestPath: 'publication/publication.json', digest: null }, source: { kind: 'complete-game-product', repository: 'Oteryn/Oteryn-Game', revision: gameRevision, selectedBytes: [] }, completeProductContractDigest: contract.contractDigest });
  const proof = { dataCapability: 'real_fullworld', productManifestBytes: null, publicationManifestBytes: pubBytes, productFiles: [], source: { repository: 'Oteryn/Oteryn-Game', revision: gameRevision, selectedBytes: [] }, completeProduct: { contract, proof: completeProof } };
  return { authority, proof };
}

test('qualification fixture authenticates exact product/publication bytes without claiming Game source bytes', () => {
  const { authority, proof } = pinnedFixture('qualification_fixture');
  const identity = authenticatePublicationProof({ publicationProof: proof, protectedExpectedAuthority: authority, protectedBaseSha: sha('f') });
  assert.equal(identity.sourceRepository, null); assert.equal(identity.sourceRevision, null);
  assert.match(identity.trustReceiptDigest, /^sha256:[a-f0-9]{64}$/);
});

test('bounded real authenticates canonical Game commit and exact selected bytes linked by the product manifest', () => {
  const { authority, proof, manifest } = pinnedFixture('bounded_real_world');
  const identity = authenticatePublicationProof({ publicationProof: proof, protectedExpectedAuthority: authority, protectedBaseSha: sha('f') });
  assert.equal(identity.sourceRepository, 'Oteryn/Oteryn-Game'); assert.equal(identity.sourceRevision, sha('a'));
  assert.equal(identity.productRootDigest, manifest.productDigest);
  for (const mutate of [
    (p) => { p.source.repository = 'Oteryn/Another-Game'; },
    (p) => { p.source.revision = sha('b'); },
    (p) => { p.source.selectedBytes[0].bytes = Buffer.from('different'); },
  ]) { const bad = structuredClone(proof); mutate(bad); assert.throws(() => authenticatePublicationProof({ publicationProof: bad, protectedExpectedAuthority: authority, protectedBaseSha: sha('f') })); }
  const mismatchedPublication = pinnedFixture('bounded_real_world', { publicationGameSha: sha('b') });
  assert.throws(() => authenticatePublicationProof({ publicationProof: mismatchedPublication.proof, protectedExpectedAuthority: mismatchedPublication.authority, protectedBaseSha: sha('f') }), /exact bounded Game revision/);
});

test('fullworld identity remains unavailable for schema-shaped inventories and duplicated build claims', () => {
  const { authority, proof } = fullFixture();
  assert.throws(
    () => authenticatePublicationProof({ publicationProof: proof, protectedExpectedAuthority: authority, protectedBaseSha: sha('f') }),
    /real_fullworld authentication unavailable: missing trusted complete-product execution receipt\/verifier/,
  );
  assert.throws(() => createPublicationProofFixture('real_fullworld'), /missing trusted complete-product execution receipt\/verifier/);
});

test('publication digest/root/product closure and protected authority mutations fail closed', () => {
  const { authority, proof } = pinnedFixture('qualification_fixture');
  const mutations = [
    (p) => { p.publicationManifestBytes = Buffer.from(p.publicationManifestBytes); p.publicationManifestBytes[p.publicationManifestBytes.length - 2] ^= 1; },
    (p) => { p.productFiles[1].bytes = Buffer.from('substitution'); },
    (p) => { p.productManifestBytes = Buffer.from(`${p.productManifestBytes.toString().trim()} `); },
  ];
  for (const mutate of mutations) { const bad = structuredClone(proof); mutate(bad); assert.throws(() => authenticatePublicationProof({ publicationProof: bad, protectedExpectedAuthority: authority, protectedBaseSha: sha('f') })); }
  const badAuthority = structuredClone(authority); badAuthority.source.repository = 'Oteryn/Oteryn-Game';
  assert.throws(() => authenticatePublicationProof({ publicationProof: proof, protectedExpectedAuthority: badAuthority, protectedBaseSha: sha('f') }), /digest|fixture/);
});

test('multi-capability authentication returns only recomputed identities and receipt binds every capability', () => {
  const fixture = pinnedFixture('qualification_fixture'); const bounded = pinnedFixture('bounded_real_world');
  const result = authenticatePublicationProofs({ publicationProofs: { bounded_real_world: bounded.proof, qualification_fixture: fixture.proof }, protectedExpectedAuthorities: { bounded_real_world: bounded.authority, qualification_fixture: fixture.authority }, protectedBaseSha: sha('f') });
  assert.deepEqual(Object.keys(result.authenticatedPublicationIdentities), ['bounded_real_world', 'qualification_fixture']);
  assert.notEqual(result.trustReceiptDigest, result.authenticatedPublicationIdentities.bounded_real_world.trustReceiptDigest);
});
