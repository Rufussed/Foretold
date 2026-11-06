import db from "../../../../db/database.js";
import { normalizeGameOptions } from "../../gameOptions.js";
import { isBotName } from "../../models/bot.js";
import { fullRoundCount } from "../../models/rounds.js";
import type { GamePlayer, WizardGameState } from "../../models/wizardGame.js";
import { isRoleId, type RoleId } from "./roles.js";
import { sealPoints, sealState, type RoleRecord, type SealLevelId } from "./sealLevels.js";

// Roles mode only. Each player's record with each role, kept in role_progress
// (db/migrations.ts) for the Profile's seals. The game completion service
// calls it for every human who finished the game.
//
// A game counts for a role when it was finished, ran at least half its full
// length (3 players: 10 rounds of 20), and was not played against Apprentice
// NPCs alone, who do not know the roles.

export function countsForRoleProgress(game: WizardGameState): boolean {
  if (normalizeGameOptions(game.options).mode !== "roles") return false;

  const fullRounds = fullRoundCount(game.players.length);
  if (fullRounds === undefined || game.totalRounds < Math.ceil(fullRounds / 2)) return false;

  // Bots from before personalities existed play as Apprentices.
  const bots = game.players.filter((player) => isBotName(player.username));
  return bots.length === 0 || bots.some((bot) => bot.botPersonality === "adept");
}

export interface RoleGameRecord {
  role: string;
  won: boolean;
  powerUses: number;
  rolePoints: number;
}

// What one finished game adds to a player's record with their role; null
// for a player without one.
export function roleGameRecord(player: GamePlayer, won: boolean): RoleGameRecord | null {
  return player.role ? recordFor(player, player.role, won, player.powerUses ?? 0) : null;
}

// The same for each role they held: in a basic + master game, both.
export function roleGameRecords(player: GamePlayer, won: boolean): RoleGameRecord[] {
  const basic = roleGameRecord(player, won);
  const master = player.masterRole ? recordFor(player, player.masterRole, won, player.masterPowerUses ?? 0) : null;
  return [basic, master].filter((record): record is RoleGameRecord => record !== null);
}

function recordFor(player: GamePlayer, role: RoleId, won: boolean, powerUses: number): RoleGameRecord {
  // Each round's points by role, their own role's only: what other players'
  // powers took from or gave them is not their role's doing.
  const rolePoints = player.roundScores.reduce((sum, round) => sum + (round.roleBonuses?.[role] ?? 0), 0);
  return { role, won, powerUses, rolePoints };
}

export function recordRoleGame(userId: number, record: RoleGameRecord): void {
  db.prepare(`
    INSERT INTO role_progress (user_id, role, games, wins, power_uses, role_points)
    VALUES (?, ?, 1, ?, ?, ?)
    ON CONFLICT (user_id, role) DO UPDATE SET
      games = games + 1,
      wins = wins + excluded.wins,
      power_uses = power_uses + excluded.power_uses,
      role_points = role_points + excluded.role_points
  `).run(userId, record.role, record.won ? 1 : 0, record.powerUses, record.rolePoints);
}

// The hook for the completion service: records the game if it counts.
export function recordRoleProgress(game: WizardGameState, player: GamePlayer, userId: number, won: boolean): void {
  if (!countsForRoleProgress(game)) return;
  for (const record of roleGameRecords(player, won)) recordRoleGame(userId, record);
}

// A player's record with every role they have a row for, for the Profile.
export function getRoleProgress(userId: number): RoleRecord[] {
  const rows = db
    .prepare("SELECT role, games, wins FROM role_progress WHERE user_id = ?")
    .all(userId) as { role: string; games: number; wins: number }[];
  return rows.filter((row): row is RoleRecord => isRoleId(row.role));
}

// Dev only (roleProgressRoutes.ts): one more game with a role, won or not,
// as if it had been played; or the role's record wiped.
export function devAddRoleGame(userId: number, role: RoleId, won: boolean): void {
  recordRoleGame(userId, { role, won, powerUses: 0, rolePoints: 0 });
}

export function devResetRole(userId: number, role: RoleId): void {
  db.prepare("DELETE FROM role_progress WHERE user_id = ? AND role = ?").run(userId, role);
}

// At the start of a Roles game, once roles are assigned: each player's seal
// level with their role, to show on the table. Bots and players with no
// record keep none, which shows as wax.
export function assignSealLevels(players: GamePlayer[]): void {
  for (const player of players) {
    if (isBotName(player.username)) continue;
    const basic = player.role && sealLevelOf(player.username, player.role);
    if (basic) player.sealLevel = basic;
    // And the master role's, in a basic + master game.
    const master = player.masterRole && sealLevelOf(player.username, player.masterRole);
    if (master) player.masterSealLevel = master;
  }
}

function sealLevelOf(username: string, role: RoleId): SealLevelId | null {
  const row = db
    .prepare(`
      SELECT games, wins
      FROM role_progress
        JOIN users ON users.id = role_progress.user_id
      WHERE users.username = ? AND role_progress.role = ?
    `)
    .get(username, role) as { games: number; wins: number } | undefined;
  return row ? sealState(sealPoints(row)).done : null;
}
