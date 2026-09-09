import { createHash } from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const freeze = (x) => { if (x && typeof x === 'object') { Object.values(x).forEach(freeze); Object.freeze(x); } return x; };
const sha = (bytes) => createHash('sha256').update(bytes).digest('hex');
const fail = (detail) => { throw new TypeError(`selected gameplay source invalid: ${detail}`); };
export const SELECTED_GAMEPLAY_CONTRACT = 'selected-gameplay-v1';
export const SELECTED_GAMEPLAY_INPUTS = freeze([
  { id: 'exporter', role: 'game-producer', repository: 'Oteryn/Oteryn-Game', revision: 'b56ce339281d252a9e01a5a2bed583582bf29e68', path: 'tools/game-atlas-creature-gameplay/export.py', localPath: 'game/tools/game-atlas-creature-gameplay/export.py', blob: '8b8606bb6052dde3ce16ad3cfe0eb88290351b14', sha256: 'e2cbd0c97fcc449c4ec1c2432e96446a0a5a1e57cd9dec7fccc5ed13711ff364', bytes: 49039 },
  { id: 'identity', role: 'game-producer', repository: 'Oteryn/Oteryn-Game', revision: 'b56ce339281d252a9e01a5a2bed583582bf29e68', path: 'tools/game-atlas-creatures/identity.py', localPath: 'game/tools/game-atlas-creatures/identity.py', blob: 'ccebdcd2b88c147e20ed9be9e5dff524276591bd', sha256: '2f9bff2fed95038512a1d676dde274d9a66e9e2f95b9a3db7480c9245b2f75a5', bytes: 592 },
  { id: 'sam', role: 'legacy-evidence', repository: 'blakinio/Otheryn', revision: 'e417c5e7c22986bf4acef0495eb47f7b72c97cce', path: 'vendor/map-analysis/crystalserver/data-global/npc/sam.lua', localPath: 'legacy/npc/sam.lua', blob: '3209c4f87e17cf1c18cb2b317f7e5aa2e126fd4a', sha256: 'ed713aa63d597133355328a16e9c36d1b382c0e1d7e40dc199211f4fc4d14e6b', bytes: 13694 },
  { id: 'rat', role: 'legacy-evidence', repository: 'blakinio/Otheryn', revision: 'e417c5e7c22986bf4acef0495eb47f7b72c97cce', path: 'vendor/map-analysis/crystalserver/data-global/monster/mammals/rat.lua', localPath: 'legacy/monster/rat.lua', blob: '81b9057c51cd36b665b83e644cbd68166ef9961f', sha256: '29b62008555472ee20fc611eb739887cd63bac5be68824c41b3131f82f5e2c1c', bytes: 2369 },
]);
export const SELECTED_GAMEPLAY_OUTPUTS = freeze([
  { path: 'manifest.json', bytes: 1475, sha256: 'df9ea6a1d8cc8876a467031a9d484bb9ff538b417bc12b7d90c071e47b5fabb4' },
  { path: 'shards/monster-80.json', bytes: 909, sha256: '69ac3b88f252080e86305db7cbaeb93907733af702e9e084fddc92a980af2f05' },
  { path: 'shards/npc-f8.json', bytes: 16429, sha256: '26c168b5c38c19ca69f2dc67489f017ae7306c294db08a6a67e86cfcfc0f9abd' },
]);
export const SELECTED_GAMEPLAY_SEMANTIC_DIGEST = 'sha256:be06f49180535bcc764579209370cb5f1edafe2c7882e3380fb9cbdb807c153f';
export const SELECTED_GAMEPLAY_ARGV = freeze(['-I', '-B', 'game/tools/game-atlas-creature-gameplay/export.py', 'legacy/npc', 'legacy/monster', 'derived', '--producer-sha', SELECTED_GAMEPLAY_INPUTS[0].revision]);
function exactMap(input, keys, label) {
  if (!input || typeof input !== 'object' || Array.isArray(input) || ![Object.prototype, null].includes(Object.getPrototypeOf(input)) || Reflect.ownKeys(input).some(k => typeof k !== 'string') || JSON.stringify(Object.keys(input).sort()) !== JSON.stringify([...keys].sort())) fail(`${label} census mismatch`);
}
function raw(value, label) {
  if (!(value instanceof Uint8Array)) fail(`${label} requires raw bytes`);
  return Buffer.from(value);
}
export function verifySelectedGameplayInputs(inputBytes) {
  exactMap(inputBytes, SELECTED_GAMEPLAY_INPUTS.map(x => x.id), 'input');
  const verified = {};
  for (const pin of SELECTED_GAMEPLAY_INPUTS) {
    const bytes = raw(inputBytes[pin.id], pin.id);
    const blob = createHash('sha1').update(`blob ${bytes.length}\0`).update(bytes).digest('hex');
    if (bytes.length !== pin.bytes || sha(bytes) !== pin.sha256 || blob !== pin.blob) fail(`${pin.id} bytes do not match protected repository pin`);
    verified[pin.id] = bytes;
  }
  return verified;
}
export function verifySelectedGameplayProduct(productFiles) {
  exactMap(productFiles, SELECTED_GAMEPLAY_OUTPUTS.map(x => x.path), 'output');
  for (const pin of SELECTED_GAMEPLAY_OUTPUTS) {
    const bytes = raw(productFiles[pin.path], pin.path);
    if (bytes.length !== pin.bytes || sha(bytes) !== pin.sha256) fail(`${pin.path} output digest mismatch`);
  }
  return freeze({ schemaVersion: 1, contract: SELECTED_GAMEPLAY_CONTRACT, mapAuthority: false, completeWorld: false, dataCapability: 'bounded_real_world', scope: 'selected-gameplay-http', producerRepository: 'Oteryn/Oteryn-Game', producerRevision: SELECTED_GAMEPLAY_INPUTS[0].revision, semanticDigest: SELECTED_GAMEPLAY_SEMANTIC_DIGEST, inputs: SELECTED_GAMEPLAY_INPUTS, outputs: SELECTED_GAMEPLAY_OUTPUTS, counts: { npc_profiles: 1, monster_profiles: 1, referenced_items: 0 }, entityIds: ['npc-entity:f8d4f0200616061ffa4ae0b4c38c6d3e', 'monster-entity:80295e51265b3662bfbea2ea01ee3ccb'] });
}
// Caller retrieves inputs separately. No network, credentials, candidate imports,
// caller-selected commands, or caller-selected expected output digests are accepted.
export function buildSelectedGameplaySource(inputBytes) {
  const verified = verifySelectedGameplayInputs(inputBytes);
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'atlas-selected-gameplay-'));
  try {
    for (const pin of SELECTED_GAMEPLAY_INPUTS) {
      const target = path.join(root, pin.localPath);
      fs.mkdirSync(path.dirname(target), { recursive: true });
      fs.writeFileSync(target, verified[pin.id], { flag: 'wx', mode: 0o400 });
    }
    const execution = spawnSync('/usr/bin/python3', SELECTED_GAMEPLAY_ARGV, { cwd: root, env: { LANG: 'C.UTF-8', LC_ALL: 'C.UTF-8' }, timeout: 30000, maxBuffer: 1024 * 1024, encoding: 'utf8', shell: false });
    if (execution.error || execution.status !== 0 || execution.signal) fail('pinned producer execution failed');
    const productFiles = {};
    const walk = (directory, prefix = '') => {
      for (const name of fs.readdirSync(directory)) {
        const target = path.join(directory, name); const relative = prefix + name;
        const stat = fs.lstatSync(target);
        if (stat.isDirectory() && relative === 'shards') walk(target, relative + '/');
        else if (stat.isFile()) productFiles[relative] = fs.readFileSync(target);
        else fail('output contains unexpected directory, symlink or special file');
      }
    };
    walk(path.join(root, 'derived'));
    const proof = verifySelectedGameplayProduct(productFiles);
    return { proof, productFiles };
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
}
