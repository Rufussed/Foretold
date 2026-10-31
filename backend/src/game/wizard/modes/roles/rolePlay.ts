import { isJester, isWizard, type Suit } from "../../models/card.js";
import type { PlayedCard } from "../../models/wizardGame.js";
import { WizardRules } from "../../services/wizardRules.js";
import { roleCard, type RoleId } from "./roles.js";
import { trickRolesOf } from "./master/trickRoles.js";

const rules = new WizardRules();

// Who holds which role in the game, by username.
export type RoleOf = (username: string) => RoleId | undefined;

// Who first played a card, whoever owns it after a swap. Games saved before
// this was kept read the owner.
export const playerOf = (played: PlayedCard): string => played.playedBy ?? played.username;

// Whether the card at this place in the trick has its role's power on: the
// role's card, played by a player of that role, in the lead suit or as a
// trump. A trick opened by a Wizard (after any Jesters) has no lead suit and
// anyone may play anything, so there the card works in any suit.
export function powerOn(
  playedCards: PlayedCard[],
  index: number,
  role: RoleId,
  trumpSuit: Suit | null,
  roleOf: RoleOf,
): boolean {
  const played = playedCards[index];

  if (!played || played.card.value !== roleCard(role) || roleOf(playerOf(played)) !== role) {
    return false;
  }

  const leadSuit = rules.getLeadSuit(playedCards.slice(0, index + 1), trumpSuit, trickRolesOf(roleOf));

  return leadSuit === null || played.card.suit === leadSuit || played.card.suit === trumpSuit;
}

// Whether the card at this place is a role's card played with its power on,
// whatever comes of it: the Farmer's 4 and the Shepherd's 5 in any suit, the
// other basic roles' cards in the lead suit or as a trump. The colour
// Wizards have no card. For the table to show the power the moment it is
// played.
export function rolePowerOn(
  playedCards: PlayedCard[],
  index: number,
  trumpSuit: Suit | null,
  roleOf: RoleOf,
): boolean {
  const played = playedCards[index];
  const role = played && roleOf(playerOf(played));

  if (!played || !role || played.card.value !== roleCard(role)) {
    return false;
  }

  return role === "farmer" || role === "shepherd" || powerOn(playedCards, index, role, trumpSuit, roleOf);
}

// No role's power ever touches a Wizard or a Jester.
export const canBeTaken = (played: PlayedCard): boolean =>
  !isWizard(played.card) && !isJester(played.card);

// The owners of two cards in the trick change places, like a swap in C. The
// cards keep their places; only who they count for changes.
export function swapOwners(a: PlayedCard, b: PlayedCard): void {
  [a.username, b.username] = [b.username, a.username];
}

// The same for the last two cards in the trick.
export function swapLastTwo(playedCards: PlayedCard[]): void {
  const last = playedCards.at(-1);
  const before = playedCards.at(-2);

  if (!last || !before) {
    return;
  }

  swapOwners(last, before);
}
