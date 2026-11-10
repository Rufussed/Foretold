import type { WizardGameOptions } from "../../../gameOptions.js";
import type { TrickPlay, TrickRoles } from "../../../services/wizardRules.js";
import { GREEN_BOOST, isGreenCard } from "./greenWizard.js";
import { masterOfIn, type RoleOf } from "../rolePlay.js";
import { masterRoleOf, roleCard, type RoleId } from "../roles.js";
import { sheepBoost, sheepOut, type Sheep } from "../shepherd.js";

// What the roles change in a trick's rules, for wizardRules: a Green Wizard's
// green cards count higher (greenWizard.ts), a Yellow Wizard can make yellow
// the lead suit, and a Red Wizard's red card on a red lead takes the trumps
// out of the trick (colourWizards.ts). A King's trump 13 stops them all
// (wizardRules.scanTrick). The Green Wizard's boost goes with the
// card's owner of the moment; the Yellow and Red Wizards' powers with whoever
// played the card. A Shepherd's own 5 counts higher for their sheep out
// (shepherd.ts sheepBoost); flockOf says how many those are.
export function trickRolesOf(roleOf: RoleOf, flockOf: (shepherd: string) => number = () => 0): TrickRoles {
  const masterOf = masterOfIn(roleOf);
  const green = (username: string, card: TrickPlay["card"]) =>
    masterOf(username) === "greenWizard" && isGreenCard(card) ? GREEN_BOOST : 0;
  const shepherd = ({ username, playedBy, card }: TrickPlay) =>
    card.value === roleCard("shepherd") && (playedBy ?? username) === username && roleOf(username) === "shepherd"
      ? sheepBoost(flockOf(username))
      : 0;
  return {
    boostOf: (play) => green(play.username, play.card) + shepherd(play),
    isYellowWizard: ({ username, playedBy }) => masterOf(playedBy ?? username) === "yellowWizard",
    isRedWizard: ({ username, playedBy }) => masterOf(playedBy ?? username) === "redWizard",
    // The King's role is the basic one: his trump 13 brings the King's peace.
    isKing: ({ username, playedBy }) => roleOf(playedBy ?? username) === "king",
  };
}

// The same for a game, server-side or as a player sees it; none outside a
// Roles game.
export function trickRolesIn(game: {
  options?: Partial<WizardGameOptions> | null;
  players: readonly { username: string; role?: RoleId | null; masterRole?: RoleId | null; sheep?: Sheep }[];
}): TrickRoles | undefined {
  if (game.options?.mode !== "roles") return undefined;
  const masters = new Map(game.players.map((player) => [player.username, masterRoleOf(player)]));
  const basics = new Map(game.players.map((player) => [player.username, player.role ?? undefined]));
  return trickRolesOf(Object.assign((username: string) => basics.get(username), {
    masterOf: (username: string) => masters.get(username),
  }), (shepherd) => sheepOut(game.players, shepherd));
}
