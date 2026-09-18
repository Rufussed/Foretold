import * as THREE from "three";
import type { Card } from "../../backend/src/game/wizard/models/card";
import { CARDS } from "./config";
import { cardArtTexture, cardBackTexture } from "./card-texture-loader";

// The one place the table asks for a card's look. Faces are the scanned
// artwork in public/cards; card-texture-generator.ts holds the drawn-in-code
// faces this replaced, kept for numbering a deck of our own later.

export const cardKey = (card: Card): string => `${card.suit}-${card.value}`;

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
export function trumpColor(trumpSuit: string | null): string {
  return trumpSuit ? CARDS.suitColors[trumpSuit] ?? CARDS.noTrumpColor : CARDS.noTrumpColor;
}
