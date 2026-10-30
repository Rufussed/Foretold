import { cardFile } from "./card-art-files";
import { CARDS } from "./config";

// The small images printed on a card's face: the element icon under its number
// and, on the Fool, Seer, Trickster and Wizard, a symbol. Each is loaded once
// and shared by every card that uses it.

const icons = new Map<string, Promise<HTMLImageElement | HTMLCanvasElement>>();

// The icon multiplied by a colour, keeping its shape; untouched without one.
// Source-atop confines the colour to where the icon already has pixels.
function tinted(image: HTMLImageElement, tint?: string): HTMLImageElement | HTMLCanvasElement {
  if (!tint) return image;
  const canvas = document.createElement("canvas");
  canvas.width = image.width;
  canvas.height = image.height;
  const context = canvas.getContext("2d");
  if (!context) return image;
  context.drawImage(image, 0, 0);
  context.globalCompositeOperation = "multiply";
  context.fillStyle = tint;
  context.fillRect(0, 0, canvas.width, canvas.height);
  // Multiply paints the whole rectangle; cut it back to the icon's shape.
  context.globalCompositeOperation = "destination-in";
  context.drawImage(image, 0, 0);
  return canvas;
}

function loadIcon(key: string, path: string, tint?: string): Promise<HTMLImageElement | HTMLCanvasElement> {
  const cached = icons.get(key);
  if (cached) return cached;

  const loading = new Promise<HTMLImageElement | HTMLCanvasElement>((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(tinted(image, tint));
    image.onerror = () => reject(new Error(`Card icon ${path} failed to load`));
    image.src = cardFile(path);
  });
  // A failed load is forgotten so the next card can try again.
  loading.catch(() => icons.delete(key));
  icons.set(key, loading);
  return loading;
}

export function elementIcon(
  element: string,
  // A colour to use instead of the element's usual tint, as on the card back.
  tint: string | undefined = CARDS.iconTints[element],
): Promise<HTMLImageElement | HTMLCanvasElement> {
  return loadIcon(`${element}:${tint ?? ""}`, `icons/${element}.webp`, tint);
}

// The symbols of the five cards outside the plain ranks: the Fool, the Seer,
// the Thief, the Trickster and the Wizard. Drawn white in the art, so they take the
// special colour here, the same yellow as their titles.
export type PowerSymbol = "fool" | "seer" | "thief" | "trickster" | "wizard";

// The fifth element, spirit: a circle with a cross, left white.
export const spiritIcon = (): Promise<HTMLImageElement | HTMLCanvasElement> =>
  loadIcon("symbol:spirit", "symbols/spirit.webp");

export function powerSymbol(symbol: PowerSymbol): Promise<HTMLImageElement | HTMLCanvasElement> {
  return loadIcon(`symbol:${symbol}`, `symbols/${symbol}.webp`, CARDS.specialColor);
}
