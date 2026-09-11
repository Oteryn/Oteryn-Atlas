import { expect, test } from '@playwright/test';
import { DESKTOP_ENTRY, assertNoRuntimeFailures, captureRuntimeFailures, gotoAtlas, waitForAtlas } from './runtime.mjs';

async function expectInspectorMigrationState(page) {
  const inspectorPanel = page.locator('#mobile-inspector-panel');
  const desktopToggle = page.locator('#desktop-inspector-toggle');
  if (await desktopToggle.count()) {
    await expect(inspectorPanel).toHaveAccessibleName('Inspector and provenance');
    await expect(desktopToggle).toBeVisible();
    await expect(desktopToggle).toHaveAccessibleName('Open inspector');
    await expect(desktopToggle).toHaveAttribute('aria-expanded', 'false');
    await expect(inspectorPanel).toHaveAttribute('aria-hidden', 'true');
    await expect(inspectorPanel).toBeHidden();
    expect(await inspectorPanel.evaluate((element) => element.inert), 'collapsed Inspector must be inert').toBeTruthy();

    await desktopToggle.click();
    await expect(desktopToggle).toHaveAccessibleName('Hide inspector');
    await expect(desktopToggle).toHaveAttribute('aria-expanded', 'true');
    expect(await inspectorPanel.getAttribute('aria-hidden'), 'expanded Inspector must remove aria-hidden').toBeNull();
    await expect(inspectorPanel).toBeVisible();
    expect(await inspectorPanel.evaluate((element) => element.inert), 'expanded Inspector must be interactive').toBeFalsy();

    await desktopToggle.click();
    await expect(desktopToggle).toHaveAccessibleName('Open inspector');
    await expect(desktopToggle).toHaveAttribute('aria-expanded', 'false');
    await expect(inspectorPanel).toHaveAttribute('aria-hidden', 'true');
    await expect(inspectorPanel).toBeHidden();
    expect(await inspectorPanel.evaluate((element) => element.inert), 're-collapsed Inspector must be inert').toBeTruthy();
    return;
  }
  await expect(page.getByRole('complementary', { name: 'Inspector and provenance' })).toBeVisible();
  await expect(inspectorPanel).not.toHaveAttribute('aria-hidden', 'true');
  expect(await inspectorPanel.evaluate((element) => element.inert), 'legacy visible Inspector must stay interactive').toBeFalsy();
}

async function expectAreaToolsMigrationState(page) {
  const disclosure = page.locator('#area-tools-disclosure');
  const search = page.getByRole('searchbox', { name: 'Search Areas and Subareas', includeHidden: true });
  const family = page.getByRole('combobox', { name: 'Region family', includeHidden: true });
  const zoom = page.getByRole('button', { name: 'Zoom to area', includeHidden: true });
  await expect(search).toBeDisabled();
  await expect(family).toBeDisabled();
  await expect(zoom).toBeDisabled();
  if (await disclosure.count()) {
    await expect(disclosure).not.toHaveAttribute('open', '');
    await expect(search).toBeHidden();
    await expect(family).toBeHidden();
    await expect(zoom).toBeHidden();
  } else {
    await expect(search).toBeVisible();
    await expect(family).toBeVisible();
    await expect(zoom).toBeVisible();
  }
}

test('desktop critical controls expose truthful accessible names and disabled states', async ({ page }) => {
  const runtime = captureRuntimeFailures(page);
  await gotoAtlas(page, DESKTOP_ENTRY);
  await waitForAtlas(page);

  await expect(page.getByRole('combobox', { name: 'Global semantic Atlas search' }).first()).toBeVisible();
  await expect(page.getByRole('button', { name: 'Zoom in' })).toBeEnabled();
  await expect(page.getByRole('button', { name: 'Zoom out' })).toBeEnabled();
  await expect(page.getByRole('combobox', { name: 'Exported floor' })).toBeEnabled();
  await expect(page.getByRole('button', { name: 'Higher floor' })).toBeEnabled();
  await expect(page.getByRole('button', { name: 'Lower floor' })).toBeEnabled();
  await expect(page.getByRole('group', { name: 'Atlas view mode' })).toBeVisible();
  await expectInspectorMigrationState(page);
  await expect(page.locator('#atlas')).toHaveAttribute('aria-label', 'Full-world WebGL2 Atlas');
  await expectAreaToolsMigrationState(page);

  for (const label of ['Areas', 'Subareas', 'Towns', 'Temples', 'Teleports / transitions', 'Houses', 'House doors', 'Action IDs', 'Unique IDs', 'Waypoints', 'Mechanics', 'Raids / encounters', 'Quest areas', 'POIs']) {
    const row = page.locator('#semantic-layer-list .layer').filter({ has: page.getByText(label, { exact: true }) });
    await expect(row).toHaveCount(1);
    await expect(row.locator('input')).toBeDisabled();
  }

  const playback = page.getByRole('checkbox', { name: /Playback/ });
  await expect(playback).toBeEnabled();
  await expect(playback).not.toBeChecked();
  const desktopControlsToggle = page.locator('#desktop-controls-toggle');
  if (await desktopControlsToggle.count()) {
    await expect(desktopControlsToggle).toBeVisible();
    await expect(desktopControlsToggle).toHaveAccessibleName('Hide Atlas controls');
    await expect(desktopControlsToggle).toHaveAttribute('aria-expanded', 'true');
  } else {
    await expect(page.getByRole('button', { name: 'Open Atlas controls' })).toBeHidden();
    await expect(page.getByRole('button', { name: 'Open inspector' })).toBeHidden();
  }
  assertNoRuntimeFailures(runtime);
});

test('desktop keyboard navigation reaches search and zoom controls', async ({ page }) => {
  await gotoAtlas(page, DESKTOP_ENTRY);
  await waitForAtlas(page);
  await page.locator('body').focus();
  const reached = new Set();
  for (let step = 0; step < 18; step += 1) {
    await page.keyboard.press('Tab');
    reached.add(await page.evaluate(() => document.activeElement?.id ?? ''));
  }
  expect(reached.has('search-input')).toBe(true);
  expect(reached.has('zoom-out')).toBe(true);
  expect(reached.has('zoom-in')).toBe(true);
});

test('desktop keyboard activates zoom, view mode and playback state', async ({ page }) => {
  const runtime = captureRuntimeFailures(page);
  await gotoAtlas(page, DESKTOP_ENTRY);
  await waitForAtlas(page);

  const zoomIn = page.getByRole('button', { name: 'Zoom in' });
  const initialZoom = Number(new URL(page.url()).searchParams.get('zoom'));
  await zoomIn.focus();
  await expect(zoomIn).toBeFocused();
  await page.keyboard.press('Enter');
  await expect.poll(() => Number(new URL(page.url()).searchParams.get('zoom'))).toBeGreaterThan(initialZoom);

  const minimapMode = page.getByRole('button', { name: 'MINIMAP', exact: true });
  await minimapMode.focus();
  await page.keyboard.press('Space');
  await expect.poll(() => new URL(page.url()).searchParams.get('mode')).toBe('minimap');

  const mapMode = page.getByRole('button', { name: 'MAP', exact: true });
  await mapMode.focus();
  await page.keyboard.press('Enter');
  await expect.poll(() => new URL(page.url()).searchParams.get('mode')).toBe('map');

  const playback = page.getByRole('checkbox', { name: /Playback/ });
  await playback.focus();
  await page.keyboard.press('Space');
  await expect(playback).toBeChecked();
  await expect.poll(() => new URL(page.url()).searchParams.get('animation')).toBe('on');
  await page.keyboard.press('Space');
  await expect(playback).not.toBeChecked();
  await expect.poll(() => new URL(page.url()).searchParams.get('animation')).toBe('off');
  assertNoRuntimeFailures(runtime);
});
