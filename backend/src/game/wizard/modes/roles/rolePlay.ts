import { isJester, isWizard, type Suit } from "../../models/card.js";
import type { PlayedCard } from "../../models/wizardGame.js";
import { WizardRules } from "../../services/wizardRules.js";
import { roleCard, type RoleId } from "./roles.js";

const rules = new WizardRules();

// Who holds which role in the game, by username.
export type RoleOf = (username: string) => RoleId | undefined;

// Who first played a card, whoever owns it after a swap. Games saved before
// this was kept read the owner.
export const playerOf = (played: PlayedCard): string => played.playedBy ?? played.username;

// Whether the card at this place in the trick has its role's power on: the
// role's card, played by a player of that role, in the lead suit or as a
// trump.
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

  const leadSuit = rules.getLeadSuit(playedCards.slice(0, index + 1));

  return played.card.suit === leadSuit || played.card.suit === trumpSuit;
}

// No role's power ever touches a Wizard or a Jester.
export const canBeTaken = (played: PlayedCard): boolean =>
  !isWizard(played.card) && !isJester(played.card);

// The owners of the last two cards in the trick change places, like a swap
// in C. The cards keep their places; only who they count for changes.
export function swapLastTwo(playedCards: PlayedCard[]): void {
  const last = playedCards.at(-1);
  const before = playedCards.at(-2);

  if (!last || !before) {
    return;
  }

  [last.username, before.username] = [before.username, last.username];
}
