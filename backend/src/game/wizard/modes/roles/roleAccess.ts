import db from "../../../../db/database.js";
import type { RoleId } from "./roles.js";
import { openRoles, type ColorPoints } from "./roleLocks.js";
import { playerStatsRepository } from "../../services/playerStatsRepository.js";
import { getRoleProgress } from "./roleProgress.js";

// Roles mode only. The roles a player may choose (roleLocks.ts), from their
// seals, their colour points (the colour Wizards) and from roles_all_open (db/migrations.ts): accounts made before the
// locks, and those an admin opened.

export function rolesAllOpen(userId: number): boolean {
  return db.prepare("SELECT 1 FROM roles_all_open WHERE user_id = ?").get(userId) !== undefined;
}

// Admin: every role open for an account, or the locks back on.
export function setRolesAllOpen(userId: number, open: boolean): void {
  if (open) db.prepare("INSERT OR IGNORE INTO roles_all_open (user_id) VALUES (?)").run(userId);
  else db.prepare("DELETE FROM roles_all_open WHERE user_id = ?").run(userId);
}

export const colorPointsOf = (userId: number): ColorPoints =>
  playerStatsRepository.getStats(userId)?.colorPoints ?? {};

export function openRolesFor(userId: number): RoleId[] {
  return openRoles(getRoleProgress(userId), rolesAllOpen(userId), colorPointsOf(userId));
}

// The same by name, for the room and the game start; an unknown name (a
// bot) gets every role.
export function openRolesForUsername(username: string): RoleId[] {
  const row = db.prepare("SELECT id FROM users WHERE username = ?").get(username) as { id: number } | undefined;
  return row ? openRolesFor(row.id) : openRoles([], true);
}
