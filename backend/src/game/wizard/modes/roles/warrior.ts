import type { Card, Suit } from "../../models/card.js";
import type { PlayedCard } from "../../models/wizardGame.js";
import { playerOf, powerOn, type RoleOf } from "./rolePlay.js";

// What every other player pays the Warrior whose 9 wins the trick.
export const VICTORY_POINTS = 10;

// What the Warrior pays every other player, out of pride, when their trump 9
// loses the trick.
export const PRIDE_POINTS = 5;

// The Warrior's power, a must: a Warrior's 9 played in the lead suit or as a
// trump. When it wins the trick, everyone else pays the Warrior; when it was a
// trump and loses, the Warrior pays everyone else. A 9 in the lead suit that
// loses costs nothing. A Thief, a Servant or a Fisher who took the 9 and won
// with it leaves the Warrior beaten. Returns each Warrior's 9 with its power
// on, and how its battle went.
export function battlesIn(
  playedCards: PlayedCard[],
  trumpSuit: Suit | null,
  roleOf: RoleOf,
  winner: string,
): { warrior: string; card: Card; won: boolean; proud: boolean }[] {
  return playedCards.flatMap((played, index) => {
    if (!powerOn(playedCards, index, "warrior", trumpSuit, roleOf)) {
      return [];
    }

    const warrior = playerOf(played);
    const won = played.username === warrior && winner === warrior;
    const proud = !won && played.card.suit === trumpSuit;

    return won || proud ? [{ warrior, card: played.card, won, proud }] : [];
  });
}
