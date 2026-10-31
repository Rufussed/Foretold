import type { Card, Suit } from "../../models/card.js";
import type { PlayedCard } from "../../models/wizardGame.js";
import { playerOf, powerOn, type RoleOf } from "./rolePlay.js";

// What a Gambler's bet brings when their 10 wins the trick, and what it costs
// them when it loses: lost to the house, not paid to any player, in full,
// even below 0.
export const BET_WIN_POINTS = 20;
export const BET_LOSS_POINTS = 10;

// The Gambler's power, a choice: playing their 10 with its power on (in the
// lead suit, as a trump, or in any suit after a Wizard lead), they may bet
// that it wins the trick, like a blackjack player. The bet is made as the
// card is played and is settled at the end of the trick. A Thief, a Servant
// or a Fisher who took the 10 and won with it leaves the Gambler's bet lost.

// Whether the card at this place may carry a bet: a Gambler's 10 with its
// power on.
export const canBet = (
  playedCards: PlayedCard[],
  index: number,
  trumpSuit: Suit | null,
  roleOf: RoleOf,
): boolean => powerOn(playedCards, index, "gambler", trumpSuit, roleOf);

// The bets in a complete trick and how each went.
export function betsIn(
  playedCards: PlayedCard[],
  trumpSuit: Suit | null,
  roleOf: RoleOf,
  winner: string,
): { gambler: string; card: Card; won: boolean }[] {
  return playedCards.flatMap((played, index) => {
    if (!played.bet || !canBet(playedCards, index, trumpSuit, roleOf)) {
      return [];
    }

    const gambler = playerOf(played);
    return [{ gambler, card: played.card, won: played.username === gambler && winner === gambler }];
  });
}
