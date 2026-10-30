// The roles of the Roles mode: each wizard picks one before the game and
// keeps it to the end. A role's power belongs to one number card, the one
// given here. These seven are open to everyone; roles to be earned by playing
// come later. Like modes.ts it must stay free of Node-only code, because Vite
// bundles it into the browser.

import type { Card } from "../../models/card.js";

export const ROLES = [
  { id: "thief", card: 1 },
  { id: "servant", card: 2 },
  { id: "fisher", card: 3 },
  { id: "farmer", card: 4 },
  { id: "shepherd", card: 5 },
  { id: "smith", card: 6 },
  { id: "merchant", card: 7 },
  // No card of its own: the Blue Wizard sees how many blue cards each
  // opponent holds (blueWizard.ts). Open to everyone for now; to be unlocked
  // with Blue colour points later.
  { id: "blueWizard", card: null },
  // No card of its own either: the Green Wizard's green cards count 3 higher
  // (greenWizard.ts). Open to everyone for now, like the Blue Wizard.
  { id: "greenWizard", card: null },
  // And the Yellow Wizard, who can make yellow the lead suit.
  { id: "yellowWizard", card: null },
] as const;

export type RoleId = (typeof ROLES)[number]["id"];

export const isRoleId = (value: unknown): value is RoleId =>
  ROLES.some((role) => role.id === value);

// The number card a role's power belongs to; null for a role with none (the
// Blue Wizard), which no card can match.
export const roleCard = (id: RoleId): number | null =>
  ROLES.find((role) => role.id === id)?.card ?? null;

// A role's power at work in a trick, for the players to be told about.
// The roles whose power acts in a trick as an action to announce: all but the
// colour Wizards, whose powers are a sight and a boost.
export type ActingRoleId = Exclude<RoleId, "blueWizard" | "greenWizard" | "yellowWizard">;

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
  // left out.
  trades?: { player: string; points: number }[];
}
