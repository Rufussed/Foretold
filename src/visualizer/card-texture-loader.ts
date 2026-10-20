import * as THREE from "three";
import type { Card } from "../../backend/src/game/wizard/models/card";
import { cardFile } from "./card-art-files";
import { elementIcon } from "./card-icons";
import { sharpenImage } from "./card-sharpen";
import { wearCard } from "./card-wear";
import { prepareCardBack, type FacePrint } from "./card-back";
import { cardElement, cardFontReady, cardLabel, drawCardPrint, isSpecialCard } from "./card-label";
import { t, type MessageKey } from "../i18n";
import { powerOf } from "../../backend/src/game/wizard/models/card";
import { CARDS } from "./config";

// Loads the card art from src/assets/cards. One file per card, plus the single
// back shown on every face-down card. The art carries no numbers: each face
// has its number printed on as it loads (see card-label.ts), and the back its
// title and ring icons (see card-back.ts).

const BACK_URL = cardFile("back/backCard.webp");

// air-1.webp … air-13.webp, air-jester.webp, air-wizard.webp — named for the
// suit's element. Jesters are value 0 and Wizards 14, matching the game rules.
const cardArtName = (card: Card): string =>
  card.value === 0 ? "jester" : card.value === 14 ? "wizard" : String(card.value);

export function cardArtUrl(card: Card): string {
  const element = cardElement(card);
  return cardFile(`${element}/${element}-${cardArtName(card)}.webp`);
}

// What a card's face needs printed on it: its number in its element's colour,
// the element's icon and its title across the middle (a Seer or Trickster also
// carries a letter above the number). Jesters and Wizards have no suit, so they get their
// letter in the special colour and no icon. The font and the icon are fetched
// on first use, so a face waits on both; if either fails the face still gets
// what did arrive.
async function cardPrint(card: Card): Promise<FacePrint> {
  const special = isSpecialCard(card);
  const element = cardElement(card);
  const [icon] = await Promise.all([
    special ? undefined : elementIcon(element).catch(() => undefined),
    cardFontReady().catch(() => {}),
  ]);
  const color = special ? CARDS.specialColor : CARDS.elementColors[element] ?? "#ffffff";
  const print = { label: cardLabel(card), color, icon, badge: cardBadge(card), name: cardTitle(card) };
  return (context, width, height) => drawCardPrint(context, width, height, print);
}

// The Seer carries an S and the Trickster a T, until each has a symbol of its
// own.
function cardBadge(card: Card): string | undefined {
  const power = powerOf(card);
  return power === "seer" ? "S" : power === "trickster" ? "T" : undefined;
}

// The card's title, in the language being played: its rank in the hierarchy,
// or Fool and Wizard for the two outside it.
function cardTitle(card: Card): string {
  if (card.value === 0) return t("card.jester");
  if (card.value === 14) return t("card.wizard");
  return t(`rank.${card.value}` as MessageKey);
}

// Washes the art with a colour, keeping its light and dark: the "color" blend
// takes only the hue and saturation from the fill.
function tintArt(context: CanvasRenderingContext2D, width: number, height: number, color: string): void {
  context.save();
  context.globalCompositeOperation = "color";
  context.globalAlpha = CARDS.tintStrength;
  context.fillStyle = color;
  context.fillRect(0, 0, width, height);
  context.restore();
}

// The colour a card's art is tinted, if it is one of the stand-ins.
function cardTint(card: Card): string | null {
  const element = cardElement(card);
  if (!CARDS.tintedCards.includes(`${element}-${cardArtName(card)}`)) return null;
  return CARDS.elementColors[element] ?? null;
}

// The art sharpened and worn at the edges, with the print on top. Sharpening
// comes first so the wear and the print's edges are left as drawn.
function printedFace(
  image: CanvasImageSource & { width: number; height: number },
  print: FacePrint | null,
  seed: string,
  tint: string | null,
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
  if (tint) tintArt(context, canvas.width, canvas.height, tint);
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
function load(
  url: string,
  id: string,
  prepare: () => Promise<FacePrint>,
  tint: string | null = null,
): THREE.Texture {
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
        const face = image && printedFace(image, print, key, tint);
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

// Cards sharing a file can still differ in number and tint, so both are part of
// what tells their textures apart.
// A title in another language is another face, so the title is part of it too.
const faceId = (card: Card): string => `${cardLabel(card)}${cardTint(card) ?? ""}${cardTitle(card) ?? ""}`;

export const cardArtTexture = (card: Card): THREE.Texture =>
  load(cardArtUrl(card), faceId(card), () => cardPrint(card), cardTint(card));

export const cardBackTexture = (): THREE.Texture => load(BACK_URL, "back", prepareCardBack);

// The same texture, but resolving once its image has actually arrived, so the
// prefetch queue holds one card open at a time instead of starting the whole
// deck at once. A failed download is forgotten, so a later card can retry it.
export function preloadCardArt(card: Card): Promise<THREE.Texture> {
  const key = textureKey(cardArtUrl(card), faceId(card));
  load(cardArtUrl(card), faceId(card), () => cardPrint(card), cardTint(card));
  const arrival = arrivals.get(key) ?? Promise.resolve(textures.get(key)!);
  return arrival.catch((error) => {
    textures.delete(key);
    arrivals.delete(key);
    throw error;
  });
}
