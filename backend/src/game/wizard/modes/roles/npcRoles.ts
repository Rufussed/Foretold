import { ROLES, type RoleId } from "./roles.js";

// Roles mode only. Which roles the NPCs draw at the start of a Roles game,
// chosen by the host in the room (src/pages/Room.ts): basic roles only,
// master roles only, or any of both. Players who chose no role still draw
// from every role. Like roles.ts it must stay free of Node-only code, because
// Vite bundles it into the browser.

export const NPC_ROLES = ["both", "basic", "master"] as const;

export type NpcRoles = (typeof NPC_ROLES)[number];

// Any role, as before the choice existed.
export const DEFAULT_NPC_ROLES: NpcRoles = "both";

export const normalizeNpcRoles = (value: unknown): NpcRoles =>
  NPC_ROLES.find((choice) => choice === value) ?? DEFAULT_NPC_ROLES;

// The roles an NPC may draw.
export const npcRolePool = (choice: NpcRoles): RoleId[] =>
  ROLES.filter((role) => choice === "both" || role.kind === choice).map((role) => role.id);
