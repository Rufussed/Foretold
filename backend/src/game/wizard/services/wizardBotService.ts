import { isJester } from "../models/card.js";
import { isBotName } from "../models/bot.js";
import type { Card, Suit } from "../models/card.js";
import type { WizardGameState } from "../models/wizardGame.js";
import { WizardRules } from "./wizardRules.js";
import { avoidForbiddenPrediction, forbiddenPrediction } from "../gameplayRules.js";
import { WizardGameService } from "./wizardGameService.js";

export class WizardBotService {
  private readonly rules = new WizardRules();

  constructor(private readonly gameService: WizardGameService) {}

  // Bot usernames use a prefix so the game runner can distinguish automated
  // players from human players without adding another player-state field.
  isBot(username: string): boolean {
    return isBotName(username);
  }

  // Choose the suit with the strongest overall hand: suit length is the
  // primary factor, and the sum of card values breaks ties. Wizards and
  // Jesters are excluded because they do not provide ordinary suit strength.
  chooseTrumpSuit(game: WizardGameState): Suit {
    const player = game.players[game.currentPlayerIndex];

    if (!player) {
      throw new Error("Bot player does not exist");
    }

    const suits: Suit[] = ["Blue", "Red", "Yellow", "Green"];

    let bestSuit: Suit = "Blue";
    let bestCount = -1;
    let bestValue = -1;

    for (const suit of suits) {
      const suitedCards = player.hand.filter(
        (card) => card.suit === suit && card.value > 0 && card.value < 14,
      );

      const count = suitedCards.length;
      const value = suitedCards.reduce(
        (total, card) => total + card.value,
        0,
      );

      if (count > bestCount || (count === bestCount && value > bestValue)) {
        bestSuit = suit;
        bestCount = count;
        bestValue = value;
      }
    }

    return bestSuit;
  }

  // Estimate the bid from high cards. The round number is also the maximum
  // legal prediction, so the cap keeps the bot inside the game contract.
  choosePrediction(game: WizardGameState): number {
    const player = game.players[game.currentPlayerIndex];

    if (!player) {
      throw new Error("Bot player does not exist");
    }

    const prediction = player.hand.filter((card) => {
      return card.value === 14 || card.value >= 12;
    }).length;

    // As last predictor, step off a number the rules forbid.
    const choice = Math.min(prediction, game.currentRound);
    return avoidForbiddenPrediction(
      choice,
      forbiddenPrediction(game.players, game.currentRound),
      game.currentRound,
    );
  }

  // Return the first legal card. This is intentionally a simple strategy:
  // WizardRules remains the single source of truth for following-suit rules.
  chooseCardIndex(game: WizardGameState): number {
    const player = game.players[game.currentPlayerIndex];

    if (!player) {
      throw new Error("Bot player does not exist");
    }


    //Handles if Wizard is play first, there is no Suit
    const leadSuit = this.rules.getLeadSuit(
      game.currentTrick.playedCards,
    );

    // const leadSuit =
    //   game.currentTrick.playedCards.find(
    //     ({ card }) => !isJester(card),
    //   )?.card.suit ?? null;

    const playableIndex = player.hand.findIndex((card: Card) =>
      this.rules.isValidCardPlay(card, player.hand, leadSuit),
    );

    if (playableIndex === -1) {
      throw new Error("Bot has no legal card to play");
    }

    return playableIndex;
  }
}