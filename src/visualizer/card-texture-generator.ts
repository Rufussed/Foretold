import * as THREE from "three";
import type { Card } from "../../backend/src/game/wizard/models/card";
import { CARDS } from "./config";

// Card faces drawn in code: the suit colour with the value in both top
// corners, black with a white outline. These were the placeholders the table
// ran on before the scanned artwork in public/cards replaced them.
//
// Nothing imports this at runtime any more. It is kept, and kept compiling,
// because it is the way to put a number on a card without an artist: if we
// ever print our own deck, this numbers the faces and the art is supplied as
// images. Deleting it would mean writing it again.

export interface CardFaceOptions {
  // Paint the face this colour instead of the card's own suit colour.
  color?: string;
  // Draw this in the corners instead of the card's value; "" leaves them blank.
  label?: string;
}

// In the game rules Jesters are value 0 and Wizards 14.
export function cardLabel(card: Card): string {
  if (card.value === 0) return "J";
  if (card.value === 14) return "W";
  return String(card.value);
}

const textures = new Map<string, THREE.CanvasTexture>();

// Each face is drawn the first time that card is needed and then cached, so
// none of the 60 is made twice and unused ones are never made.
export function generatedCardTexture(card: Card, options: CardFaceOptions = {}): THREE.Texture {
  // Wizards and Jesters belong to no suit: they get every suit's colour, in a
  // gradient down the card, unless a colour is asked for.
  const special = card.value === 0 || card.value === 14;
  const color = options.color ?? (special ? null : CARDS.suitColors[card.suit] ?? "#808080");
  const label = options.label ?? cardLabel(card);
  const key = `${card.suit}-${card.value} ${color ?? "gradient"} ${label}`;
  const cached = textures.get(key);
  if (cached) return cached;

  const width = CARDS.textureWidth;
  const height = CARDS.textureHeight;
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("2D canvas unavailable for card faces");

  if (color) {
    context.fillStyle = color;
  } else {
    const gradient = context.createLinearGradient(0, 0, 0, height);
    const stops = CARDS.specialCardGradient;
    stops.forEach((suit, i) => gradient.addColorStop(i / (stops.length - 1), CARDS.suitColors[suit] ?? "#808080"));
    context.fillStyle = gradient;
  }
  context.fillRect(0, 0, width, height);

  const size = Math.round(width * CARDS.labelSize);
  context.font = `900 ${size}px system-ui, sans-serif`;
  context.textAlign = "left";
  context.textBaseline = "alphabetic";
  context.lineJoin = "round";
  context.lineWidth = size * CARDS.outlineWidth;
  context.strokeStyle = "#ffffff";
  context.fillStyle = "#000000";

  // Place by the glyphs' measured edges rather than the font's line box, which
  // pads above the digits, so the gap is the same from the top and the sides.
  // The gap runs to the outside of the outline.
  const glyphs = context.measureText(label);
  const inset = size * CARDS.labelMargin + context.lineWidth / 2;
  const top = inset + glyphs.actualBoundingBoxAscent;
  const left = inset + glyphs.actualBoundingBoxLeft;
  const right = width - inset - glyphs.actualBoundingBoxRight;

  for (const x of [left, right]) {
    // Outline first, so the fill sits on top of its inner half.
    context.strokeText(label, x, top);
    context.fillText(label, x, top);
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  // glTF UVs put v=0 at the top of the image; GLTFLoader's own textures are
  // unflipped for the same reason, so this lands exactly as the mesh expects.
  texture.flipY = false;
  texture.anisotropy = 16; // three clamps this to what the GPU supports
  textures.set(key, texture);
  return texture;
}
