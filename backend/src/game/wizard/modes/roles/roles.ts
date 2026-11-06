// The roles of the Roles mode: each wizard picks one before the game and
// keeps it to the end. The basic roles' powers belong to one number card, the
// one given here; they are open to everyone. The master roles, the colour
// Wizards (master/), have no card; they are open for testing now and will
// have to be earned. Like modes.ts it must stay free of Node-only code, because Vite
// bundles it into the browser.

import type { Card } from "../../models/card.js";

export const ROLES = [
  { id: "thief", kind: "basic", card: 1 },
  { id: "servant", kind: "basic", card: 2 },
  { id: "fisher", kind: "basic", card: 3 },
  { id: "farmer", kind: "basic", card: 4 },
  { id: "shepherd", kind: "basic", card: 5 },
  { id: "smith", kind: "basic", card: 6 },
  { id: "merchant", kind: "basic", card: 7 },
  // Every royal card (11, 12, 13) in a trick with the Priest's 8 pays faith.
  { id: "priest", kind: "basic", card: 8 },
  // The Warrior's 9: everyone pays when it wins; as a trump that loses, the
  // Warrior pays everyone.
  { id: "warrior", kind: "basic", card: 9 },
  // The Gambler's 10: they may bet it wins the trick, +20 if it does, -10
  // to the house if not.
  { id: "gambler", kind: "basic", card: 10 },
  // The Duke's 11: when it wins, they keep the trick for +10 or grant it to
  // any other player, paying them 5.
  { id: "duke", kind: "basic", card: 11 },
  // The Prophet's 12: as it is played she may lower her prediction by 1;
  // kept, a 12 that wins brings her +5.
  { id: "prophet", kind: "basic", card: 12 },
  // The King's 13: as a trump, no other role's power works in the trick;
  // otherwise, winning, every power used in it pays him a tax.
  { id: "king", kind: "basic", card: 13 },
  // No card of its own: the Blue Wizard sees how many blue cards each
  // opponent holds (master/blueWizard.ts). Open to everyone for now; to be unlocked
  // with Blue colour points later.
  { id: "blueWizard", kind: "master", card: null },
  // No card of its own either: the Green Wizard's green cards count 3 higher
  // (master/greenWizard.ts). Open to everyone for now, like the Blue Wizard.
  { id: "greenWizard", kind: "master", card: null },
  // And the Yellow Wizard, who can make yellow the lead suit.
  { id: "yellowWizard", kind: "master", card: null },
  // And the Red Wizard, whose red cards on a red lead cannot be trumped.
  { id: "redWizard", kind: "master", card: null },
  // The Joker, no colour and no card: never bound to follow suit
  // (master/joker.ts).
  { id: "joker", kind: "master", card: null },
  // The Watcher, free to every player with the master roles open: sees how
  // many of the round's 2 watched Wizards and 2 watched Jesters each
  // opponent holds (master/watcher.ts).
  { id: "watcher", kind: "master", card: null },
] as const;

export type RoleId = (typeof ROLES)[number]["id"];

export type RoleKind = (typeof ROLES)[number]["kind"];

// The roles of one kind, in their order.
export const rolesOfKind = (kind: RoleKind) => ROLES.filter((role) => role.kind === kind);

export const roleKind = (id: RoleId): RoleKind => ROLES.find((role) => role.id === id)?.kind ?? "basic";

export const isRoleId = (value: unknown): value is RoleId =>
  ROLES.some((role) => role.id === value);

// The number card a role's power belongs to; null for a role with none (the
// Blue Wizard), which no card can match.
export const roleCard = (id: RoleId): number | null =>
  ROLES.find((role) => role.id === id)?.card ?? null;

// A role's power at work in a trick, for the players to be told about.
// The roles whose power acts in a trick as an action to announce: all but the
// colour Wizards, whose powers are a sight and a boost.
export type ActingRoleId = Exclude<RoleId, "blueWizard" | "greenWizard" | "yellowWizard" | "redWizard" | "joker" | "watcher">;

export interface RoleAction {
  role: ActingRoleId;
  // Who used the power, and on whom.
  by: string;
  on: string;
  // The card it was about: for the Thief, the card stolen; for a Farmer's
  // seed or a Shepherd's sheep, their 4 or 5; for a harvest or a payment,
  // the card the trick was won with.
  card: Card;
  // A steal, a service, a catch, a Farmer's harvest or a Shepherd's payment:
  // the points taken from the player robbed, served, fished or the holder
  // (on), 0 when they had none to give. For a Smith, a block: the points
  // bounced back from the attacker (on); missing for armour forged (on is the
  // Smith themself).
  // Missing for a seed or sheep given. For a Merchant's market (on is the
  // Merchant themself, card their 7): what the market brought them in all,
  // below 0 when they paid more than they got.
  points?: number;
  // A Merchant's market, trade by trade: who paid the Merchant (points above
  // 0) or was paid by them (below 0). A trade a Smith's armour blocked is
  // left out. For a Priest's faith (on is the Priest themself, card their 8),
  // who paid them, the same way; points is the faith in all.
  trades?: { player: string; points: number }[];
  // Undone by the King's peace: a steal, a service or a Smith's armour,
  // swapped and paid back (modes/roles/king.ts). Kept so it was told once.
  undone?: true;
  // The King's peace (on is the King, card his trump 13): the players whose
  // powers it stopped, in the trick's order.
  stopped?: string[];
  // A Gambler's 10 that won with no bet: luck, not a bet won (gambler.ts).
  lucky?: true;
}

// A player's master role: the master slot in a basic + master game, or, in a
// one-role game saved before the slots existed, a master held as the role.
export const masterRoleOf = (player: { role?: RoleId | null; masterRole?: RoleId | null }): RoleId | undefined =>
  player.masterRole ?? (player.role && roleKind(player.role) === "master" ? player.role : undefined);

// Every role a player holds, basic first.
export const rolesHeld = (player: { role?: RoleId | null; masterRole?: RoleId | null }): RoleId[] =>
  [player.role, player.masterRole].filter((role): role is RoleId => !!role);
