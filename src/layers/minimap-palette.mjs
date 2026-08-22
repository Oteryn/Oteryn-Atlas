// Presentation-only classic minimap palette.
// This transforms verified visual minimap pixels and does not claim terrain semantics.

const CLASSIC = Object.freeze({
  water: Object.freeze([57, 103, 159]),
  vegetation: Object.freeze([0, 200, 0]),
  stone: Object.freeze([128, 128, 128]),
  sand: Object.freeze([255, 204, 153]),
  warm: Object.freeze([255, 80, 0]),
  dark: Object.freeze([32, 96, 32]),
  light: Object.freeze([230, 230, 230]),
});

function rgbToHsv(r, g, b) {
  const rn = r / 255;
  const gn = g / 255;
  const bn = b / 255;
  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  const delta = max - min;
  let h = 0;
  if (delta > 0) {
    if (max === rn) h = 60 * (((gn - bn) / delta) % 6);
    else if (max === gn) h = 60 * (((bn - rn) / delta) + 2);
    else h = 60 * (((rn - gn) / delta) + 4);
  }
  if (h < 0) h += 360;
  return { h, s: max === 0 ? 0 : delta / max, v: max };
}

export function classicPaletteColor(r, g, b, a = 255) {
  if (a === 0) return [r, g, b, a];
  const { h, s, v } = rgbToHsv(r, g, b);
  let rgb;
  if (s < 0.12) rgb = v >= 0.78 ? CLASSIC.light : CLASSIC.stone;
  else if (h >= 190 && h <= 250) rgb = CLASSIC.water;
  else if (h >= 70 && h < 175) rgb = v < 0.34 ? CLASSIC.dark : CLASSIC.vegetation;
  else if (h >= 38 && h < 70 && v >= 0.58) rgb = CLASSIC.sand;
  else if ((h < 38 || h >= 345) && s >= 0.28) rgb = CLASSIC.warm;
  else if (h >= 20 && h < 45 && s >= 0.22) rgb = CLASSIC.warm;
  else rgb = v < 0.34 ? CLASSIC.dark : CLASSIC.stone;
  return [rgb[0], rgb[1], rgb[2], a];
}

export function transformClassicPalette(bytes) {
  if (!(bytes instanceof Uint8ClampedArray)) throw new TypeError('classic minimap transform expects Uint8ClampedArray');
  if (bytes.length % 4 !== 0) throw new RangeError('classic minimap RGBA byte length must be divisible by four');
  const output = new Uint8ClampedArray(bytes.length);
  for (let i = 0; i < bytes.length; i += 4) {
    const mapped = classicPaletteColor(bytes[i], bytes[i + 1], bytes[i + 2], bytes[i + 3]);
    output[i] = mapped[0];
    output[i + 1] = mapped[1];
    output[i + 2] = mapped[2];
    output[i + 3] = mapped[3];
  }
  return output;
}
