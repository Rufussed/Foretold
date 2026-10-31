import type { Card, Suit } from "../../models/card.js";
import type { PlayedCard } from "../../models/wizardGame.js";
import { playerOf, powerOn, rolePowerOn, type RoleOf } from "./rolePlay.js";
import { roleCard } from "./roles.js";

// What every power used in a trick the King's 13 won pays him.
export const TAX_POINTS = 10;

// The King's power has two faces.
// - The King's peace: the moment he plays his 13 as a trump, no other basic
//   role's power works in the trick (kingsPeace in rolePlay.ts). What
//   already happened in it is undone: a Thief's steal and a Servant's
//   service swap back and pay back, a Smith's armour comes back or goes
//   again. Nothing happens at the end of the trick. The colour Wizards go on
//   as ever.
// - The King's tax: when his own 13, played with its power on but not as a
//   trump, wins the trick, every other card in it showing its role's seal
//   pays him TAX_POINTS, never more than its player has. Nothing is undone.
//   The Priest pays no tax: the Priest collects from the King. A Smith in
//   armour blocks it, and the King pays them for the block.

// Whether the card at this place is a King's trump 13: the King's peace.
export const bringsPeace = (playedCards: PlayedCard[], index: number, trumpSuit: Suit | null, roleOf: RoleOf): boolean => {
  const played = playedCards[index];
  return !!played
    && trumpSuit !== null
    && played.card.suit === trumpSuit
    && played.card.value === roleCard("king")
    && roleOf(playerOf(played)) === "king";
};

// The players whose cards before this place had their role's power on, in
// order: whom the King's peace at this place stops.
export function stoppedBy(playedCards: PlayedCard[], index: number, trumpSuit: Suit | null, roleOf: RoleOf): string[] {
  const before = playedCards.slice(0, index);
  return before.flatMap((played, at) => (rolePowerOn(before, at, trumpSuit, roleOf) ? [playerOf(played)] : []));
}

// The tax on a complete trick won by a King with his own 13, not a trump:
// the King, his 13 and every card that pays, with its player. Null when
// there is none.
export function taxIn(
  playedCards: PlayedCard[],
  trumpSuit: Suit | null,
  roleOf: RoleOf,
  winner: string,
): { king: string; card: Card; payers: { player: string; card: Card }[] } | null {
  const index = playedCards.findIndex((played) => played.username === winner);
  const thirteen = playedCards[index];

  if (
    !thirteen
    || playerOf(thirteen) !== winner
    || thirteen.card.suit === trumpSuit
    || !powerOn(playedCards, index, "king", trumpSuit, roleOf)
  ) {
    return null;
  }

  const payers = playedCards.flatMap((played, at) =>
    at !== index && roleOf(playerOf(played)) !== "priest" && rolePowerOn(playedCards, at, trumpSuit, roleOf)
      ? [{ player: playerOf(played), card: played.card }]
      : []);

  return { king: winner, card: thirteen.card, payers };
}
