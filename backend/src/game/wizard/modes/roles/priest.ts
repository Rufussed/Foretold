import type { Card, Suit } from "../../models/card.js";
import type { PlayedCard } from "../../models/wizardGame.js";
import { playerOf, powerOn, type RoleOf } from "./rolePlay.js";

// What every royal card pays the Priest, in faith.
export const FAITH_POINTS = 5;

// What the Priest gives every poor card when their 8 wins the trick.
export const ALMS_POINTS = 5;

// The royal cards: the 11, 12 and 13 of any suit.
export const isRoyal = (card: Card): boolean => card.value >= 11 && card.value <= 13;

// The Priest's power, a must: a Priest's 8 played in the lead suit or as a
// trump makes every royal card in the trick pay them faith at the end of it,
// whoever wins, in any suit, played before or after the 8. Returns the
// Priests whose 8 has its power on, with their 8.
export function priestsIn(
  playedCards: PlayedCard[],
  trumpSuit: Suit | null,
  roleOf: RoleOf,
): { priest: string; card: Card }[] {
  return playedCards.flatMap((played, index) =>
    powerOn(playedCards, index, "priest", trumpSuit, roleOf)
      ? [{ priest: playerOf(played), card: played.card }]
      : []);
}

// The royal cards that owe this Priest faith, and who played them: whoever
// played the card pays, whoever holds it after a swap.
export function royalsFor(playedCards: PlayedCard[], priest: string): { player: string; card: Card }[] {
  return playedCards.flatMap((played) =>
    isRoyal(played.card) && playerOf(played) !== priest
      ? [{ player: playerOf(played), card: played.card }]
      : []);
}

// The poor cards: the 1 to 7 of any suit; Jesters are not cards of a suit.
export const isPoor = (card: Card): boolean => card.value >= 1 && card.value <= 7;

// The Priest's drawback: when their own 8 wins the trick, they feed the
// poor, every card under 8 in it, in any suit. Whoever played the card is
// fed, whoever holds it after a swap. Empty when the 8 did not win, or a
// Thief, a Servant or a Fisher won with it.
export function poorFor(playedCards: PlayedCard[], priest: string, winner: string): { player: string; card: Card }[] {
  const won = playedCards.find((played) => played.username === winner);

  if (!won || won.card.value !== 8 || playerOf(won) !== priest || winner !== priest) {
    return [];
  }

  return playedCards.flatMap((played) =>
    isPoor(played.card) && playerOf(played) !== priest
      ? [{ player: playerOf(played), card: played.card }]
      : []);
}
