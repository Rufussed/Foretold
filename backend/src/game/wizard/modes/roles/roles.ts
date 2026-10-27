// The roles of the Roles mode: each wizard picks one before the game and
// keeps it to the end. A role's power belongs to one number card, the one
// given here. These four are open to everyone; roles to be earned by playing
// come later. Like modes.ts it must stay free of Node-only code, because Vite
// bundles it into the browser.

export const ROLES = [
  { id: "thief", card: 1 },
  { id: "servant", card: 2 },
  { id: "fisher", card: 3 },
  { id: "farmer", card: 4 },
] as const;

export type RoleId = (typeof ROLES)[number]["id"];

export const isRoleId = (value: unknown): value is RoleId =>
  ROLES.some((role) => role.id === value);
