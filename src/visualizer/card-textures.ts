import * as THREE from "three";
import type { Card } from "../../backend/src/game/wizard/models/card";
<<<<<<< HEAD
=======
import { CARDS } from "./config";
import { cardArtTexture, cardBackTexture } from "./card-texture-loader";

// The one place the table asks for a card's look. Faces are the scanned
// artwork in public/cards; card-texture-generator.ts holds the drawn-in-code
// faces this replaced, kept for numbering a deck of our own later.
>>>>>>> origin/master

export const cardKey = (card: Card): string =>
  `${card.suit}-${card.value}`;

<<<<<<< HEAD
const textureLoader = new THREE.TextureLoader();
const textures = new Map<string, THREE.Texture>();

function getCardFilename(card: Card): string {
  const suit = card.suit.toLowerCase();

  if (card.value === 0) {
    return `${suit}Jester.png`;
  }

  if (card.value === 14) {
    return `${suit}Wizard.png`;
  }

  const value = String(card.value).padStart(2, "0");
  return `${suit}${value}.png`;
}

export function cardTexture(card: Card): THREE.Texture {
  const key = cardKey(card);
  const cached = textures.get(key);

  if (cached) {
    return cached;
  }

  const suit = card.suit.toLowerCase();
  const filename = getCardFilename(card);
  const url = `/cards/${suit}/${filename}`;

  const texture = textureLoader.load(url);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.flipY = false;
  texture.anisotropy = 8;

  textures.set(key, texture);
  return texture;
}

export function blankCardTexture(): THREE.Texture {
  const key = "backCard";
  const cached = textures.get(key);

  if (cached) {
    return cached;
  }

  const texture = textureLoader.load("/cards/back/backCard.png");
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.flipY = false;
  texture.anisotropy = 8;

  textures.set(key, texture);
  return texture;
}

=======
// A card's own face.
export const cardTexture = (card: Card): THREE.Texture => cardArtTexture(card);

// The face on cards whose identity this player never sees: the other players'
// hands and the stack. Plain, not the back art, which the mesh's own back face
// already shows: a card carrying the back on both sides reads as a mistake
// from any angle that sees the front. A card only gets its real face once the
// server has told us what it is, which for another player's card means the
// moment it is played.
let blank: THREE.CanvasTexture | null = null;
export function blankCardTexture(): THREE.Texture {
  if (blank) return blank;
  // One pixel of flat colour: it is stretched over the whole face, and there
  // is nothing on it to hold detail.
  const canvas = document.createElement("canvas");
  canvas.width = 1;
  canvas.height = 1;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("2D canvas unavailable for blank card faces");
  context.fillStyle = CARDS.hiddenFaceColor;
  context.fillRect(0, 0, 1, 1);

  blank = new THREE.CanvasTexture(canvas);
  blank.colorSpace = THREE.SRGBColorSpace;
  blank.flipY = false;
  return blank;
}

// The back side of the card mesh, which every card shows face-down.
export { cardBackTexture };

// The trump suit's colour, for tinting UI rather than cards. A plain trump
// card is its own suit; a Wizard or Jester takes the suit the round's first
// player chooses. Grey with no suit.
>>>>>>> origin/master
export function trumpColor(trumpSuit: string | null): string {
  return trumpSuit ?? "";
}
<<<<<<< HEAD

export function trumpFaceTexture(
  card: Card,
  _trumpSuit: string | null,
): THREE.Texture {
  return cardTexture(card);
}

// import * as THREE from "three";
// import type { Card } from "../../backend/src/game/wizard/models/card";
// import { CARDS } from "./config";

// export const cardKey = (card: Card): string => `${card.suit}-${card.value}`;

// // In the game rules Jesters are value 0 and Wizards 14.
// export function cardLabel(card: Card): string {
//   if (card.value === 0) return "J";
//   if (card.value === 14) return "W";
//   return String(card.value);
// }

// export interface CardFaceOptions {
//   // Paint the face this colour instead of the card's own suit colour.
//   color?: string;
//   // Draw this in the corners instead of the card's value; "" leaves them blank.
//   label?: string;
// }

// const textures = new Map<string, THREE.CanvasTexture>();

// // Placeholder faces drawn in code until handmade art exists: the suit colour
// // with the value in both top corners, black with a white outline. Each face is
// // drawn the first time that card is needed and then cached, so none of the 60
// // is made twice and unused ones are never made. When the artwork arrives, this
// // is the one place to load it instead.
// export function cardTexture(card: Card, options: CardFaceOptions = {}): THREE.Texture {
//   // Wizards and Jesters belong to no suit: they get every suit's colour, in a
//   // gradient down the card, unless a colour is asked for.
//   const special = card.value === 0 || card.value === 14;
//   const color = options.color ?? (special ? null : CARDS.suitColors[card.suit] ?? "#808080");
//   const label = options.label ?? cardLabel(card);
//   const key = `${cardKey(card)} ${color ?? "gradient"} ${label}`;
//   const cached = textures.get(key);
//   if (cached) return cached;

//   const width = CARDS.textureWidth;
//   const height = CARDS.textureHeight;
//   const canvas = document.createElement("canvas");
//   canvas.width = width;
//   canvas.height = height;
//   const context = canvas.getContext("2d");
//   if (!context) throw new Error("2D canvas unavailable for card faces");

//   if (color) {
//     context.fillStyle = color;
//   } else {
//     const gradient = context.createLinearGradient(0, 0, 0, height);
//     const stops = CARDS.specialCardGradient;
//     stops.forEach((suit, i) => gradient.addColorStop(i / (stops.length - 1), CARDS.suitColors[suit] ?? "#808080"));
//     context.fillStyle = gradient;
//   }
//   context.fillRect(0, 0, width, height);

//   const size = Math.round(width * CARDS.labelSize);
//   context.font = `900 ${size}px system-ui, sans-serif`;
//   context.textAlign = "left";
//   context.textBaseline = "alphabetic";
//   context.lineJoin = "round";
//   context.lineWidth = size * CARDS.outlineWidth;
//   context.strokeStyle = "#ffffff";
//   context.fillStyle = "#000000";

//   // Place by the glyphs' measured edges rather than the font's line box, which
//   // pads above the digits, so the gap is the same from the top and the sides.
//   // The gap runs to the outside of the outline.
//   const glyphs = context.measureText(label);
//   const inset = size * CARDS.labelMargin + context.lineWidth / 2;
//   const top = inset + glyphs.actualBoundingBoxAscent;
//   const left = inset + glyphs.actualBoundingBoxLeft;
//   const right = width - inset - glyphs.actualBoundingBoxRight;

//   for (const x of [left, right]) {
//     // Outline first, so the fill sits on top of its inner half.
//     context.strokeText(label, x, top);
//     context.fillText(label, x, top);
//   }

//   const texture = new THREE.CanvasTexture(canvas);
//   texture.colorSpace = THREE.SRGBColorSpace;
//   // glTF UVs put v=0 at the top of the image; GLTFLoader's own textures are
//   // unflipped for the same reason, so this lands exactly as the placeholder did.
//   texture.flipY = false;
//   texture.anisotropy = 8; // three clamps this to what the GPU supports
//   textures.set(key, texture);
//   return texture;
// }

// // The face on cards whose identity this player never sees (other players'
// // hands and the stack): plain, so nothing odd shows if one is glimpsed.
// export function blankCardTexture(): THREE.Texture {
//   return cardTexture({ suit: "Blue", value: 0 }, { color: CARDS.hiddenFaceColor, label: "" });
// }

// // The trump suit's colour. A plain trump card is its own suit; a Wizard or
// // Jester takes the suit the round's first player chooses. Grey with no suit.
// export function trumpColor(trumpSuit: string | null): string {
//   return trumpSuit ? CARDS.suitColors[trumpSuit] ?? CARDS.noTrumpColor : CARDS.noTrumpColor;
// }

// // The turned-up trump card in the trump colour. A Wizard or Jester keeps its
// // gradient until its suit is chosen, then shows just that colour, unlabelled.
// export function trumpFaceTexture(card: Card, trumpSuit: string | null): THREE.Texture {
//   if (!trumpSuit) return cardTexture(card);
//   const special = card.value === 0 || card.value === 14;
//   return cardTexture(card, { color: trumpColor(trumpSuit), ...(special ? { label: "" } : {}) });
// }
=======
>>>>>>> origin/master
