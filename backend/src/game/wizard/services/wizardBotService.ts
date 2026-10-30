import { isBotName } from "../models/bot.js";
import type { Suit } from "../models/card.js";
import type { WizardGameState } from "../models/wizardGame.js";
import { avoidForbiddenPrediction, forbiddenPrediction } from "../gameplayRules.js";
import { strategyFor } from "../bots/index.js";
import { currentPlayer } from "../bots/personality.js";
import type { PowerChoice, ThiefSwap } from "../bots/powers.js";
import { WizardGameService } from "./wizardGameService.js";

// Makes the moves of whoever's turn it is, as their bot personality would
// (see bots/). The game runner calls it for bots, and for a human whose time
// ran out.
export class WizardBotService {
  constructor(private readonly gameService: WizardGameService) {}

  // Bot usernames use a suffix so the game runner can distinguish automated
  // players from human players without adding another player-state field.
  isBot(username: string): boolean {
    return isBotName(username);
  }

  chooseTrumpSuit(game: WizardGameState): Suit {
    return strategyFor(currentPlayer(game)).chooseTrumpSuit(game);
  }

  // The personality's estimate, capped at the round's tricks (the most anyone
  // can bid) and, as last predictor, stepped off a number the rules forbid.
  choosePrediction(game: WizardGameState): number {
    const estimate = strategyFor(currentPlayer(game)).estimatePrediction(game);
    const choice = Math.min(estimate, game.currentRound);

    return avoidForbiddenPrediction(
      choice,
      forbiddenPrediction(game.players, game.currentRound),
      game.currentRound,
    );
  }

  chooseCardIndex(game: WizardGameState): number {
    return strategyFor(currentPlayer(game)).chooseCardIndex(game);
  }

  // What the bot does with a Thief it has just won with: a swap decided by its
  // level's own reasoning, or null to leave it unused.
  chooseThiefSwap(game: WizardGameState): ThiefSwap | null {
    return strategyFor(currentPlayer(game)).chooseThief(game);
  }

  chooseCardPower(game: WizardGameState): PowerChoice {
    return strategyFor(currentPlayer(game)).choosePower(game);
  }
}
