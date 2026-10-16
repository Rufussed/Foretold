import type { Suit } from "../models/card.js";
import type { WizardGameState } from "../models/wizardGame.js";
import { isBlindRound, normalizeGameOptions } from "../gameOptions.js";

// The three decisions a bot makes, each for the player whose turn it is.
export interface BotStrategy {
  chooseTrumpSuit(game: WizardGameState): Suit;
  // How many tricks it will take; the caller keeps it off a forbidden number.
  estimatePrediction(game: WizardGameState): number;
  // An index into the current player's hand, of a card it may legally play.
  chooseCardIndex(game: WizardGameState): number;
}

export function currentPlayer(game: WizardGameState) {
  const player = game.players[game.currentPlayerIndex];

  if (!player) {
    throw new Error("Bot player does not exist");
  }

  return player;
}

export const isBlind = (game: WizardGameState): boolean =>
  isBlindRound(normalizeGameOptions(game.options), game.currentRound);
