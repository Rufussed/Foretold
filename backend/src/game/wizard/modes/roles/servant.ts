import type { Suit } from "../../models/card.js";
import type { PlayedCard } from "../../models/wizardGame.js";
import { canBeTaken, powerOn, type RoleOf } from "./rolePlay.js";
import type { RoleAction } from "./roles.js";

// What a Servant is tipped by the player they served, never more than that
// player has: at once for the service, and again for winning that trick.
export const SERVICE_POINTS = 10;
export const SERVANT_BONUS = 10;

// The Servant's power, a must: the card played right after their 2 (in the
// lead suit or as a trump) becomes theirs, and its player gets the 2.
// Nothing happens when the 2 is the trick's last card, the next card is a
// Wizard or Jester, or it is a Thief's 1 or another Servant's 2: those meet
// their match and stay as they are.
export function findService(
  playedCards: PlayedCard[],
  trumpSuit: Suit | null,
  roleOf: RoleOf,
): RoleAction | null {
  const last = playedCards.length - 1;
  const next = playedCards[last];
  const two = playedCards[last - 1];

  if (!next || !two || !powerOn(playedCards, last - 1, "servant", trumpSuit, roleOf)) {
    return null;
  }

  if (
    !canBeTaken(next)
    || powerOn(playedCards, last, "thief", trumpSuit, roleOf)
    || powerOn(playedCards, last, "servant", trumpSuit, roleOf)
  ) {
    return null;
  }

  return { role: "servant", by: two.username, on: next.username, card: next.card };
}

// Who tips whoever won the trick: the players they served in it, if any.
export function tippers(actions: RoleAction[] | undefined, winner: string): string[] {
  return (actions ?? [])
    .filter((action) => action.role === "servant" && action.by === winner)
    .map((action) => action.on);
}
