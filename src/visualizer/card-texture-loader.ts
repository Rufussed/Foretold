import * as THREE from "three";
import type { Card, Suit } from "../../backend/src/game/wizard/models/card";
import { sharpenImage } from "./card-sharpen";
import { CARDS } from "./config";

// Loads the scanned card art from src/assets/cards. One file per card, plus the
// single back shown on every face-down card.

// Vite copies each file into the build with a hash of its contents in its name,
// so re-scanned art reaches players as a new URL their cache cannot mistake for
// the old one. The hash is only known at build time, so a card's path can no
// longer be assembled from its suit and value: that naming still decides which
// file is wanted, but the URL itself comes from this table. Keys are the glob
// patterns exactly as written above.
const CARD_FILES = import.meta.glob("../assets/cards/**/*.webp", {
  query: "?url",
  import: "default",
  eager: true,
}) as Record<string, string>;

function cardFile(path: string): string {
  const url = CARD_FILES[`../assets/cards/${path}`];
  // A missing file is a mistake in the naming below or a card that was never
  // scanned; say so rather than handing three.js undefined and drawing a blank.
  if (!url) throw new Error(`No card art at ${path}`);
  return url;
}

const BACK_URL = cardFile("back/backCard.webp");

// The Foretold faces in src/assets/foretold_cards, one gem per suit, named like
// the scans (topaz01.webp … topazWizard.webp). They share the scans' back.
// Set to false to go back to the scanned faces.
const USE_FORETOLD_FACES = true;

const FORETOLD_FILES = import.meta.glob("../assets/foretold_cards/**/*.webp", {
  query: "?url",
  import: "default",
  eager: true,
}) as Record<string, string>;

const FORETOLD_GEMS: Record<Suit, string> = {
  Blue: "topaz",
  Green: "jade",
  Yellow: "gold",
  Red: "ruby",
};

function foretoldFile(path: string): string {
  const url = FORETOLD_FILES[`../assets/foretold_cards/${path}`];
  if (!url) throw new Error(`No Foretold card art at ${path}`);
  return url;
}

// blue01.webp … blue13.webp, blueJester.webp, blueWizard.webp — Jesters are
// value 0 and Wizards 14, matching the game rules.
export function cardArtUrl(card: Card): string {
  const name =
    card.value === 0 ? "Jester" : card.value === 14 ? "Wizard" : String(card.value).padStart(2, "0");
  if (USE_FORETOLD_FACES) {
    const gem = FORETOLD_GEMS[card.suit];
    return foretoldFile(`${gem}/${gem}${name}.webp`);
  }
  const suit = card.suit.toLowerCase();
  return cardFile(`${suit}/${suit}${name}.webp`);
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
    () => {
      // Lift the art's edges before the GPU shrinks it (see card-sharpen.ts).
      const image = texture.image as (CanvasImageSource & { width: number; height: number }) | undefined;
      const sharpened = image && sharpenImage(image, CARDS.artSharpen);
      if (sharpened) {
        texture.image = sharpened as unknown as HTMLImageElement;
        texture.needsUpdate = true;
      }
      settle(texture);
    },
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
