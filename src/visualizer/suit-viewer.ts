// Dev-only: Shift+1..4 lays one element's fifteen cards across the whole page,
// to check the art at a size the table never shows it. The same key again, or
// Escape, puts the table back.

import { SUITS, type Card, type Suit } from "../../backend/src/game/wizard/models/card";
import { preloadCardArt } from "./card-texture-loader";

export interface SuitViewer {
  dispose(): void;
}

// Fool, 1 to 13, Wizard.
const VALUES = Array.from({ length: 15 }, (_, value) => value);
const COLUMNS = 5;
// The card mesh's proportions.
const CARD_RATIO = 1.4;

export function createSuitViewer(page: HTMLElement): SuitViewer {
  const overlay = document.createElement("div");
  // Its own display would beat the `hidden` attribute, so open and closed are
  // the display itself.
  overlay.style.cssText =
    "position:absolute;inset:0;z-index:50;background:#000d;display:none;" +
    `grid-template-columns:repeat(${COLUMNS},auto);grid-auto-rows:min-content;` +
    "justify-content:center;align-content:center;gap:0.5vmin;padding:1vmin;";
  page.append(overlay);

  let shown: Suit | null = null;

  const fit = () => {
    const rows = Math.ceil(VALUES.length / COLUMNS);
    const width = Math.min(
      (overlay.clientWidth * 0.97) / COLUMNS,
      (overlay.clientHeight * 0.97) / (rows * CARD_RATIO),
    );
    overlay.style.setProperty("--card-width", `${width}px`);
  };

  const show = (suit: Suit) => {
    shown = suit;
    // The faces as the table draws them, number and icon printed on, copied
    // into canvases as they arrive.
    const slots = VALUES.map((value) => {
      const canvas = document.createElement("canvas");
      canvas.style.cssText = "width:var(--card-width);aspect-ratio:1/1.4;";
      void preloadCardArt({ suit, value } as Card).then((texture) => {
        if (shown !== suit) return;
        const image = texture.image as CanvasImageSource & { width: number; height: number };
        canvas.width = image.width;
        canvas.height = image.height;
        canvas.getContext("2d")?.drawImage(image, 0, 0);
      });
      return canvas;
    });
    overlay.replaceChildren(...slots);
    overlay.style.display = "grid";
    fit();
  };

  const hide = () => {
    overlay.style.display = "none";
    overlay.replaceChildren();
    shown = null;
  };

  const onKey = (event: KeyboardEvent) => {
    if (event.repeat || event.ctrlKey || event.metaKey || event.altKey) return;
    if (event.key === "Escape") return hide();
    const match = /^Digit([1-4])$/.exec(event.code);
    if (!event.shiftKey || !match) return;
    const suit = SUITS[Number(match[1]) - 1];
    if (shown === suit) hide();
    else show(suit);
  };

  window.addEventListener("keydown", onKey);
  window.addEventListener("resize", fit);
  return {
    dispose() {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("resize", fit);
      overlay.remove();
    },
  };
}
