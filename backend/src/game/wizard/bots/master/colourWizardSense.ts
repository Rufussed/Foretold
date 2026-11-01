import type { WizardGameState } from "../../models/wizardGame.js";
import { isColourWizard, isOwnWizardCard } from "../../modes/roles/master/colourWizards.js";
import { roleOfBot, type Play } from "../roleSense.js";

// A colour Wizard (modes/roles/colourWizards.ts) wanting a trick takes one
// with the Wizard of their colour when that wins: the trick brings its bonus
// on top. Null otherwise.
export function colourWizardWin(game: WizardGameState, winners: Play[], wantsTricks: boolean): Play | null {
  const role = roleOfBot(game);
  if (!isColourWizard(role) || !wantsTricks) return null;
  return winners.find(({ card }) => isOwnWizardCard(role, card)) ?? null;
}
