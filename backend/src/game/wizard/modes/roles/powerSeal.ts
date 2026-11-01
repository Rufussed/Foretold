import { isWizard, type Suit } from "../../models/card.js";
import type { PlayedCard, WizardGameState } from "../../models/wizardGame.js";
import { WizardRules } from "../../services/wizardRules.js";
import { isColourWizard, isOwnWizardCard } from "./master/colourWizards.js";
import { isGreenCard } from "./master/greenWizard.js";
import { trickRolesOf } from "./master/trickRoles.js";
import { playerOf, rolePowerOn, type RoleOf } from "./rolePlay.js";
import type { RoleId } from "./roles.js";

// Roles mode only. Which role's power shows on a card in the trick: the one
// the table marks with that role's seal (src/modes/roles/role-seals.ts), and
// the one counted as a use of the power for the Profile's seals
// (roleProgress.ts). Kept in one place so the two always agree.

const rules = new WizardRules();

// The role whose power is on the card at this place in the trick, if any.
// winner: who won the trick, once known; a colour Wizard's own Wizard shows
// only when it won.
export function powerSealAt(
  playedCards: PlayedCard[],
  index: number,
  trumpSuit: Suit | null,
  roleOf: RoleOf,
  winner: string | null,
): RoleId | null {
  const played = playedCards[index];
  const role = played && roleOf(playerOf(played));
  if (!played || !role) return null;
  // A Joker's card played though holding the suit led.
  if (role === "joker") return played.freePlay ? role : null;

  if (!isColourWizard(role)) {
    return rolePowerOn(playedCards, index, trumpSuit, roleOf) ? role : null;
  }

  const roles = trickRolesOf(roleOf);
  const before = playedCards.slice(0, index);
  const upTo = playedCards.slice(0, index + 1);
  const won = winner === played.username && isWizard(played.card);
  if (won && isOwnWizardCard(role, played.card)) return role;
  if (role === "greenWizard") return isGreenCard(played.card) ? role : null;
  if (role === "yellowWizard") {
    const turned = rules.getLeadSuit(before, trumpSuit, roles) !== "Yellow" && rules.getLeadSuit(upTo, trumpSuit, roles) === "Yellow";
    return before.length > 0 && turned ? role : null;
  }
  if (role === "redWizard") {
    return !rules.redShield(before, trumpSuit, roles) && rules.redShield(upTo, trumpSuit, roles) ? role : null;
  }
  return null;
}

// At the end of a trick: one use of the power for every card showing its
// player's own role's seal.
export function countPowerUses(game: WizardGameState, winner: string, roleOf: RoleOf): void {
  const playedCards = game.currentTrick.playedCards;
  playedCards.forEach((played, index) => {
    const player = game.players.find((entry) => entry.username === playerOf(played));
    const role = powerSealAt(playedCards, index, game.trumpSuit, roleOf, winner);
    if (player && role && role === player.role) {
      player.powerUses = (player.powerUses ?? 0) + 1;
    }
  });
}
