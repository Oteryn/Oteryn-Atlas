import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { firefox, webkit } from '@playwright/test';

const artifactRoot = path.resolve(process.env.ATLAS_ARTIFACTS_DIR || '/artifacts/cross-browser-launch');
const results = [];
for (const [name, engine] of [['firefox', firefox], ['webkit', webkit]]) {
  const browser = await engine.launch({ headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 800, height: 600 } });
    await page.setContent('<title>oteryn-atlas-cross-browser-launch</title>');
    if (await page.title() !== 'oteryn-atlas-cross-browser-launch') throw new Error(`${name} page execution failed`);
    results.push({ engine: name, version: browser.version(), status: 'PASS' });
  } finally {
    await browser.close();
  }
}
await mkdir(artifactRoot, { recursive: true });
await writeFile(path.join(artifactRoot, 'cross-browser-launch-proof.json'), `${JSON.stringify({ version: 1, results }, null, 2)}\n`, 'utf8');
for (const result of results) console.log(`${result.engine}=${result.status} version=${result.version}`);
