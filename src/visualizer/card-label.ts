import type { Card } from "../../backend/src/game/wizard/models/card";
import { CARDS } from "./config";

// The number printed in both top corners of a card face, in its element's
// colour with a black outline, and the element's icon under it. The art itself
// carries neither.

// In the game rules Jesters are value 0 and Wizards 14.
export function cardLabel(card: Card): string {
  if (card.value === 0) return "J";
  if (card.value === 14) return "W";
  return String(card.value);
}

// Jesters and Wizards belong to no suit, so they carry a letter in their own
// colour and no element icon.
export const isSpecialCard = (card: Card): boolean => card.value === 0 || card.value === 14;

// The element a card is drawn as; its art, icon and number colour follow.
export function cardElement(card: Card): string {
  const element = CARDS.suitElements[card.suit];
  if (!element) throw new Error(`No element for suit ${card.suit}`);
  return element;
}

// The face's lettering. The font is only fetched once something on the page
// uses it, and a canvas drawn before then falls back to a system face, so card
// faces wait on this before printing.
export const CARD_FONT = '"Uncial Antiqua"';
export const cardFontReady = (): Promise<unknown> => document.fonts.load(`1em ${CARD_FONT}`);

export interface CardPrint {
  label: string;
  // CSS colour the number is filled with.
  color: string;
  // Drawn centred under the number, when there is one.
  icon?: HTMLImageElement | HTMLCanvasElement;
}

// Draws the print onto a face `width` pixels wide, which is what its size and
// margins are measured against.
export function drawCardPrint(context: CanvasRenderingContext2D, width: number, print: CardPrint): void {
  const { label, color, icon } = print;
  if (!label) return;

  const size = Math.round(width * CARDS.labelSize);
  context.font = `${size}px ${CARD_FONT}, serif`;
  context.textAlign = "left";
  context.textBaseline = "alphabetic";
  context.lineJoin = "round";
  context.lineWidth = size * CARDS.outlineWidth;
  context.strokeStyle = "#000000";
  context.fillStyle = color;

  // Place by the glyphs' measured edges rather than the font's line box, which
  // pads above the digits, so the gap is the same from the top and the sides.
  // The gap runs to the outside of the outline.
  const glyphs = context.measureText(label);
  const inset = size * CARDS.labelMargin + context.lineWidth / 2;
  // Every number is centred on the same point, which is the middle of the
  // widest two-digit one, so "7" and "13" share an origin and the icon below
  // sits under both.
  const wide = context.measureText("00");
  const centerOffset = inset + (wide.actualBoundingBoxLeft + wide.actualBoundingBoxRight) / 2;
  // The ink spans from actualBoundingBoxLeft left of the pen to
  // actualBoundingBoxRight right of it; the pen goes where that centres.
  // The same top for every number, so the icons line up from card to card.
  const top = inset + size * CARDS.labelTopMargin + wide.actualBoundingBoxAscent;
  const penOffset = (glyphs.actualBoundingBoxRight - glyphs.actualBoundingBoxLeft) / 2;

  const feather = size * CARDS.outlineFeather;

  for (const center of [centerOffset, width - centerOffset]) {
    const x = center - penOffset;
    // Outline first, so the fill sits on top of its inner half. Stroked twice
    // because a shadow is faint on its own: the second pass thickens the fade.
    context.shadowColor = "#000000";
    context.shadowBlur = feather;
    context.strokeText(label, x, top);
    context.strokeText(label, x, top);
    context.shadowColor = "transparent";
    context.shadowBlur = 0;
    context.fillText(label, x, top);
    if (icon) {
      drawIcon(context, icon, center, top + context.lineWidth / 2 + size * CARDS.iconGap, {
        box: size * CARDS.iconSize,
        outline: (size * CARDS.outlineWidth * CARDS.iconOutline) / 2,
        feather: size * CARDS.outlineFeather,
      });
    }
  }
}

export interface IconStyle {
  // Side of the square the icon is fitted into, in pixels.
  box: number;
  // How far the black outline stands off the icon, in pixels.
  outline: number;
  // How far the outline fades out past that, in pixels.
  feather: number;
}

// The icon fitted to a square `box` wide and tall, centred on `centerX`, its
// top at `top`, with a black outline. The outline is the icon's own silhouette
// stamped around it in black, then the icon on top.
export function drawIcon(
  context: CanvasRenderingContext2D,
  icon: HTMLImageElement | HTMLCanvasElement,
  centerX: number,
  top: number,
  { box, outline, feather }: IconStyle,
): void {
  const scale = Math.min(box / icon.width, box / icon.height);
  const w = icon.width * scale;
  const h = icon.height * scale;
  const pad = Math.ceil(outline) + 1;

  const stamp = document.createElement("canvas");
  stamp.width = Math.ceil(w) + pad * 2;
  stamp.height = Math.ceil(h) + pad * 2;
  const stampContext = stamp.getContext("2d");
  if (!stampContext) return;
  stampContext.drawImage(icon, pad, pad, w, h);
  stampContext.globalCompositeOperation = "source-in";
  stampContext.fillStyle = "#000000";
  stampContext.fillRect(0, 0, stamp.width, stamp.height);

  const x = centerX - stamp.width / 2;
  const steps = 16;
  // The stamps carry a shadow of their own, which is what feathers the edge.
  context.shadowColor = "#000000";
  context.shadowBlur = feather;
  for (let i = 0; i < steps; i++) {
    const angle = (i / steps) * Math.PI * 2;
    context.drawImage(stamp, x + Math.cos(angle) * outline, top - pad + Math.sin(angle) * outline);
  }
  context.shadowColor = "transparent";
  context.shadowBlur = 0;
  context.drawImage(icon, centerX - w / 2, top, w, h);
}
