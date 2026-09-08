import { bytesDigest, canonicalDigest } from '../../../tools/verification/anti-loop-common.mjs';
import { canonicalJson } from '../../../tools/verification/verification-plan-schema.mjs';
import { PUBLICATION_AUTHORITY_ID, buildProtectedExpectedAuthority } from '../../../tools/verification/proof-provenance.mjs';

const canonicalBytes = (value) => Buffer.from(`${canonicalJson(value)}\n`);
const digest = (seed) => `sha256:${seed.repeat(64).slice(0, 64)}`;
const sha = (seed) => seed.repeat(40).slice(0, 40);

function publication({ gameSha, sourceFingerprint = digest('9') }) {
  const core = { profile: 'oteryn-atlas-fullworld-publication-v0', source: { authority: 'Oteryn/Oteryn-Game', gameSha, sourceFingerprint }, semantic: { path: 'semantic/world.json', rootContentId: digest('1') }, pixels: { path: 'pixels/manifest.json', rootContentId: digest('2') } };
  return { ...core, rootContentId: bytesDigest(Buffer.concat([Buffer.from('OTERYN-ATLAS-FULLWORLD-PUBLICATION-V0\0'), canonicalBytes(core)])) };
}

function pinned(capability) {
  const gameRevision = sha('a');
  const pub = publication({ gameSha: capability === 'qualification_fixture' ? 'fixture' : gameRevision });
  const publicationManifestBytes = canonicalBytes(pub);
  const other = Buffer.from('exact product byte\n');
  const productFiles = [{ path: 'publication/publication.json', bytes: publicationManifestBytes }, { path: 'data/value.bin', bytes: other }];
  const files = productFiles.map((item) => ({ path: item.path, bytes: item.bytes.length, digest: bytesDigest(item.bytes) })).sort((a, b) => a.path.localeCompare(b.path));
  const selectedRaw = Buffer.from('selected canonical Game bytes\n');
  const selectedDigest = bytesDigest(selectedRaw);
  const id = capability === 'qualification_fixture' ? 'atlas-qualification-world-v2' : 'atlas-bounded-real-world-v1';
  const product = { fixtureId: id, dataCapability: capability, publicationRoot: pub.rootContentId, sourceFingerprint: pub.source.sourceFingerprint, files, productDigest: canonicalDigest(files), ...(capability === 'bounded_real_world' ? { sourceDigests: { semanticSearch: selectedDigest } } : {}) };
  const source = capability === 'qualification_fixture'
    ? { kind: 'atlas-owned-fixture', repository: null, revision: null, selectedBytes: [] }
    : { kind: 'selected-game-bytes', repository: 'Oteryn/Oteryn-Game', revision: gameRevision, selectedBytes: [{ id: 'semanticSearch', path: 'tools/game-atlas/semantic.json', digest: selectedDigest }] };
  return {
    protectedExpectedAuthority: buildProtectedExpectedAuthority({ schemaVersion: 1, authorityId: PUBLICATION_AUTHORITY_ID, dataCapability: capability, product: { id, manifestPath: capability === 'qualification_fixture' ? 'fixture-manifest.json' : 'bounded-real-manifest.json', digest: product.productDigest }, publication: { manifestPath: 'publication/publication.json', digest: bytesDigest(publicationManifestBytes) }, source, completeProductContractDigest: null }),
    publicationProof: { dataCapability: capability, productManifestBytes: canonicalBytes(product), publicationManifestBytes, productFiles, source: capability === 'qualification_fixture' ? null : { repository: 'Oteryn/Oteryn-Game', revision: gameRevision, selectedBytes: [{ id: 'semanticSearch', path: 'tools/game-atlas/semantic.json', bytes: selectedRaw }] }, completeProduct: null },
  };
}

export function createPublicationProofFixture(capability) {
  if (capability === 'qualification_fixture' || capability === 'bounded_real_world') return pinned(capability);
  if (capability === 'real_fullworld') throw new TypeError('real_fullworld fixture unavailable: missing trusted complete-product execution receipt/verifier');
  throw new TypeError(`unsupported publication proof fixture: ${capability}`);
}

export function createPublicationProofFixtures(capabilities = ['qualification_fixture', 'bounded_real_world']) {
  const publicationProofs = {}; const protectedExpectedAuthorities = {};
  for (const capability of capabilities) {
    const fixture = createPublicationProofFixture(capability);
    publicationProofs[capability] = fixture.publicationProof;
    protectedExpectedAuthorities[capability] = fixture.protectedExpectedAuthority;
  }
  return { publicationProofs, protectedExpectedAuthorities };
}
