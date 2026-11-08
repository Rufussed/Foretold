import { isJester, isWizard, type Suit } from "../../models/card.js";
import type { PlayedCard } from "../../models/wizardGame.js";
import { canBeTaken, powerOn, swapOwners, type RoleOf } from "./rolePlay.js";
import type { RoleAction } from "./roles.js";

// What each steal takes from the player robbed, straight onto the Thief's
// score; never more than that player has.
export const STEAL_POINTS = 10;

// The Thief's power, a must: the moment the Thief plays their 1, they take a
// card already played, and that player gets the 1. In the lead suit it is
// the card just before; as a trump, any card before it, the Thief's choice.
// Nothing can be taken when the 1 leads the trick, from a Wizard or Jester,
// or from a Servant's 2: a Thief cannot outsmart a Servant, so the two meet
// and stay as they are. Returns the places in the trick the 1, its last
// card, may take; the one nearest it is taken when no choice is made.
export function stealSpots(
  playedCards: PlayedCard[],
  trumpSuit: Suit | null,
  roleOf: RoleOf,
): number[] {
  const last = playedCards.length - 1;
  const one = playedCards[last];

  if (!one || last < 1 || !powerOn(playedCards, last, "thief", trumpSuit, roleOf)) {
    return [];
  }

  const first = one.card.suit === trumpSuit ? 0 : last - 1;
  const spots: number[] = [];

  for (let spot = first; spot < last; spot++) {
    if (canBeTaken(playedCards[spot]!) && !powerOn(playedCards, spot, "servant", trumpSuit, roleOf)) {
      spots.push(spot);
    }
  }

  return spots;
}

// Why a Thief's 1 with its power on, not leading, steals nothing: the card
// nearest it is a Wizard, a Jester or a Servant's 2, and nothing further
// back may be taken. Undefined when there is something to steal, or no
// power at work.
export function stealFails(
  playedCards: PlayedCard[],
  trumpSuit: Suit | null,
  roleOf: RoleOf,
): "wizard" | "jester" | "servant" | undefined {
  const last = playedCards.length - 1;
  const nearest = playedCards[last - 1];

  if (!nearest || !powerOn(playedCards, last, "thief", trumpSuit, roleOf) || stealSpots(playedCards, trumpSuit, roleOf).length) {
    return undefined;
  }

  return isWizard(nearest.card) ? "wizard" : isJester(nearest.card) ? "jester" : "servant";
}

// The Thief's 1, the trick's last card, takes the card at this place.
export function steal(playedCards: PlayedCard[], spot: number): RoleAction {
  const one = playedCards.at(-1);
  const taken = playedCards[spot];

  if (!one || !taken) {
    throw new Error("Nothing to steal there");
  }

  const action: RoleAction = { role: "thief", by: one.username, on: taken.username, card: taken.card };

  swapOwners(one, taken);

  return action;
}
