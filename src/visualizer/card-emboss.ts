import type { PrintPass } from "./card-label";
import { CARDS } from "./config";

// Embosses a card's print as if lit from above: the edges that face up catch a
// light shade, the edges that face down a dark one. The rims go on the coloured
// shapes themselves, and the black outline is drawn first, around them. `draw`
// paints one pass of the print: the outline straight onto the face, the fill
// onto a scratch layer, so the rims can be read off its alpha (hardened, so
// they stay crisp).

function scratch(width: number, height: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  return [canvas, canvas.getContext("2d")!];
}

// The layer with its alpha made all or nothing, so the rims have hard edges
// whatever feathering the print has.
function harden(layer: HTMLCanvasElement): HTMLCanvasElement {
  const [canvas, context] = scratch(layer.width, layer.height);
  context.drawImage(layer, 0, 0);
  const image = context.getImageData(0, 0, canvas.width, canvas.height);
  const cutoff = CARDS.embossThreshold;
  for (let i = 3; i < image.data.length; i += 4) image.data[i] = image.data[i] >= cutoff ? 255 : 0;
  context.putImageData(image, 0, 0);
  return canvas;
}

// The layer's pixels whose neighbour `shift` px away is empty, in one colour.
function rim(layer: HTMLCanvasElement, shift: number, color: string): HTMLCanvasElement {
  const [canvas, context] = scratch(layer.width, layer.height);
  context.drawImage(layer, 0, 0);
  context.globalCompositeOperation = "destination-out";
  context.drawImage(layer, 0, shift);
  context.globalCompositeOperation = "source-in";
  context.fillStyle = color;
  context.fillRect(0, 0, canvas.width, canvas.height);
  return canvas;
}

export function embossPrint(
  context: CanvasRenderingContext2D,
  width: number,
  height: number,
  draw: (context: CanvasRenderingContext2D, pass: PrintPass) => void,
): void {
  const [layer, layerContext] = scratch(width, height);
  draw(context, "outline");
  draw(layerContext, "fill");

  const solid = harden(layer);
  const depth = Math.max(1, Math.round(width * CARDS.embossDepth));
  context.drawImage(layer, 0, 0);
  context.globalAlpha = CARDS.embossLight;
  context.drawImage(rim(solid, depth, "#ffffff"), 0, 0);
  context.globalAlpha = CARDS.embossShade;
  context.drawImage(rim(solid, -depth, CARDS.embossShadeColor), 0, 0);
  context.globalAlpha = 1;
}
