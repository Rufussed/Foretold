import { SUITS, type Card, type CardValue } from "../../backend/src/game/wizard/models/card";
import { enqueuePrefetch, type PrefetchTask } from "../services/prefetch-queue";
import { cardArtUrl, cardBackTexture, preloadCardArt } from "./card-texture-loader";
import { CHARACTER_IDS, characterModelUrl, loadCharacterAsset } from "./character-assets";
import { WIZARD_TABLE_MODEL_URL } from "./environment-setup";
import { loadTableScene } from "./table-scene-asset";
import { loadTesseract, TESSERACT_URL } from "./tesseract";

// What the game needs, fetched while the player is still signing in and
// picking a room, so the waiting room and the table open on assets that have
// already arrived. The browser's HTTP cache covers a reload and the next visit
// (the files are named after their contents, so a cached one is never stale).
//
// The order is the order the player meets them, and the characters come before
// the cards deliberately: the waiting room asks the player to pick from a grid
// of all six, so none of the grid is usable until every model has arrived,
// while the cards are not needed until the game itself deals them. Do not
// reorder this to put the card art first because those files are far smaller
// (1.8MB for the whole deck against ~16MB of characters) — that would hand the
// player an unfilled grid to choose from.

// Jester (0), 1..13, Wizard (14) in each suit: the whole deck's artwork.
const DECK: Card[] = SUITS.flatMap((suit) =>
  Array.from({ length: 15 }, (_, value) => ({ suit, value: value as CardValue })),
);

// Phones and small tablets fetch the bytes and stop there, instead of building
// models and textures out of them.
//
// Parsing costs far more than downloading: six rigged characters and 61 card
// faces decoded and held in memory is tens of megabytes a phone has not got,
// on the home page, where the only thing on screen is the backdrop. A browser
// that runs short takes the graphics context away, and the background turns
// white mid-animation. Warming the cache keeps the whole point of prefetching
// — the files are local when the waiting room asks — and leaves the parsing to
// the page that actually shows them.
function isConstrainedDevice(): boolean {
  const nav = navigator as Navigator & {
    deviceMemory?: number;
    connection?: { saveData?: boolean };
  };
  // Respect the setting before guessing at the hardware.
  if (nav.connection?.saveData) return true;
  if (typeof nav.deviceMemory === "number" && nav.deviceMemory <= 4) return true;
  return window.matchMedia?.("(pointer: coarse)").matches ?? false;
}

// Into the HTTP cache and no further: the body is read so the response
// completes, then dropped.
async function warmCache(url: string): Promise<void> {
  const response = await fetch(url, { credentials: "omit" });
  if (!response.ok) throw new Error(`${response.status} for ${url}`);
  await response.arrayBuffer();
}

const bytesOnlyTasks = (): PrefetchTask[] => [
  { name: "table scene", run: () => warmCache(WIZARD_TABLE_MODEL_URL) },
  ...CHARACTER_IDS.map((character) => ({
    name: `character ${character}`,
    run: () => warmCache(characterModelUrl(character)),
  })),
  {
    name: "card art",
    run: async () => {
      for (const card of DECK) await warmCache(cardArtUrl(card));
    },
  },
  { name: "tesseract", run: () => warmCache(TESSERACT_URL) },
];

const parsedTasks = (): PrefetchTask[] => [
  // Usually already loading for the backdrop; queued so the characters wait
  // for it rather than sharing the connection with it.
  { name: "table scene", run: () => loadTableScene() },
  ...CHARACTER_IDS.map((character) => ({
    name: `character ${character}`,
    run: () => loadCharacterAsset(character),
  })),
  {
    name: "card art",
    // One card at a time: 61 small files started at once would queue behind
    // each other anyway, and this way a page that suddenly needs the network
    // is only sharing it with a single request.
    run: async () => {
      cardBackTexture();
      for (const card of DECK) await preloadCardArt(card);
    },
  },
  // Last, though it is only 16KB: it is not wanted until a trick has been
  // won, by which time everything above it has long since arrived.
  { name: "tesseract", run: () => loadTesseract() },
];

export function prefetchGameAssets(): void {
  enqueuePrefetch(...(isConstrainedDevice() ? bytesOnlyTasks() : parsedTasks()));
}
