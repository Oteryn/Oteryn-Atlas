import assert from 'node:assert/strict';
import test from 'node:test';

import { bytesDigest } from '../../tools/verification/anti-loop-common.mjs';
import { canonicalJson } from '../../tools/verification/verification-plan-schema.mjs';
import {
  COMPLETE_PRODUCT_AUTHENTICATION_BLOCKERS,
  COMPLETE_PRODUCT_COMMAND_SPECS,
  COMPLETE_PRODUCT_PROOF_KIND,
  COMPLETE_PRODUCT_SOURCE_ASSIGNMENTS,
  buildCompleteProductProofContract,
  validateCompleteProductProof,
} from '../../tools/verification/complete-product-proof.mjs';

const digest = (seed) => `sha256:${seed.repeat(64).slice(0, 64)}`;
const sha = (seed) => seed.repeat(40).slice(0, 40);

function contractInputFixture() {
  const gameRevision = sha('a');
  const legacyRevision = sha('b');
  const sourceFiles = { worldOtbm: { bytes: 10, digest: digest('1') }, assetZip: { bytes: 11, digest: digest('2') }, catalog: { bytes: 12, digest: digest('3') }, appearance: { bytes: 13, digest: digest('4') } };
  const fabricCodeDigest = digest('5');
  const regionSpan = 256;
  const fingerprintCore = { format: 'oteryn-atlas-fullworld-generation-fabric-v0', game_sha: gameRevision, legacy_sha: legacyRevision, world_otbm_sha256: sourceFiles.worldOtbm.digest.slice(7), asset_zip_sha256: sourceFiles.assetZip.digest.slice(7), catalog_sha256: sourceFiles.catalog.digest.slice(7), appearance_sha256: sourceFiles.appearance.digest.slice(7), fabric_code_sha256: fabricCodeDigest.slice(7), region_span: regionSpan };
  const sourceFingerprint = bytesDigest(`OTERYN-ATLAS-FULLWORLD-SOURCE-FINGERPRINT-V0\0${canonicalJson(fingerprintCore)}\n`);
  const candidateCodeFiles = Object.keys(COMPLETE_PRODUCT_SOURCE_ASSIGNMENTS).map((path, index) => ({ path, digest: path === 'tools/fullworld-generation/fabric.py' ? fabricCodeDigest : digest(String((index % 9) + 1)) }));
  return { atlasRevision: sha('c'), candidateCodeFiles, source: { game: { repository: 'Oteryn/Oteryn-Game', revision: gameRevision }, legacyImporter: { repository: 'Oteryn/legacy-importer', revision: legacyRevision }, ...sourceFiles, fabricCodeDigest, regionSpan, sourceFingerprint } };
}

const contractFixture = () => buildCompleteProductProofContract(contractInputFixture());

test('contract binds exact source/code identity and records every unresolved authentication obligation', () => {
  const contract = contractFixture();
  assert.equal(contract.group.id, 'fullworld.complete-integrity');
  assert.equal(contract.group.dataCapability, 'real_fullworld');
  assert.equal(contract.group.resourceClass, 'artifact-build');
  assert.equal(contract.group.hosted, false);
  assert.equal(contract.authentication.status, 'blocked');
  assert.deepEqual(contract.authentication.blockers, COMPLETE_PRODUCT_AUTHENTICATION_BLOCKERS);
  assert.deepEqual(contract.authentication.blockers.map(({ id }) => id), [
    'raw-artifact-byte-closure',
    'candidate-and-source-byte-identity',
    'protected-source-census',
    'two-build-execution-receipts',
    'raw-publication-linkage',
    'independent-derived-verifiers',
    'corruption-execution-receipts',
  ]);
  assert.equal(contract.commands.length, 12);
  for(const id of ['verify-runtime-index','verify-pixel-buckets','verify-minimap']) {
    const command=contract.commands.find(row=>row.id===id);
    assert.equal(command.role,'independent-verifier');
    assert.equal(command.tool,'tools/verification/verify-complete-product-artifacts.mjs');
    assert.equal(command.argvTemplate[0],'node');
  }
  assert.equal(contract.authentication.status,'blocked');
  assert.deepEqual(contract.commands, COMPLETE_PRODUCT_COMMAND_SPECS);
  assert.ok(contract.commands.every((command) => Array.isArray(command.argvTemplate) && !command.argvTemplate.includes('sh')));
  assert.equal(COMPLETE_PRODUCT_SOURCE_ASSIGNMENTS['tools/fullworld-runtime/cdp-session.mjs'], undefined);
  assert.equal(COMPLETE_PRODUCT_SOURCE_ASSIGNMENTS['tools/fullworld-layers/verify_authority_registry.py'], undefined);
});

test('complete-product authentication rejects schema-shaped PASS claims until trusted receipts and verifiers exist', () => {
  const contract = contractFixture();
  const copiedBuild = {
    buildId: 'clean-a',
    cleanBuild: true,
    artifacts: [{ path: 'publication/publication.json', bytes: 100, digest: digest('1') }],
    semanticCounts: { floors: 16, shards: 1197 },
    minimapTiles: Array.from({ length: 1197 }, (_, index) => `minimap/tiles/f0/s${index}.png`),
    verifiers: { publication: { result: 'PASS' }, artifactClosure: { result: 'PASS' } },
  };
  const selfReported = {
    schemaVersion: 1,
    kind: COMPLETE_PRODUCT_PROOF_KIND,
    result: 'PASS',
    contractDigest: contract.contractDigest,
    productRootDigest: digest('2'),
    builds: [copiedBuild, { ...structuredClone(copiedBuild), buildId: 'clean-b' }],
    negativeProbes: [{ id: 'corrupt-minimap-tile', oracle: 'anything', result: 'REJECTED' }],
  };
  for (const candidate of [selfReported, {}, null]) {
    assert.throws(() => validateCompleteProductProof(candidate, { contract }), /missing trusted complete-product execution receipt\/verifier/);
  }
});

test('complete-product validator requires an untampered blocked contract and never accepts candidate-supplied enablement', () => {
  const contract = structuredClone(contractFixture());
  contract.authentication.status = 'available';
  assert.throws(() => validateCompleteProductProof({}, { contract }), /authenticated contract/);
  const forged = structuredClone(contractFixture());
  forged.authentication.status = 'available';
  forged.contractDigest = digest('f');
  assert.throws(() => validateCompleteProductProof({}, { contract: forged }), /authenticated contract/);
  assert.throws(() => validateCompleteProductProof({}, { contract: null }), /authenticated contract/);
});

test('source contract rejects wrong Game identity, stale fingerprints and a fabric digest detached from fabric.py', () => {
  const wrongRepository = contractInputFixture();
  wrongRepository.source.game.repository = 'Other/Some-Game';
  assert.throws(() => buildCompleteProductProofContract(wrongRepository), /canonical/);
  const staleFingerprint = contractInputFixture();
  staleFingerprint.source.game.revision = sha('f');
  assert.throws(() => buildCompleteProductProofContract(staleFingerprint), /fingerprint/);
  const detachedFabric = contractInputFixture();
  detachedFabric.candidateCodeFiles.find(({ path }) => path.endsWith('/fabric.py')).digest = digest('6');
  assert.throws(() => buildCompleteProductProofContract(detachedFabric), /exact candidate fabric.py/);
});

test('complete-product source identity cannot omit the independent verifier implementation',()=>{
 const contract=contractFixture();
 assert(contract.candidateCodeFiles.some(row=>row.path==='tools/verification/verify-complete-product-artifacts.mjs'));
 assert.throws(()=>buildCompleteProductProofContract({atlasRevision:contract.atlasRevision,source:contract.source,candidateCodeFiles:contract.candidateCodeFiles.filter(row=>row.path!=='tools/verification/verify-complete-product-artifacts.mjs')}),/candidate code inventory missing/);
});
