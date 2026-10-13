// Sharpens a card's art before it reaches the GPU.
//
// A card is drawn at roughly 200 CSS pixels from a 350x490 face, so the GPU
// shrinks it through mipmaps, which softens the pips and numbers. Lifting the
// edges a little first (an unsharp mask: add back the difference between each
// pixel and a blur of its neighbours) means they survive the shrinking. It is
// done once per card, as it loads, and touches nothing but the cards.

export function sharpenImage(
  image: CanvasImageSource & { width: number; height: number },
  amount: number,
): HTMLCanvasElement | null {
  const { width, height } = image;
  if (!width || !height || amount <= 0) return null;

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (!context) return null;
  context.drawImage(image, 0, 0);

  const source = context.getImageData(0, 0, width, height);
  const input = source.data;
  const output = new Uint8ClampedArray(input);

  // A 3x3 box blur stands in for the neighbours; alpha is left alone so the
  // card's rounded corners keep their edge.
  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      const at = (y * width + x) * 4;
      for (let channel = 0; channel < 3; channel++) {
        let sum = 0;
        for (let dy = -1; dy <= 1; dy++) {
          for (let dx = -1; dx <= 1; dx++) {
            sum += input[at + (dy * width + dx) * 4 + channel];
          }
        }
        const blurred = sum / 9;
        output[at + channel] = input[at + channel] + amount * (input[at + channel] - blurred);
      }
    }
  }

  source.data.set(output);
  context.putImageData(source, 0, 0);
  return canvas;
}
