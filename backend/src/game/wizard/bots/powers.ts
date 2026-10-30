import type { WizardGameState } from "../models/wizardGame.js";
import { currentPlayer } from "./personality.js";
import { strength } from "./handStrength.js";

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

// A bot's Thief: whose hand to rob, and which of its own cards to trade for one
// of theirs taken unseen. It gives away its weakest card, so on average the
// trade is not a loss; the card it takes is a blind pick.
export interface ThiefSwap {
  target: string;
  ownIndex: number;
  targetIndex: number;
}

export function thiefSwap(game: WizardGameState): ThiefSwap {
  const player = currentPlayer(game);
  const victims = game.players.filter((other) => other !== player && other.hand.length > 0);
  const victim = victims[Math.floor(Math.random() * victims.length)];
  if (!victim) throw new Error("There is nobody to steal from");

  let ownIndex = 0;
  player.hand.forEach((card, index) => {
    if (strength(card, game.trumpSuit) < strength(player.hand[ownIndex]!, game.trumpSuit)) ownIndex = index;
  });

  return { target: victim.username, ownIndex, targetIndex: Math.floor(Math.random() * victim.hand.length) };
}
