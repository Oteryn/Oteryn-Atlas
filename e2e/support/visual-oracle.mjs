import { readFile } from 'node:fs/promises';

export async function canvasAlphaCount(page, selector) {
  return page.locator(selector).evaluate((canvas) => {
    const data = canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height).data;
    let count = 0;
    for (let index = 3; index < data.length; index += 4) if (data[index] !== 0) count += 1;
    return count;
  });
}

export async function canvasPng(page, selector) {
  const base64 = await page.locator(selector).evaluate((canvas) => {
    if (!(canvas instanceof HTMLCanvasElement)) throw new Error(`visual oracle target is not a canvas: ${canvas?.id ?? 'unknown'}`);
    return canvas.toDataURL('image/png').split(',')[1];
  });
  return Buffer.from(base64, 'base64');
}

export async function exactPngPixelsEqual(page, before, after) {
  const comparison = await comparePngOutsideRects(page, before, after, []);
  return comparison.changedOutside === 0;
}

export async function comparePngOutsideRects(page, before, after, rectangles) {
  return page.evaluate(async ({ before64, after64, rectangles: rawRects }) => {
    async function decode(base64) {
      const response = await fetch(`data:image/png;base64,${base64}`);
      const bitmap = await createImageBitmap(await response.blob());
      const canvas = document.createElement('canvas');
      canvas.width = bitmap.width;
      canvas.height = bitmap.height;
      const context = canvas.getContext('2d');
      context.drawImage(bitmap, 0, 0);
      return { width: canvas.width, height: canvas.height, data: context.getImageData(0, 0, canvas.width, canvas.height).data };
    }
    const beforeImage = await decode(before64);
    const afterImage = await decode(after64);
    if (beforeImage.width !== afterImage.width || beforeImage.height !== afterImage.height) {
      throw new Error(`visual oracle dimensions differ: ${beforeImage.width}x${beforeImage.height} vs ${afterImage.width}x${afterImage.height}`);
    }
    const { width, height } = beforeImage;
    const mask = new Uint8Array(width * height);
    for (const rect of rawRects) {
      const x0 = Math.max(0, Math.floor(rect.x));
      const y0 = Math.max(0, Math.floor(rect.y));
      const x1 = Math.min(width, Math.ceil(rect.x + rect.width));
      const y1 = Math.min(height, Math.ceil(rect.y + rect.height));
      for (let y = y0; y < y1; y += 1) for (let x = x0; x < x1; x += 1) mask[y * width + x] = 1;
    }
    const maskCanvas = document.createElement('canvas'); maskCanvas.width = width; maskCanvas.height = height;
    const maskContext = maskCanvas.getContext('2d'); const maskImage = maskContext.createImageData(width, height);
    const diffCanvas = document.createElement('canvas'); diffCanvas.width = width; diffCanvas.height = height;
    const diffContext = diffCanvas.getContext('2d'); const diffImage = diffContext.createImageData(width, height);
    let changedOutside = 0; let changedInside = 0; let allowedPixels = 0;
    for (let pixel = 0; pixel < mask.length; pixel += 1) {
      const index = pixel * 4; const allowed = mask[pixel] === 1;
      if (allowed) {
        allowedPixels += 1;
        maskImage.data[index] = 255; maskImage.data[index + 1] = 255; maskImage.data[index + 2] = 255; maskImage.data[index + 3] = 255;
      } else {
        maskImage.data[index + 3] = 255;
      }
      if (beforeImage.data[index] === afterImage.data[index]
        && beforeImage.data[index + 1] === afterImage.data[index + 1]
        && beforeImage.data[index + 2] === afterImage.data[index + 2]
        && beforeImage.data[index + 3] === afterImage.data[index + 3]) continue;
      if (allowed) { changedInside += 1; diffImage.data[index] = 255; diffImage.data[index + 1] = 255; }
      else { changedOutside += 1; diffImage.data[index] = 255; }
      diffImage.data[index + 3] = 255;
    }
    maskContext.putImageData(maskImage, 0, 0); diffContext.putImageData(diffImage, 0, 0);
    return {
      width, height, changedOutside, changedInside, allowedPixels,
      maskPng: maskCanvas.toDataURL('image/png').split(',')[1],
      diffPng: diffCanvas.toDataURL('image/png').split(',')[1],
    };
  }, { before64: before.toString('base64'), after64: after.toString('base64'), rectangles });
}

export async function compareReviewedSnapshotOutsideLocators(page, testInfo, containerSelector, snapshotName, dynamicSelectors) {
  if (!Array.isArray(dynamicSelectors) || dynamicSelectors.length === 0) throw new TypeError('reviewed snapshot dynamic selectors are required');
  const container = page.locator(containerSelector);
  const normalizationClass = 'atlas-reviewed-snapshot-normalize-scrollbars';
  const normalizationStyle = await page.addStyleTag({ content: `
    .${normalizationClass} { scrollbar-width: none !important; }
    .${normalizationClass}::-webkit-scrollbar { display: none !important; width: 0 !important; height: 0 !important; }
  ` });
  await container.evaluate((node, className) => node.classList.add(className), normalizationClass);
  try {
    const containerBox = await container.boundingBox();
    if (!containerBox) throw new TypeError(`reviewed snapshot container is not visible: ${containerSelector}`);
    const rectangles = [];
    for (const selector of dynamicSelectors) {
      const box = await page.locator(selector).boundingBox();
      if (!box) throw new TypeError(`reviewed snapshot dynamic locator is not visible: ${selector}`);
      rectangles.push({ x: box.x - containerBox.x, y: box.y - containerBox.y, width: box.width, height: box.height });
    }
    const expected = await readFile(testInfo.snapshotPath(snapshotName));
    const actual = await container.screenshot({ animations: 'disabled', caret: 'hide', scale: 'css' });
    return await comparePngOutsideRects(page, expected, actual, rectangles);
  } finally {
    await container.evaluate((node, normalizationClass) => node.classList.remove(normalizationClass), normalizationClass);
    await normalizationStyle.evaluate((node) => node.remove());
  }
}
