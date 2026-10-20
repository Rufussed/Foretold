import type { WizardGameState } from "../models/wizardGame.js";
import { currentPlayer } from "./personality.js";

// What a bot does with a Seer or a Trickster it has just won with: the new
// prediction, and whose it is (null for the Seer, the bot's own).
export interface PowerChoice {
  target: string | null;
  prediction: number;
}

// The Apprentice's Seer: nudge its own prediction one step towards what can
// still come true, and leave it alone while it can. It never works out odds; the
// Adept's reasoning is in powerReasoning.ts.
export function seerChoice(game: WizardGameState): PowerChoice {
  const player = currentPlayer(game);
  const prediction = player.prediction ?? 0;
  const tricksLeft = player.hand.length;

  let choice = prediction;
  if (prediction < player.tricksWon) choice = prediction + 1;
  else if (prediction > player.tricksWon + tricksLeft) choice = prediction - 1;

  return { target: null, prediction: Math.max(0, Math.min(game.currentRound, choice)) };
}
