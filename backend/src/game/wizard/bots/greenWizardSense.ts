import type { Card } from "../models/card.js";
import type { WizardGameState } from "../models/wizardGame.js";
import { GREEN_BOOST, isGreenWizardCard } from "../modes/roles/greenWizard.js";
import { strength } from "./handStrength.js";
import { roleOfBot } from "./roleSense.js";

// How the Adept plays the Green Wizard (modes/roles/greenWizard.ts): its
// green cards count 3 higher, so it ranks them that way when it picks its
// strongest card to win a trick or its weakest to give one away. Who wins a
// trick already counts the boost (determineTrickWinner). It bids as any
// Adept: raising its bids for green cards was tried in the sim and only
// cost it predictions.

const isBoosted = (game: WizardGameState, card: Card): boolean =>
  roleOfBot(game) === "greenWizard" && card.suit === "Green" && card.value !== 0 && card.value !== 14;

// A card's strength to hold, with the boost.
export const greenStrength = (game: WizardGameState, card: Card): number =>
  strength(card, game.trumpSuit) + (isBoosted(game, card) ? GREEN_BOOST : 0);

type Play = { card: Card; index: number };

// Wanting a trick, it takes one with the green Wizard when that wins: the
// trick brings its bonus (GREEN_WIZARD_BONUS) on top. Null otherwise.
export function greenWizardWin(game: WizardGameState, winners: Play[], wantsTricks: boolean): Play | null {
  if (roleOfBot(game) !== "greenWizard" || !wantsTricks) return null;
  return winners.find(({ card }) => isGreenWizardCard(card)) ?? null;
}
