import type { RoleId } from "./roles.js";

// Roles mode only. The levels of a role's seal, worked out from the player's
// record with it (role_progress, roleProgress.ts). Shared by the server and
// the Profile (src/modes/roles/profile-seals.ts), so it must stay free of
// Node-only code. Only the counts are stored, so these steps can change
// without touching the data.

// The levels, in order, and the progress points that complete each one.
// Wax is every player's from the start, before any game with the role.
export const SEAL_LEVELS = [
  { id: "wax", at: 0 },
  { id: "wood", at: 8 },
  { id: "copper", at: 30 },
  { id: "silver", at: 70 },
  { id: "gold", at: 130 },
] as const;

export type SealLevelId = (typeof SEAL_LEVELS)[number]["id"];

// A player's record with one role, as the Profile gets it.
export interface RoleRecord {
  role: RoleId;
  games: number;
  wins: number;
}

// A game that counts is one point, a win one more.
export const sealPoints = (record: Pick<RoleRecord, "games" | "wins">): number => record.games + record.wins;

export interface SealState {
  // The last level completed, or null for none yet.
  done: SealLevelId | null;
  // The level under way, and how far, 0 to 1; null once gold is reached.
  next: SealLevelId | null;
  fill: number;
}

export function sealState(points: number): SealState {
  const reached = SEAL_LEVELS.filter((level) => points >= level.at).length;
  const done = reached > 0 ? SEAL_LEVELS[reached - 1]!.id : null;
  const level = SEAL_LEVELS[reached];
  if (!level) return { done, next: null, fill: 1 };
  const from = reached > 0 ? SEAL_LEVELS[reached - 1]!.at : 0;
  return { done, next: level.id, fill: (points - from) / (level.at - from) };
}
