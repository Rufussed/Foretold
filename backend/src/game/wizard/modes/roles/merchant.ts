import type { Card, Suit } from "../../models/card.js";
import type { PlayedCard } from "../../models/wizardGame.js";
import { canBeTaken, playerOf, powerOn, type RoleOf } from "./rolePlay.js";

// What every trade at a Merchant's market is worth, either way.
export const MARKET_POINTS = 5;

// The Merchant's power, a must: a Merchant's 7 played in the lead suit or as
// a trump opens a market at the end of the trick, whoever wins it. Once open
// it stays open: an Air turn after the 7 does not close it; only the King's
// peace does. Returns
// the Merchants whose market opens, with their 7.
export function marketsIn(
  playedCards: PlayedCard[],
  trumpSuit: Suit | null,
  roleOf: RoleOf,
): { merchant: string; card: Card }[] {
  return playedCards.flatMap((played, index) =>
    powerOn(playedCards, index, "merchant", trumpSuit, roleOf)
      ? [{ merchant: playerOf(played), card: played.card }]
      : []);
}

// The market at the end of the trick trades by number alone, whatever the
// suit, the lead or the trumps: the Merchant's 7 against every other card
// played in the trick. A card of 7 or lower sells, so its player pays the
// Merchant; a card above 7 buys, so the Merchant pays. It always trades at
// 7: a Thief, a Servant or a Fisher who takes the 7 changes who wins the
// trick, not the market. Whoever played a card trades for it, whoever holds
// it now. Wizards and Jesters do not trade, and no green boost counts.
// `sells` is true when the other player pays the Merchant.
export const MARKET_CARD = 7;

export function trades(
  playedCards: PlayedCard[],
  merchant: string,
): { player: string; card: Card; sells: boolean }[] {
  return playedCards.flatMap((played) =>
    playerOf(played) === merchant || !canBeTaken(played)
      ? []
      : [{ player: playerOf(played), card: played.card, sells: played.card.value <= MARKET_CARD }]);
}
