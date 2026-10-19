import * as THREE from "three";
import type { Card } from "../../backend/src/game/wizard/models/card";
import { cardFile } from "./card-art-files";
import { elementIcon } from "./card-icons";
import { sharpenImage } from "./card-sharpen";
import { wearCard } from "./card-wear";
import { prepareCardBack, type FacePrint } from "./card-back";
import { cardElement, cardFontReady, cardLabel, drawCardPrint } from "./card-label";
import { CARDS } from "./config";

// Loads the card art from src/assets/cards. One file per card, plus the single
// back shown on every face-down card. The art carries no numbers: each face
// has its number printed on as it loads (see card-label.ts), and the back its
// title and ring icons (see card-back.ts).

const BACK_URL = cardFile("back/backCard.webp");

// air-1.webp … air-13.webp, air-jester.webp, air-wizard.webp — named for the
// suit's element. Jesters are value 0 and Wizards 14, matching the game rules.
export function cardArtUrl(card: Card): string {
  const element = cardElement(card);
  const name = card.value === 0 ? "jester" : card.value === 14 ? "wizard" : String(card.value);
  return cardFile(`${element}/${element}-${name}.webp`);
}

// What a card's face needs printed on it: its number in its element's colour,
// and the element's icon. The font and the icon are fetched on first use, so a
// face waits on both; if either fails the face still gets what did arrive.
async function cardPrint(card: Card): Promise<FacePrint> {
  const element = cardElement(card);
  const [icon] = await Promise.all([
    elementIcon(element).catch(() => undefined),
    cardFontReady().catch(() => {}),
  ]);
  const print = { label: cardLabel(card), color: CARDS.elementColors[element] ?? "#ffffff", icon };
  return (context, width) => drawCardPrint(context, width, print);
}

// The art sharpened and worn at the edges, with the print on top. Sharpening
// comes first so the wear and the print's edges are left as drawn.
function printedFace(
  image: CanvasImageSource & { width: number; height: number },
  print: FacePrint | null,
  seed: string,
): CanvasImageSource | null {
  const sharpened = sharpenImage(image, CARDS.artSharpen);

  const canvas = sharpened ?? document.createElement("canvas");
  if (!sharpened) {
    canvas.width = image.width;
    canvas.height = image.height;
    canvas.getContext("2d")?.drawImage(image, 0, 0);
  }
  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (!context) return sharpened;
  wearCard(context, canvas.width, canvas.height, seed);
  print?.(context, canvas.width, canvas.height);
  return canvas;
}

const loader = new THREE.TextureLoader();
// Keyed by file and label together: until each card has its own art, Vite
// serves identical files as one URL, and cards sharing it still differ by number.
const textures = new Map<string, THREE.Texture>();
const textureKey = (url: string, id: string): string => `${url}#${id}`;
// The same entries, as promises, for callers that want to know when the image
// has arrived rather than letting it appear a frame later.
const arrivals = new Map<string, Promise<THREE.Texture>>();

// three fills the texture in once the image arrives, so this can stay
// synchronous: the card shows blank for a frame or two, then its face.
// `id` tells apart faces that share a file, and `prepare` makes what is printed
// on this one: a card's number and icon, or the back's title and ring icons.
function load(url: string, id: string, prepare: () => Promise<FacePrint>): THREE.Texture {
  const key = textureKey(url, id);
  const cached = textures.get(key);
  if (cached) return cached;

  let settle: (texture: THREE.Texture) => void = () => {};
  let fail: (error: unknown) => void = () => {};
  arrivals.set(
    key,
    new Promise<THREE.Texture>((resolve, reject) => {
      settle = resolve;
      fail = reject;
    }),
  );

  const texture = loader.load(
    url,
    () => {
      void prepare().then((print) => {
        // Lift the art's edges before the GPU shrinks it (see card-sharpen.ts).
        const image = texture.image as (CanvasImageSource & { width: number; height: number }) | undefined;
        const face = image && printedFace(image, print, key);
        if (face) {
          texture.image = face as unknown as HTMLImageElement;
          texture.needsUpdate = true;
        }
        settle(texture);
      });
    },
    undefined,
    (error) => fail(error),
  );
  texture.colorSpace = THREE.SRGBColorSpace;
  // glTF UVs put v=0 at the top of the image; GLTFLoader's own textures are
  // unflipped for the same reason, so this lands the way the mesh expects.
  texture.flipY = false;
  texture.anisotropy = 16; // three clamps this to what the GPU supports
  textures.set(key, texture);
  return texture;
}

export const cardArtTexture = (card: Card): THREE.Texture => load(cardArtUrl(card), cardLabel(card), () => cardPrint(card));

export const cardBackTexture = (): THREE.Texture => load(BACK_URL, "back", prepareCardBack);

// The same texture, but resolving once its image has actually arrived, so the
// prefetch queue holds one card open at a time instead of starting the whole
// deck at once. A failed download is forgotten, so a later card can retry it.
export function preloadCardArt(card: Card): Promise<THREE.Texture> {
  const key = textureKey(cardArtUrl(card), cardLabel(card));
  load(cardArtUrl(card), cardLabel(card), () => cardPrint(card));
  const arrival = arrivals.get(key) ?? Promise.resolve(textures.get(key)!);
  return arrival.catch((error) => {
    textures.delete(key);
    arrivals.delete(key);
    throw error;
  });
}
