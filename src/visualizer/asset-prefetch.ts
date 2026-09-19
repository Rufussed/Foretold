import { SUITS, type Card, type CardValue } from "../../backend/src/game/wizard/models/card";
import { enqueuePrefetch } from "../services/prefetch-queue";
import { cardBackTexture, preloadCardArt } from "./card-texture-loader";
import { CHARACTER_IDS, loadCharacterAsset } from "./character-assets";
import { loadTableScene } from "./table-scene-asset";

// What the game needs, fetched while the player is still signing in and
// picking a room. Each loader here keeps its own session cache, so a prefetched
// asset is already parsed when the waiting room or the table asks for it, and
// the browser's HTTP cache covers a reload (see the Cache-Control headers the
// backend sets on /models and /cards).
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

export function prefetchGameAssets(): void {
  enqueuePrefetch(
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
  );
}
