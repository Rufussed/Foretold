import type { Suit } from "../models/card.js";
import type { WizardGameState } from "../models/wizardGame.js";
import { isBlindRound, normalizeGameOptions } from "../gameOptions.js";
import type { PowerChoice, ThiefSwap } from "./powers.js";

// The decisions a bot makes, each for the player whose turn it is.
export interface BotStrategy {
  chooseTrumpSuit(game: WizardGameState): Suit;
  // How many tricks it will take; the caller keeps it off a forbidden number.
  estimatePrediction(game: WizardGameState): number;
  // An index into the current player's hand, of a card it may legally play.
  chooseCardIndex(game: WizardGameState): number;
  // What to do with the Seer or Trickster it has just won a trick with.
  choosePower(game: WizardGameState): PowerChoice;
  // What to do with a Thief it has just won a trick with: a swap, or null to
  // leave it unused.
  chooseThief(game: WizardGameState): ThiefSwap | null;
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
