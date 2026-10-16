import type { Card, Suit } from "../models/card.js";
import { SUITS } from "../models/card.js";
import type { WizardGameState } from "../models/wizardGame.js";
import { WizardRules } from "../services/wizardRules.js";
import { type BotStrategy, currentPlayer, isBlind } from "./personality.js";

const rules = new WizardRules();

// Choose the suit with the strongest overall hand: suit length is the primary
// factor, and the sum of card values breaks ties. Wizards and Jesters are
// excluded because they do not provide ordinary suit strength. Played blind,
// the bot can't see its own card to choose by, so it picks at random.
export function chooseLongestSuit(game: WizardGameState): Suit {
  const player = currentPlayer(game);

  if (isBlind(game)) {
    return SUITS[Math.floor(Math.random() * SUITS.length)] as Suit;
  }

  let bestSuit: Suit = "Blue";
  let bestCount = -1;
  let bestValue = -1;

  for (const suit of SUITS) {
    const suitedCards = player.hand.filter(
      (card) => card.suit === suit && card.value > 0 && card.value < 14,
    );

    const count = suitedCards.length;
    const value = suitedCards.reduce((total, card) => total + card.value, 0);

    if (count > bestCount || (count === bestCount && value > bestValue)) {
      bestSuit = suit;
      bestCount = count;
      bestValue = value;
    }
  }

  return bestSuit;
}

// A blind round's one card is unseen, so the bot bids on the cards it can see:
// if anyone else holds a Wizard or a high card, it expects to lose.
export function blindPrediction(game: WizardGameState): number {
  const { username } = currentPlayer(game);
  const othersStrong = game.players.some(
    (other) =>
      other.username !== username &&
      other.hand.some((card) => card.value >= 12),
  );

  return othersStrong ? 0 : 1;
}

// The first bot: it bids one trick per Wizard, 12 or 13 in hand, then plays
// the first legal card it holds, with no plan for reaching its bid. Hands are
// in the order they were dealt, so in practice that is a random legal card.
export const apprentice: BotStrategy = {
  chooseTrumpSuit: chooseLongestSuit,

  estimatePrediction(game) {
    if (isBlind(game)) {
      return blindPrediction(game);
    }

    return currentPlayer(game).hand.filter((card) => card.value >= 12).length;
  },

  chooseCardIndex(game) {
    const player = currentPlayer(game);
    const leadSuit = rules.getLeadSuit(game.currentTrick.playedCards);
    const playableIndex = player.hand.findIndex((card: Card) =>
      rules.isValidCardPlay(card, player.hand, leadSuit),
    );

    if (playableIndex === -1) {
      throw new Error("Bot has no legal card to play");
    }

    return playableIndex;
  },
};
