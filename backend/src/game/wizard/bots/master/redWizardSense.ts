import type { WizardGameState } from "../../models/wizardGame.js";
import { masterOfBot, type Play } from "../roleSense.js";

// How the Adept plays the Red Wizard: a red card of theirs on a red lead
// takes the trumps out of the trick (wizardRules.redShield), so a high red
// they lead can only be beaten by a higher red or a Wizard.

// A red card from this high up is a strong lead under the shield.
const STRONG_RED = 12;

// Leading, wanting a trick: its highest red, when that is a strong one, and
// red is not trumps (it would lead a trump anyway). Null to lead as usual.
export function redLead(game: WizardGameState, legal: Play[], wantsTricks: boolean): Play | null {
  if (masterOfBot(game) !== "redWizard" || !wantsTricks || game.currentTrick.playedCards.length > 0) return null;
  if (game.trumpSuit === "Red") return null;
  const reds = legal.filter(({ card }) => card.suit === "Red" && card.value !== 0 && card.value !== 14);
  const top = reds.sort((a, b) => b.card.value - a.card.value)[0];
  return top && top.card.value >= STRONG_RED ? top : null;
}
