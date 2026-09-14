// A render target holds linear light, without the tone mapping and sRGB
// encoding three applies when drawing to the screen. This applies both (ACES
// filmic, matching the table), so headshots look as they would on a canvas.

// three's ACESFilmicToneMapping, row by row.
function acesFilmic(r: number, g: number, b: number): [number, number, number] {
  r /= 0.6;
  g /= 0.6;
  b /= 0.6;
  const fit = (v: number) => (v * (v + 0.0245786) - 0.000090537) / (v * (0.983729 * v + 0.432951) + 0.238081);
  const ir = fit(0.59719 * r + 0.35458 * g + 0.04823 * b);
  const ig = fit(0.076 * r + 0.90834 * g + 0.01566 * b);
  const ib = fit(0.0284 * r + 0.13383 * g + 0.83777 * b);
  const clamp = (v: number) => Math.min(Math.max(v, 0), 1);
  return [
    clamp(1.60475 * ir - 0.53108 * ig - 0.07367 * ib),
    clamp(-0.10208 * ir + 1.10813 * ig - 0.00605 * ib),
    clamp(-0.00327 * ir - 0.07276 * ig + 1.07602 * ib),
  ];
}

const toSrgb = (v: number) => (v <= 0.0031308 ? v * 12.92 : 1.055 * v ** (1 / 2.4) - 0.055);

// pixels: RGBA rows bottom to top, colour premultiplied by alpha, in units of
// `one` (1 for float pixels, 255 for bytes). Returns top-to-bottom image data.
export function toDisplayPixels(pixels: Float32Array | Uint8Array, size: number, one: number): ImageData {
  const image = new ImageData(size, size);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const from = ((size - 1 - y) * size + x) * 4;
      const to = (y * size + x) * 4;
      const alpha = Math.min(pixels[from + 3] / one, 1);
      if (alpha <= 0) continue;
      const [r, g, b] = acesFilmic(pixels[from] / one / alpha, pixels[from + 1] / one / alpha, pixels[from + 2] / one / alpha);
      image.data[to] = Math.round(toSrgb(r) * 255);
      image.data[to + 1] = Math.round(toSrgb(g) * 255);
      image.data[to + 2] = Math.round(toSrgb(b) * 255);
      image.data[to + 3] = Math.round(alpha * 255);
    }
  }
  return image;
}
