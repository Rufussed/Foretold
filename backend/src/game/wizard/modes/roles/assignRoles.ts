import type { GamePlayer } from "../../models/wizardGame.js";
import { ROLES, type RoleId } from "./roles.js";

// A role drawn at random, for a bot or a player who chose none.
export function randomRole(random: () => number = Math.random): RoleId {
  const index = Math.min(Math.floor(random() * ROLES.length), ROLES.length - 1);

  return ROLES[index]?.id ?? "thief";
}

// At the start of a Roles game, every seat gets its role for the whole
// game: the one its player chose in the Antechamber, or a random one for
// bots and for anyone who chose none.
export function assignRoles(
  players: GamePlayer[],
  chosen: ReadonlyMap<string, RoleId | null>,
  random: () => number = Math.random,
): void {
  for (const player of players) {
    player.role = chosen.get(player.username) ?? randomRole(random);
  }
}
