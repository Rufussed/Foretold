import { isJester, isWizard, type Suit } from "../../models/card.js";
import type { PlayedCard } from "../../models/wizardGame.js";
import { WizardRules } from "../../services/wizardRules.js";
import { masterRoleOf, roleCard, type RoleId } from "./roles.js";
import { trickRolesOf } from "./master/trickRoles.js";

const rules = new WizardRules();

// Who holds which role in the game, by username: the role whose card powers
// work (the basic one). masterOf gives the master role, in a basic + master
// game; without it, the one role is asked for both (masterOfIn).
export type RoleOf = ((username: string) => RoleId | undefined) & {
  masterOf?: (username: string) => RoleId | undefined;
};

// Who holds which role among these players: the basic one, and the master
// one apart (roles.ts masterRoleOf). For the server and the table alike.
export const rolesOfPlayers = (
  players: readonly { username: string; role?: RoleId | null; masterRole?: RoleId | null }[],
): RoleOf => {
  const find = (username: string) => players.find((player) => player.username === username);
  return Object.assign((username: string) => find(username)?.role ?? undefined, {
    masterOf: (username: string) => {
      const player = find(username);
      return player ? masterRoleOf(player) : undefined;
    },
  });
};

// Who holds which master role, for the master powers.
export const masterOfIn = (roleOf: RoleOf): ((username: string) => RoleId | undefined) => roleOf.masterOf ?? roleOf;

// Who first played a card, whoever owns it after a swap. Games saved before
// this was kept read the owner.
export const playerOf = (played: PlayedCard): string => played.playedBy ?? played.username;

// Whether a King's trump 13 brought peace to the trick: it stops every other
// basic role's power in it, before and after the 13 (modes/roles/king.ts),
// and every master power from the 13 on - no switch of the lead, no shield,
// no green boost, no free play, no Wizard bonus (wizardRules.scanTrick).
// With a Red Wizard's shield already up there are no trumps, so no peace,
// unless fire is trumps.
export const kingsPeace = (playedCards: PlayedCard[], trumpSuit: Suit | null, roleOf: RoleOf): boolean =>
  rules.kingsPeaceAt(playedCards, trumpSuit, trickRolesOf(roleOf)) !== -1;

// A King's trump 13 that brings no peace: a Red Wizard's shield was already
// up, so the trick has no trumps (fire trumps aside, where the King wins
// over the shield). Its place in the trick, or -1.
export function kingHumbledAt(playedCards: PlayedCard[], trumpSuit: Suit | null, roleOf: RoleOf): number {
  if (trumpSuit === null || trumpSuit === "Red" || kingsPeace(playedCards, trumpSuit, roleOf)) return -1;
  return playedCards.findIndex((played) =>
    played.card.suit === trumpSuit && played.card.value === roleCard("king") && roleOf(playerOf(played)) === "king");
}

// The roles whose power needs their card to win the trick: once a Wizard is
// in it, before their card, it cannot, so the power is off - no bet, no
// lowering, no choice, no battle, and no pride paid for a trump 9.
export const WIZARD_BLOCKED_ROLES: readonly RoleId[] = ["warrior", "gambler", "duke", "prophet"];

// The roles whose power a Wizard anywhere in the trick stops, before or
// after their card: the Wizard wins it, and its winner takes no seed and no
// sheep, and the Smith's armour forged in it is taken back (rolePowers.ts).
export const WIZARD_STOPPED_ROLES: readonly RoleId[] = ["farmer", "shepherd", "smith"];

// Whether a Wizard was played before this place in the trick.
const wizardBefore = (playedCards: PlayedCard[], index: number): boolean =>
  playedCards.slice(0, index).some((played) => isWizard(played.card));

// Whether a Wizard is anywhere in the trick so far.
export const wizardIn = (playedCards: PlayedCard[]): boolean => playedCards.some((played) => isWizard(played.card));

// Whether the card at this place in the trick has its role's power on: the
// role's card, played by a player of that role, in the lead suit or as a
// trump (the Thief's 1 and the Servant's 2 in any suit). A trick opened by a Wizard (after any Jesters) has no lead suit and
// anyone may play anything, so there the card works in any suit - but not
// for the roles that must win the trick (WIZARD_BLOCKED_ROLES).
export function powerOn(
  playedCards: PlayedCard[],
  index: number,
  role: RoleId,
  trumpSuit: Suit | null,
  roleOf: RoleOf,
): boolean {
  return cardPowerOn(playedCards, index, role, trumpSuit, roleOf)
    && !(WIZARD_BLOCKED_ROLES.includes(role) && wizardBefore(playedCards, index))
    && !(WIZARD_STOPPED_ROLES.includes(role) && wizardIn(playedCards));
}

// The card's power as it would be with no Wizard in the trick.
function cardPowerOn(
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
  // The King's peace stops every other basic role's power in the trick.
  if (role !== "king" && kingsPeace(playedCards, trumpSuit, roleOf)) {
    return false;
  }

  // The Thief's 1 and the Servant's 2 work in any suit; off suit they only
  // swap, with no points (offSuit below).
  if (role === "thief" || role === "servant") {
    return true;
  }

  return !offSuit(playedCards, index, trumpSuit, roleOf);
}

// Whether the card at this place is neither in the suit led nor a trump.
// Never after a Wizard lead or for the card that leads.
export function offSuit(
  playedCards: PlayedCard[],
  index: number,
  trumpSuit: Suit | null,
  roleOf: RoleOf,
): boolean {
  const played = playedCards[index];
  const leadSuit = rules.getLeadSuit(playedCards.slice(0, index + 1), trumpSuit, trickRolesOf(roleOf));

  return !!played && leadSuit !== null && played.card.suit !== leadSuit && played.card.suit !== trumpSuit;
}

// The role whose card at this place lost its power to a Wizard played before
// it (WIZARD_BLOCKED_ROLES), for the table to tell; undefined otherwise.
export function wizardBlocked(
  playedCards: PlayedCard[],
  index: number,
  trumpSuit: Suit | null,
  roleOf: RoleOf,
): RoleId | undefined {
  const played = playedCards[index];
  const role = played && roleOf(playerOf(played));
  return role && (WIZARD_BLOCKED_ROLES.includes(role) || WIZARD_STOPPED_ROLES.includes(role))
    && wizardBefore(playedCards, index) && powerWithoutWizard(playedCards, index, role, trumpSuit, roleOf)
    ? role
    : undefined;
}

// Whether the card at this place would have its power on with no Wizard in
// the trick: the Farmer's 4 and the Shepherd's 5 in any suit, the others as
// cardPowerOn says.
function powerWithoutWizard(
  playedCards: PlayedCard[],
  index: number,
  role: RoleId,
  trumpSuit: Suit | null,
  roleOf: RoleOf,
): boolean {
  const played = playedCards[index]!;
  return role === "farmer" || role === "shepherd"
    ? played.card.value === roleCard(role) && roleOf(playerOf(played)) === role && !kingsPeace(playedCards, trumpSuit, roleOf)
    : cardPowerOn(playedCards, index, role, trumpSuit, roleOf);
}

// A Wizard just played, the trick's last card: the Farmers, Shepherds and
// Smiths whose cards came before it and lose their power to it (a seed or
// sheep not given, armour taken back). Those after an earlier Wizard
// already lost it to that one.
export function wizardStopped(
  playedCards: PlayedCard[],
  trumpSuit: Suit | null,
  roleOf: RoleOf,
): { by: string; role: RoleId }[] {
  const last = playedCards.length - 1;
  if (last < 1 || !isWizard(playedCards[last]!.card) || wizardBefore(playedCards, last)) return [];
  return playedCards.slice(0, last).flatMap((played, index) => {
    const role = roleOf(playerOf(played));
    return role && WIZARD_STOPPED_ROLES.includes(role) && powerWithoutWizard(playedCards, index, role, trumpSuit, roleOf)
      ? [{ by: playerOf(played), role }]
      : [];
  });
}

// Whether the card at this place is a role's card played with its power on,
// whatever comes of it: the Farmer's 4 and the Shepherd's 5 in any suit (the
// Thief's 1 and the Servant's 2 too, through powerOn), the other basic roles'
// cards in the lead suit or as a trump. The colour
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

  return (role === "farmer" || role === "shepherd") && !kingsPeace(playedCards, trumpSuit, roleOf) && !wizardIn(playedCards)
    || powerOn(playedCards, index, role, trumpSuit, roleOf);
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
