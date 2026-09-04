import { isJester } from "../models/card.js";
import type { Card } from "../models/card.js";
import type { WizardGameState } from "../models/wizardGame.js";
import { WizardRules } from "./wizardRules.js";
import { WizardGameService } from "./wizardGameService.js";

export class WizardBotService {
  private readonly rules = new WizardRules();

  constructor(private readonly gameService: WizardGameService) {}

  isBot(username: string): boolean {
    return username.startsWith("bot-");
  }

  choosePrediction(game: WizardGameState): number {
    const player = game.players[game.currentPlayerIndex];

    if (!player) {
      throw new Error("Bot player does not exist");
    }

    const prediction = player.hand.filter((card) => {
      return card.value === 14 || card.value >= 12;
    }).length;

    return Math.min(prediction, game.currentRound);
  }

  chooseCardIndex(game: WizardGameState): number {
    const player = game.players[game.currentPlayerIndex];

    if (!player) {
      throw new Error("Bot player does not exist");
    }

    const leadSuit =
      game.currentTrick.playedCards.find(
        ({ card }) => !isJester(card),
      )?.card.suit ?? null;

    const playableIndex = player.hand.findIndex((card: Card) =>
      this.rules.isValidCardPlay(card, player.hand, leadSuit),
    );

    if (playableIndex === -1) {
      throw new Error("Bot has no legal card to play");
    }

    return playableIndex;
  }
}