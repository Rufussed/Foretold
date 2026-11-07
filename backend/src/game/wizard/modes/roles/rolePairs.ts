import type { WizardGameOptions } from "../../gameOptions.js";
import { isBotName } from "../../models/bot.js";
import type { Room } from "../../models/wizardGame.js";
import { openRolesForUsername } from "./roleAccess.js";
import { roleKind } from "./roles.js";

// Roles mode only. Basic + master rooms (gameOptions.rolePair): every player
// plays one basic role and one master role. A player with no master role open
// yet (roleLocks.ts), a guest included, cannot take a seat there. One-role
// rooms play basic roles only.

export const isPairRoom = (options: Pick<WizardGameOptions, "mode" | "rolePair">): boolean =>
  options.mode === "roles" && options.rolePair;

export const hasOpenMaster = (username: string): boolean =>
  openRolesForUsername(username).some((role) => roleKind(role) === "master");

export const NO_MASTER_ERROR = "This room plays one basic and one master role each, and you have no master role open yet.";

// Why this player may not join the room; null when they may.
export function pairSeatRefusal(room: Pick<Room, "options">, username: string): string | null {
  return isPairRoom(room.options) && !hasOpenMaster(username) ? NO_MASTER_ERROR : null;
}

// The players seated in a basic + master room who have no master role open
// (the host may have switched the option on after they joined); none in any
// other room.
export const playersWithoutMaster = (room: Pick<Room, "options" | "players">): string[] =>
  isPairRoom(room.options)
    ? room.players.map((player) => player.username).filter((name) => !isBotName(name) && !hasOpenMaster(name))
    : [];
