import type { Suit } from "../../models/card.js";
import type { PlayedCard } from "../../models/wizardGame.js";
import { canBeTaken, playerOf, powerOn, swapOwners, type RoleOf } from "./rolePlay.js";
import type { RoleAction } from "./roles.js";

// How long a Fisher has to choose before a card is picked for them at random.
export const FISHING_TIMEOUT_MS = 15_000;

// The places in a complete trick the Fisher's 3 at `three` may fish from: any
// card played after it, whoever holds it now, but no Wizard or Jester and not
// the Fisher's own. By then a Thief's 1 or a Servant's 2 is just a card.
export function fishingSpots(playedCards: PlayedCard[], three: number): number[] {
  const fisher = playedCards[three] ? playerOf(playedCards[three]) : undefined;

  return playedCards.flatMap((played, index) =>
    index > three && played.username !== fisher && canBeTaken(played) ? [index] : []);
}

// The Fisher's power, a must: once the trick is complete, a Fisher whose 3
// was played in the lead suit or as a trump picks one card played after it,
// and swaps it for the card they hold. Powers never move with cards: a Thief
// may steal the 3, or a Servant receive it, and the Fisher still fishes.
// Returns the place of the next 3 to fish with, in play order: one that has
// not fished yet and has something to fish. Null when no Fisher is left.
export function nextFisher(
  playedCards: PlayedCard[],
  actions: RoleAction[] | undefined,
  trumpSuit: Suit | null,
  roleOf: RoleOf,
): number | null {
  const fished = new Set((actions ?? []).filter((action) => action.role === "fisher").map((action) => action.by));
  const three = playedCards.findIndex((played, index) =>
    powerOn(playedCards, index, "fisher", trumpSuit, roleOf)
    && !fished.has(playerOf(played))
    && fishingSpots(playedCards, index).length > 0);

  return three === -1 ? null : three;
}

// The catch: the Fisher and the holder of the card at `spot` swap the cards
// they hold.
export function fish(playedCards: PlayedCard[], fisher: string, spot: number): RoleAction {
  const own = playedCards.find((played) => played.username === fisher);
  const caught = playedCards[spot];

  if (!own || !caught) {
    throw new Error("Nothing to fish there");
  }

  const action: RoleAction = { role: "fisher", by: fisher, on: caught.username, card: caught.card };

  swapOwners(own, caught);

  return action;
}

// A bot's catch: a card that wins it the trick while it still needs tricks,
// one that doesn't once it has enough; any card when there is no such one.
export function botCatch(spots: number[], winsWith: (spot: number) => boolean, wantsTricks: boolean): number {
  return spots.find((spot) => winsWith(spot) === wantsTricks) ?? spots[0]!;
}

// A human whose time ran out gets a card at random.
export const randomCatch = (spots: number[]): number =>
  spots[Math.floor(Math.random() * spots.length)]!;
