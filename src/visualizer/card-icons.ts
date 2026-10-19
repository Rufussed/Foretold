import { cardFile } from "./card-art-files";
import { CARDS } from "./config";

// The element icons printed under each card's number. One small image per
// element, loaded once and shared by every card of that element.

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

export function elementIcon(element: string): Promise<HTMLImageElement | HTMLCanvasElement> {
  const cached = icons.get(element);
  if (cached) return cached;

  const loading = new Promise<HTMLImageElement | HTMLCanvasElement>((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(tinted(image, CARDS.iconTints[element]));
    image.onerror = () => reject(new Error(`Element icon ${element} failed to load`));
    image.src = cardFile(`icons/${element}.webp`);
  });
  // A failed load is forgotten so the next card can try again.
  loading.catch(() => icons.delete(element));
  icons.set(element, loading);
  return loading;
}
