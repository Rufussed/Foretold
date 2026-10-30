import type { Card, Suit } from "../../models/card.js";
import type { PlayedCard } from "../../models/wizardGame.js";
import { WizardRules } from "../../services/wizardRules.js";
import { canBeTaken, playerOf, powerOn, type RoleOf } from "./rolePlay.js";

const rules = new WizardRules();

// What every trade at a Merchant's market is worth, either way.
export const MARKET_POINTS = 5;

// The Merchant's power, a must: a Merchant's 7 played in the lead suit or as
// a trump opens a market at the end of the trick, whoever wins it. Returns
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

// The market, once every swap is done: the card the Merchant holds now is
// compared with every other card in the trick. A card it beats sells, so its
// player pays the Merchant; a card that beats it buys, so the Merchant pays.
// A Thief, a Servant or a Fisher who took the 7 leaves the Merchant a weaker
// card to trade with. Wizards and Jesters do not trade. `sells` is true when
// the other player pays the Merchant.
export function trades(
  playedCards: PlayedCard[],
  merchant: string,
  trumpSuit: Suit | null,
): { player: string; card: Card; sells: boolean }[] {
  const own = playedCards.find((played) => played.username === merchant);

  if (!own) {
    return [];
  }

  const leadSuit = rules.getLeadSuit(playedCards);

  return playedCards.flatMap((played) => {
    if (played === own || !canBeTaken(played)) {
      return [];
    }

    const compared = rules.compareCards(own.card, played.card, trumpSuit, leadSuit);

    return compared ? [{ player: played.username, card: played.card, sells: compared > 0 }] : [];
  });
}
