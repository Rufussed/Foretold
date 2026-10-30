import type { Card } from "../models/card.js";
import type { WizardGameState } from "../models/wizardGame.js";
import { GREEN_BOOST, isGreenCard } from "../modes/roles/greenWizard.js";
import { strength } from "./handStrength.js";
import { roleOfBot } from "./roleSense.js";

// How the Adept plays the Green Wizard (modes/roles/greenWizard.ts): its
// green cards count 3 higher, so it ranks them that way when it picks its
// strongest card to win a trick or its weakest to give one away. Who wins a
// trick already counts the boost (determineTrickWinner). It bids as any
// Adept: raising its bids for green cards was tried in the sim and only
// cost it predictions.

const isBoosted = (game: WizardGameState, card: Card): boolean =>
  roleOfBot(game) === "greenWizard" && isGreenCard(card);

// A card's strength to hold, with the boost.
export const greenStrength = (game: WizardGameState, card: Card): number =>
  strength(card, game.trumpSuit) + (isBoosted(game, card) ? GREEN_BOOST : 0);
