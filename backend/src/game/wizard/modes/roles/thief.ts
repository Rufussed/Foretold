import type { Suit } from "../../models/card.js";
import type { PlayedCard } from "../../models/wizardGame.js";
import { canBeTaken, powerOn, type RoleOf } from "./rolePlay.js";
import type { RoleAction } from "./roles.js";

// The Thief's power, a must: the moment the Thief plays their 1 in the lead
// suit or as a trump, they take the card played just before it, and that
// player gets the 1. Nothing happens when the 1 leads the trick, the card
// before it is a Wizard or Jester, or it is a Servant's 2 or a Fisher's 3: a
// Thief cannot outsmart those, so they meet and stay as they are.
export function findSteal(
  playedCards: PlayedCard[],
  trumpSuit: Suit | null,
  roleOf: RoleOf,
): RoleAction | null {
  const last = playedCards.length - 1;
  const one = playedCards[last];
  const before = playedCards[last - 1];

  if (!one || !before || !powerOn(playedCards, last, "thief", trumpSuit, roleOf)) {
    return null;
  }

  if (
    !canBeTaken(before)
    || powerOn(playedCards, last - 1, "servant", trumpSuit, roleOf)
    || powerOn(playedCards, last - 1, "fisher", trumpSuit, roleOf)
  ) {
    return null;
  }

  return { role: "thief", by: one.username, on: before.username, card: before.card };
}
