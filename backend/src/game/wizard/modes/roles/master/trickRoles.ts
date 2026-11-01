import type { WizardGameOptions } from "../../../gameOptions.js";
import type { TrickRoles } from "../../../services/wizardRules.js";
import { GREEN_BOOST, isGreenCard } from "./greenWizard.js";
import type { RoleOf } from "../rolePlay.js";
import type { RoleId } from "../roles.js";

// What the roles change in a trick's rules, for wizardRules: a Green Wizard's
// green cards count higher (greenWizard.ts), a Yellow Wizard can make yellow
// the lead suit, and a Red Wizard's red card on a red lead takes the trumps
// out of the trick (colourWizards.ts). The Green Wizard's boost goes with the
// card's owner of the moment; the Yellow and Red Wizards' powers with whoever
// played the card.
export function trickRolesOf(roleOf: RoleOf): TrickRoles {
  return {
    boostOf: ({ username, card }) => (roleOf(username) === "greenWizard" && isGreenCard(card) ? GREEN_BOOST : 0),
    isYellowWizard: ({ username, playedBy }) => roleOf(playedBy ?? username) === "yellowWizard",
    isRedWizard: ({ username, playedBy }) => roleOf(playedBy ?? username) === "redWizard",
  };
}

// The same for a game, server-side or as a player sees it; none outside a
// Roles game.
export function trickRolesIn(game: {
  options?: Partial<WizardGameOptions> | null;
  players: readonly { username: string; role?: RoleId | null }[];
}): TrickRoles | undefined {
  if (game.options?.mode !== "roles") return undefined;
  const roles = new Map(game.players.map((player) => [player.username, player.role ?? undefined]));
  return trickRolesOf((username) => roles.get(username));
}
