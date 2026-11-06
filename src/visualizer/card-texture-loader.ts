import type * as THREE from "three";
import type { Card } from "../../backend/src/game/wizard/models/card";
import * as deck from "../modes/sabotage/deck/sabotage-card-loader";

// The card art for every game mode. All the cards are drawn from one pool of
// pictures (src/assets/card-pool/), and the deck of the game on the table
// (card-decks.ts) says which picture each number uses; the numbers and titles
// are printed on in code (modes/sabotage/deck/). This file is where the table
// asks for them.

export const cardArtUrl = (card: Card): string => deck.cardArtUrl(card);

export const cardArtTexture = (card: Card): THREE.Texture => deck.cardArtTexture(card);

export const cardBackTexture = (): THREE.Texture => deck.cardBackTexture();

// Roles mode only: a face with a boost under its number (modes/roles/master/earth-boost.ts).
export const boostedCardArtTexture = (card: Card, boost: number): THREE.Texture => deck.boostedCardArtTexture(card, boost);

// The same texture, but resolving once its image has actually arrived, so the
// prefetch queue holds one card open at a time instead of starting the whole
// deck at once. A failed download is forgotten, so a later card can retry it.
export const preloadCardArt = (card: Card): Promise<THREE.Texture> => deck.preloadCardArt(card);
