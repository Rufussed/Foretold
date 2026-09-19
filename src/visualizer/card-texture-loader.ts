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
// The same entries, as promises, for callers that want to know when the image
// has arrived rather than letting it appear a frame later.
const arrivals = new Map<string, Promise<THREE.Texture>>();

// three fills the texture in once the image arrives, so this can stay
// synchronous: the card shows blank for a frame or two, then its face.
function load(url: string): THREE.Texture {
  const cached = textures.get(url);
  if (cached) return cached;

  let settle: (texture: THREE.Texture) => void = () => {};
  let fail: (error: unknown) => void = () => {};
  arrivals.set(
    url,
    new Promise<THREE.Texture>((resolve, reject) => {
      settle = resolve;
      fail = reject;
    }),
  );

  const texture = loader.load(
    url,
    () => settle(texture),
    undefined,
    (error) => fail(error),
  );
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

// The same texture, but resolving once its image has actually arrived, so the
// prefetch queue holds one card open at a time instead of starting the whole
// deck at once. A failed download is forgotten, so a later card can retry it.
export function preloadCardArt(card: Card): Promise<THREE.Texture> {
  const url = cardArtUrl(card);
  load(url);
  const arrival = arrivals.get(url) ?? Promise.resolve(textures.get(url)!);
  return arrival.catch((error) => {
    textures.delete(url);
    arrivals.delete(url);
    throw error;
  });
}
