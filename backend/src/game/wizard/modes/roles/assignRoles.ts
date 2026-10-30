import type { GamePlayer } from "../../models/wizardGame.js";
import { ROLES, type RoleId } from "./roles.js";

// A role drawn at random from those given (every role, basic and master, when
// left out), for a bot or a player who chose none.
export function randomRole(random: () => number = Math.random, from: readonly RoleId[] = ROLES.map((role) => role.id)): RoleId {
  const index = Math.min(Math.floor(random() * from.length), from.length - 1);

  return from[index] ?? "thief";
}

// At the start of a Roles game, every seat gets its role for the whole
// game: the one its player chose in the Antechamber, or a random one for
// bots and for anyone who chose none. Roles drawn at random are never drawn
// twice in one game, so no two NPCs share one; only once every role is out
// can one come round again.
export function assignRoles(
  players: GamePlayer[],
  chosen: ReadonlyMap<string, RoleId | null>,
  random: () => number = Math.random,
): void {
  let left: RoleId[] = ROLES.map((role) => role.id);

  for (const player of players) {
    const own = chosen.get(player.username);
    if (own) {
      player.role = own;
      continue;
    }

    if (left.length === 0) left = ROLES.map((role) => role.id);
    const role = randomRole(random, left);
    player.role = role;
    left = left.filter((id) => id !== role);
  }
}
