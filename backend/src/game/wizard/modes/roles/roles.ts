// The roles of the Roles mode: each wizard picks one before the game and
// keeps it to the end. A role's power belongs to one number card, the one
// given here. These five are open to everyone; roles to be earned by playing
// come later. Like modes.ts it must stay free of Node-only code, because Vite
// bundles it into the browser.

import type { Card } from "../../models/card.js";

export const ROLES = [
  { id: "thief", card: 1 },
  { id: "servant", card: 2 },
  { id: "fisher", card: 3 },
  { id: "farmer", card: 4 },
  { id: "shepherd", card: 5 },
] as const;

export type RoleId = (typeof ROLES)[number]["id"];

export const isRoleId = (value: unknown): value is RoleId =>
  ROLES.some((role) => role.id === value);

// The number card a role's power belongs to.
export const roleCard = (id: RoleId): number =>
  ROLES.find((role) => role.id === id)?.card ?? 0;

// A role's power at work in a trick, for the players to be told about.
export interface RoleAction {
  role: RoleId;
  // Who used the power, and on whom.
  by: string;
  on: string;
  // The card it was about: for the Thief, the card stolen; for a Farmer's
  // seed or a Shepherd's sheep, their 4 or 5; for a harvest or a payment,
  // the card the trick was won with.
  card: Card;
  // A steal, a service, a catch, a Farmer's harvest or a Shepherd's payment:
  // the points taken from the player robbed, served, fished or the holder
  // (on), 0 when they had none to give.
  // Missing for a seed or sheep given.
  points?: number;
}
