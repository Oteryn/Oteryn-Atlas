import { expect, test } from '@playwright/test';
import {
  DESKTOP_ENTRY,
  assertNoRuntimeFailures,
  captureRuntimeFailures,
  gotoAtlas,
  waitForAtlas,
} from './runtime.mjs';

test('desktop core controls expose accessible names and truthful unavailable state', async ({ page }) => {
  const runtime = captureRuntimeFailures(page);
  await gotoAtlas(page, DESKTOP_ENTRY);
  await waitForAtlas(page);

  await expect(page.getByRole('textbox', { name: 'Global semantic Atlas search' }).first()).toBeVisible();
  await expect(page.getByRole('button', { name: 'Zoom in' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Zoom out' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Higher floor' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Lower floor' })).toBeVisible();
  await expect(page.getByRole('combobox', { name: 'Exported floor' })).toBeVisible();
  await expect(page.getByRole('group', { name: 'Atlas view mode' })).toBeVisible();
  await expect(page.getByRole('complementary', { name: 'Inspector and provenance' })).toBeVisible();
  await expect(page.locator('#atlas')).toHaveAttribute('aria-label', 'Full-world WebGL2 Atlas');

  await expect(page.getByRole('searchbox', { name: 'Search Areas and Subareas' })).toBeDisabled();
  await expect(page.getByRole('combobox', { name: 'Region family' })).toBeDisabled();
  await expect(page.getByRole('button', { name: 'Zoom to area' })).toBeDisabled();
  const playback = page.getByRole('checkbox', { name: /Playback/ });
  await expect(playback).toBeEnabled();
  await expect(playback).not.toBeChecked();

  await expect(page.getByRole('button', { name: 'Open Atlas controls' })).toBeHidden();
  await expect(page.getByRole('button', { name: 'Open inspector' })).toBeHidden();
  assertNoRuntimeFailures(runtime);
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