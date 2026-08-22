import assert from 'node:assert/strict';
import test from 'node:test';
import { classicPaletteColor, transformClassicPalette } from '../../src/layers/minimap-palette.mjs';

test('classic palette maps representative visual colors without inventing tile semantics', () => {
  assert.deepEqual(classicPaletteColor(40, 90, 170, 255), [57, 103, 159, 255]);
  assert.deepEqual(classicPaletteColor(55, 125, 45, 255), [0, 200, 0, 255]);
  assert.deepEqual(classicPaletteColor(130, 132, 128, 255), [128, 128, 128, 255]);
  assert.deepEqual(classicPaletteColor(210, 190, 120, 255), [255, 204, 153, 255]);
  assert.deepEqual(classicPaletteColor(145, 90, 50, 255), [255, 80, 0, 255]);
  assert.deepEqual(classicPaletteColor(1, 2, 3, 0), [1, 2, 3, 0]);
});

test('classic palette transform preserves alpha and pixel count', () => {
  const input = new Uint8ClampedArray([40, 90, 170, 255, 55, 125, 45, 180]);
  const output = transformClassicPalette(input);
  assert.deepEqual([...output], [57, 103, 159, 255, 0, 200, 0, 180]);
  assert.equal(output.length, input.length);
});
