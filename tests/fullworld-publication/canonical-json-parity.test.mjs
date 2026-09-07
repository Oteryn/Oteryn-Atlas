import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

import { canonicalJsonBytes } from '../../src/browser/loader.mjs';
import { PUBLICATION_DOMAIN, rootedContentId } from '../../src/browser/fullworld.mjs';

const PUBLICATION_TOOL = fileURLToPath(new URL('../../tools/fullworld-publication/publication.py', import.meta.url));
const PYTHON_PARITY = String.raw`
import importlib.util
import json
import sys
from pathlib import Path

spec = importlib.util.spec_from_file_location("fullworld_publication", Path(sys.argv[1]))
module = importlib.util.module_from_spec(spec)
assert spec.loader is not None
spec.loader.exec_module(module)
value = json.load(sys.stdin)
print(json.dumps({
    "canonicalHex": module.canonical(value).hex(),
    "rootContentId": module.rooted(module.PUBLICATION_DOMAIN, value),
}, sort_keys=True))
`;

function pythonCanonical(value) {
  const run = spawnSync('python3', ['-c', PYTHON_PARITY, PUBLICATION_TOOL], {
    input: JSON.stringify(value),
    encoding: 'utf8',
  });
  assert.equal(run.status, 0, run.stderr || run.stdout);
  return JSON.parse(run.stdout);
}

const vectors = [
  {
    label: 'integer-like object keys',
    value: { 2: 'two', 10: 'ten', alpha: 1 },
  },
  {
    label: 'nested objects and arrays',
    value: {
      array: [{ 2: 2, 10: 10 }, null, true, -7],
      nested: { 2: { value: 'two' }, 10: { value: 'ten' } },
    },
  },
  {
    label: 'Unicode code-point key ordering',
    value: {
      '💡': 'lamp',
      '𐀀': 'supplementary-plane',
      '\uffff': 'bmp-last',
      'é': 'accent',
    },
  },
  {
    label: 'representative FullWorld pixel manifest core',
    value: {
      profile: 'oteryn-atlas-fullworld-pixel-publication-v0',
      assetZipSha256: 'a'.repeat(64),
      pixelHashDomain: 'OTERYN-DYN-ATLAS-PIXEL-RGBA-V0',
      spriteIndex: {
        2: { bytes: 4096, contentId: `sha256:${'2'.repeat(64)}`, height: 32, width: 32 },
        10: { bytes: 8192, contentId: `sha256:${'1'.repeat(64)}`, height: 64, width: 32 },
      },
      blobs: [],
      packs: [],
      counts: {
        dedupeBytesSaved: 0,
        rawBytesAfterDedupe: 12288,
        rawBytesBeforeDedupe: 12288,
        spriteRefs: 2,
        uniquePixelBlobs: 2,
      },
      runtimePlacement: { identityAuthority: false },
    },
  },
  {
    label: 'representative FullWorld publication core',
    value: {
      profile: 'oteryn-atlas-fullworld-publication-v0',
      source: {
        authority: 'Oteryn/Oteryn-Game',
        canonicalWorldId: null,
        canonicalWorldIdState: 'UNKNOWN',
        fabricRoot: `sha256:${'f'.repeat(64)}`,
        gameSha: '0'.repeat(40),
        handoffSha256: 'a'.repeat(64),
        sourceFingerprint: `sha256:${'b'.repeat(64)}`,
      },
      semantic: { path: 'semantic/world.json', rootContentId: `sha256:${'c'.repeat(64)}` },
      pixels: { path: 'pixels/manifest.json', rootContentId: `sha256:${'d'.repeat(64)}` },
      serializerStatus: 'PROVISIONAL_NOT_FROZEN',
    },
  },
];

test('canonical JSON matches the Python publication serializer byte-for-byte', async (t) => {
  for (const vector of vectors) {
    await t.test(vector.label, async () => {
      const python = pythonCanonical(vector.value);
      const javascript = canonicalJsonBytes(vector.value);
      assert.equal(Buffer.from(javascript).toString('hex'), python.canonicalHex);
      assert.equal(await rootedContentId(PUBLICATION_DOMAIN, vector.value), python.rootContentId);
    });
  }
});

test('integer-like keys stay lexicographic instead of JavaScript index ordered', () => {
  assert.equal(
    new TextDecoder().decode(canonicalJsonBytes({ 2: 'two', 10: 'ten', alpha: 1 })),
    '{"10":"ten","2":"two","alpha":1}\n',
  );
});

test('supplementary-plane keys follow Python Unicode code-point ordering', () => {
  assert.equal(
    new TextDecoder().decode(canonicalJsonBytes({ '💡': 4, '𐀀': 3, '\uffff': 2, 'é': 1 })),
    '{"é":1,"￿":2,"𐀀":3,"💡":4}\n',
  );
});
