import type { Suit } from "../../models/card.js";
import type { GamePlayer, PlayedCard } from "../../models/wizardGame.js";
import { playerOf, powerOn, type RoleOf } from "./rolePlay.js";

// What the Duke's choice brings: keeping the trick, KEEP_POINTS; granting it,
// GRANT_POINTS paid to the player who receives it, in full, even below 0.
export const KEEP_POINTS = 10;
export const GRANT_POINTS = 5;

// How long a Duke has to choose before the trick is kept for them.
export const GRANT_TIMEOUT_MS = 15_000;

// The Duke's power, a choice: when their own 11, played with its power on (in
// the lead suit, as a trump, or in any suit after a Wizard lead), wins the
// trick, they keep it or grant it to any other player. Only the trick moves:
// the powers of the trick are settled as won by the Duke, and the Duke leads
// the next one. A Thief, a Servant or a Fisher who took the 11 and won with it
// has no choice to make.

// The Duke who won this complete trick with their own 11, if one did.
export function dukeWinning(
  playedCards: PlayedCard[],
  trumpSuit: Suit | null,
  roleOf: RoleOf,
  winner: string,
): PlayedCard | undefined {
  const index = playedCards.findIndex((played) => played.username === winner);
  const played = playedCards[index];

  return played && playerOf(played) === winner && powerOn(playedCards, index, "duke", trumpSuit, roleOf)
    ? played
    : undefined;
}

// A bot Duke's choice: who receives the trick, or null to keep it. Keep it
// when it is still wanted; otherwise grant it where it hurts most - to a
// player who has made their prediction exactly, the highest score first; else
// to one already over it; else to the player furthest behind.
export function botGrant(duke: GamePlayer, players: GamePlayer[]): string | null {
  if ((duke.prediction ?? 0) > duke.tricksWon) {
    return null;
  }

  const others = players.filter((player) => player.username !== duke.username);
  const byScore = (a: GamePlayer, b: GamePlayer) => b.score - a.score;
  const made = others.filter((player) => player.tricksWon === player.prediction).sort(byScore);
  const over = others.filter((player) => player.tricksWon > (player.prediction ?? 0)).sort(byScore);
  const behind = [...others].sort((a, b) => a.score - b.score);

  return (made[0] ?? over[0] ?? behind[0])?.username ?? null;
}
