import * as THREE from "three";
import type { Card } from "../../backend/src/game/wizard/models/card";

// Loads the scanned card art from public/cards. One file per card, plus the
// single back shown on every face-down card.

const CARDS_URL = "/cards";
const BACK_URL = `${CARDS_URL}/back/backCard.webp`;

// blue01.webp … blue13.webp, blueJester.webp, blueWizard.webp — Jesters are
// value 0 and Wizards 14, matching the game rules.
export function cardArtUrl(card: Card): string {
  const suit = card.suit.toLowerCase();
  const name =
    card.value === 0 ? "Jester" : card.value === 14 ? "Wizard" : String(card.value).padStart(2, "0");
  return `${CARDS_URL}/${suit}/${suit}${name}.webp`;
}

const loader = new THREE.TextureLoader();
const textures = new Map<string, THREE.Texture>();

// three fills the texture in once the image arrives, so this can stay
// synchronous: the card shows blank for a frame or two, then its face.
function load(url: string): THREE.Texture {
  const cached = textures.get(url);
  if (cached) return cached;

  const texture = loader.load(url);
  texture.colorSpace = THREE.SRGBColorSpace;
  // glTF UVs put v=0 at the top of the image; GLTFLoader's own textures are
  // unflipped for the same reason, so this lands the way the mesh expects.
  texture.flipY = false;
  texture.anisotropy = 16; // three clamps this to what the GPU supports
  textures.set(url, texture);
  return texture;
}

export const cardArtTexture = (card: Card): THREE.Texture => load(cardArtUrl(card));

export const cardBackTexture = (): THREE.Texture => load(BACK_URL);
