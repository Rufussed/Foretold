import type { Card } from "../../models/card.js";
import { isJester, isWizard } from "../../models/card.js";
import type { GamePlayer, TrickState } from "../../models/wizardGame.js";
import type { WizardGameOptions } from "../../gameOptions.js";
import type { CardBoost } from "../../services/wizardRules.js";
import type { RoleId } from "./roles.js";

// The Green Wizard: a role with no card. Every green card they hold counts 3
// higher against other green cards: a 7 is a 10, a 12 a 15, beating even a
// 13. A boosted card that only draws level loses: a Green Wizard's 7 loses to
// a 10. Trumps and Wizards beat green as ever, and the boost belongs to the
// card's owner of the moment, so a green card a Thief takes loses it.

export const GREEN_BOOST = 3;

// Winning a trick with the green Wizard (the Wizard of the Green suit) brings
// the Green Wizard these points, on top of the trick.
export const GREEN_WIZARD_BONUS = 10;

const isGreenCard = (card: Card): boolean => card.suit === "Green" && !isWizard(card) && !isJester(card);

export const isGreenWizardCard = (card: Card): boolean => isWizard(card) && card.suit === "Green";

// The boost for a game's trick, from whoever is a Green Wizard; none outside
// a Roles game. Works on the server's game and on the state a player sees.
export function greenBoostIn(game: {
  options?: Partial<WizardGameOptions> | null;
  players: readonly { username: string; role?: RoleId | null }[];
}): CardBoost | undefined {
  if (game.options?.mode !== "roles") return undefined;
  const green = new Set(game.players.filter((player) => player.role === "greenWizard").map((player) => player.username));
  if (green.size === 0) return undefined;
  return ({ username, card }) => (green.has(username) && isGreenCard(card) ? GREEN_BOOST : 0);
}

// The bonus the trick's winner earns: a Green Wizard who won it with the
// green Wizard.
export function greenWizardBonus(trick: TrickState, winner: GamePlayer): number {
  if (winner.role !== "greenWizard") return 0;
  const winning = trick.playedCards.find((played) => played.username === winner.username);
  return winning && isGreenWizardCard(winning.card) ? GREEN_WIZARD_BONUS : 0;
}
