import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { firefox, webkit } from '@playwright/test';

const matrix = JSON.parse(await readFile(new URL('../browser-matrix.json', import.meta.url), 'utf8'));
const artifactsDir = path.resolve(process.env.ATLAS_ARTIFACTS_DIR || '/artifacts');
const atlasRevision = process.env.ATLAS_EXPECTED_REVISION?.trim() || null;
const types = { firefox, webkit };
const observations = [];

for (const browserName of ['firefox', 'webkit']) {
  const type = types[browserName];
  const profile = matrix.profiles.find((candidate) => candidate.browserName === browserName && candidate.surface === 'desktop');
  if (!profile) throw new Error(`missing desktop browser profile for ${browserName}`);
  const browser = await type.launch({ headless: profile.headless });
  try {
    const desktop = await browser.newContext({ viewport: { width: 800, height: 600 } });
    const desktopPage = await desktop.newPage();
    await desktopPage.goto('data:text/html,<title>atlas-browser-probe</title><body>desktop</body>');
    const desktopTitle = await desktopPage.title();
    const userAgent = await desktopPage.evaluate(() => navigator.userAgent);
    const webgl2 = await desktopPage.evaluate(() => Boolean(document.createElement('canvas').getContext('webgl2')));
    if (!webgl2) throw new Error(`${browserName} desktop profile did not expose WebGL2`);
    await desktop.close();

    const touch = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true });
    const touchPage = await touch.newPage();
    await touchPage.setContent('<button id="probe">touch</button>');
    await touchPage.evaluate(() => {
      globalThis.__atlasTouchProbe = [];
      for (const eventName of ['pointerdown', 'touchstart', 'touchend', 'click']) {
        document.querySelector('#probe').addEventListener(eventName, (event) => {
          globalThis.__atlasTouchProbe.push({ eventName, pointerType: event.pointerType ?? null });
        });
      }
    });
    await touchPage.locator('#probe').tap();
    const touchBehavior = await touchPage.evaluate(() => ({ maxTouchPoints: navigator.maxTouchPoints, events: globalThis.__atlasTouchProbe }));
    const eventNames = touchBehavior.events.map(({ eventName }) => eventName);
    const touchPointer = touchBehavior.events.some(({ eventName, pointerType }) => eventName === 'pointerdown' && pointerType === 'touch');
    if (!eventNames.includes('touchstart') || !eventNames.includes('touchend') || !touchPointer) {
      throw new Error(`${browserName} hasTouch context did not dispatch verified touch input`);
    }
    observations.push({ browserName, version: browser.version(), headless: profile.headless, desktopTitle, userAgent, webgl2: 'PASS', touchTap: 'PASS', touchBehavior });
    await touch.close();
  } finally {
    await browser.close();
  }
}

await mkdir(artifactsDir, { recursive: true });
const evidence = {
  version: 1,
  status: 'passed',
  atlasRevision,
  browserContainer: matrix.browserContainer,
  matrixVersion: matrix.version,
  observations,
};
await writeFile(
  path.join(artifactsDir, 'browser-availability.json'),
  `${JSON.stringify(evidence, null, 2)}\n`,
  'utf8',
);
console.log(`BROWSER_AVAILABILITY=PASS ${observations.map(({ browserName, version }) => `${browserName}@${version}`).join(' ')}`);
