import type { Card } from "../../backend/src/game/wizard/models/card";
import { CARDS } from "./config";

// The number printed in both top corners of a card face, in its element's
// colour with a black outline, and the element's icon under it. The art itself
// carries neither.

// In the game rules the Fool (the Jester) is value 0 and the Wizard 14.
export function cardLabel(card: Card): string {
  if (card.value === 0) return "F";
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
// The card's title across the middle is set in its own face.
export const NAME_FONT = '"Merienda"';
const NAME_WEIGHT = 700;
export const cardFontReady = (): Promise<unknown> =>
  Promise.all([
    document.fonts.load(`1em ${CARD_FONT}`),
    document.fonts.load(`${NAME_WEIGHT} 1em ${NAME_FONT}`),
  ]);

// Which part of the print to draw: just the black outline with its feathered
// shadow, just the coloured fill, or both (the outline first, so the fill
// sits on top of its inner half).
export type PrintPass = "outline" | "fill" | "both";

export interface CardPrint {
  label: string;
  // CSS colour the number is filled with.
  color: string;
  // Drawn centred under the number, when there is one.
  icon?: HTMLImageElement | HTMLCanvasElement;
  // A symbol in the special colour, in the top corner: under the number and the
  // element icon on a Seer or Trickster, and on its own (no number) on a Fool
  // or Wizard.
  badge?: HTMLImageElement | HTMLCanvasElement;
  // Scales the symbol, on top of CARDS.symbolSize; 1 if left out.
  badgeScale?: number;
  // The gap above the symbol, under the element icon, as a fraction of the
  // label height; the default is CARDS.badgeGap.
  badgeGap?: number;
  // The card's title in the hierarchy, printed across the middle of the card.
  name?: string;
}

// An outlined, feathered line of text: the black outline first, so the fill
// sits on top of its inner half. Stroked twice because a shadow is faint on
// its own: the second pass thickens the fade.
function inkText(context: CanvasRenderingContext2D, text: string, x: number, y: number, fill: string, feather: number, pass: PrintPass): void {
  context.fillStyle = fill;
  if (pass !== "fill") {
    context.shadowColor = "#000000";
    context.shadowBlur = feather;
    context.strokeText(text, x, y);
    context.strokeText(text, x, y);
    context.shadowColor = "transparent";
    context.shadowBlur = 0;
  }
  if (pass !== "outline") context.fillText(text, x, y);
}

// Draws the print onto a face `width` pixels wide and `height` tall, which is
// what its size and margins are measured against.
export function drawCardPrint(context: CanvasRenderingContext2D, width: number, height: number, print: CardPrint, pass: PrintPass = "both"): void {
  const { label, color, icon, badge, badgeScale = 1, badgeGap = CARDS.badgeGap, name } = print;
  if (!label && !badge && !name) return;

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
  const iconStyle = {
    box: size * CARDS.iconSize,
    outline: (size * CARDS.outlineWidth * CARDS.iconOutline) / 2,
    feather,
  };
  // On its own (no number beside it) the symbol is a little larger.
  const symbolBox = size * CARDS.symbolSize * (label ? 1 : CARDS.soloSymbolScale) * badgeScale;
  // The column runs number, element icon, then the symbol (on a Seer or
  // Trickster); a Fool or Wizard has no number, so its symbol takes the top.
  const iconTop = top + context.lineWidth / 2 + size * CARDS.iconGap;
  const iconBottom = icon
    ? iconTop + icon.height * Math.min(iconStyle.box / icon.width, iconStyle.box / icon.height)
    : iconTop;
  const symbolTop = label
    ? iconBottom + context.lineWidth + size * badgeGap
    : top - wide.actualBoundingBoxAscent;

  // The top right corner, and the top left as well if both are wanted.
  const centres = CARDS.bothCorners ? [centerOffset, width - centerOffset] : [width - centerOffset];

  for (const center of centres) {
    if (label) inkText(context, label, center - penOffset, top, color, feather, pass);

    if (icon && label) drawIcon(context, icon, center, iconTop, iconStyle, pass);

    if (badge) drawIcon(context, badge, center, symbolTop, { ...iconStyle, box: symbolBox }, pass);
  }

  // A card with a symbol has a yellow title like it; the rest take the number's
  // colour.
  if (name) drawName(context, width, height, name, badge ? CARDS.specialColor : color, pass);
}

// The card's title across its middle, in the number's font and outline.
// It is as large as the numbers unless that would run wider than the share of
// the card allowed, and then it is shrunk to fit.
function drawName(context: CanvasRenderingContext2D, width: number, height: number, name: string, color: string, pass: PrintPass): void {
  let size = Math.round(width * CARDS.nameSize);
  context.font = `${NAME_WEIGHT} ${size}px ${NAME_FONT}, serif`;
  const measured = context.measureText(name).width;
  const room = width * CARDS.nameMaxWidth;
  if (measured > room) {
    size = Math.round((size * room) / measured);
    context.font = `${NAME_WEIGHT} ${size}px ${NAME_FONT}, serif`;
  }

  context.textAlign = "center";
  context.textBaseline = "alphabetic";
  context.lineJoin = "round";
  context.lineWidth = size * CARDS.outlineWidth;
  context.strokeStyle = "#000000";

  // Centred, a little below the card's middle, by the ink's own height, not the
  // line box.
  const ink = context.measureText(name);
  const baseline =
    height * (0.5 + CARDS.nameDropFraction) + (ink.actualBoundingBoxAscent - ink.actualBoundingBoxDescent) / 2;
  inkText(context, name, width / 2, baseline, color, size * CARDS.outlineFeather, pass);
  context.textAlign = "left";
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
  pass: PrintPass = "both",
): void {
  const scale = Math.min(box / icon.width, box / icon.height);
  const w = icon.width * scale;
  const h = icon.height * scale;
  if (pass === "fill") {
    context.drawImage(icon, centerX - w / 2, top, w, h);
    return;
  }
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
  if (pass !== "outline") context.drawImage(icon, centerX - w / 2, top, w, h);
}
