import { isBotName } from "../../models/bot.js";
import type { GamePlayer } from "../../models/wizardGame.js";
import { DEFAULT_NPC_ROLES, npcRolePool, type NpcRoles } from "./npcRoles.js";
import { ROLES, type RoleId } from "./roles.js";

// A role drawn at random from those given (every role, basic and master, when
// left out), for a bot or a player who chose none.
export function randomRole(random: () => number = Math.random, from: readonly RoleId[] = ROLES.map((role) => role.id)): RoleId {
  const index = Math.min(Math.floor(random() * from.length), from.length - 1);

  return from[index] ?? "thief";
}

// At the start of a Roles game, every seat gets its role for the whole
// game: the one its player chose in the Antechamber, or a random one for
// bots and for anyone who chose none. Bots draw only the kinds the host
// chose (npcRoles.ts); players who chose none draw from every role. Roles
// drawn at random are never drawn twice in one game and never one a player
// chose, so no NPC shares a role with an NPC or a player; only once every
// such role is out can one come round again.
export function assignRoles(
  players: GamePlayer[],
  chosen: ReadonlyMap<string, RoleId | null>,
  random: () => number = Math.random,
  npcRoles: NpcRoles = DEFAULT_NPC_ROLES,
): void {
  const taken = new Set(players.map((player) => chosen.get(player.username)).filter((role) => role != null));
  const drawn = new Set<RoleId>();
  const all = ROLES.map((role) => role.id);
  const forNpcs = npcRolePool(npcRoles);

  for (const player of players) {
    const own = chosen.get(player.username);
    if (own) {
      player.role = own;
      continue;
    }

    const from = isBotName(player.username) ? forNpcs : all;
    let left = from.filter((id) => !taken.has(id) && !drawn.has(id));
    if (left.length === 0) {
      // Every such role is out: they come round again.
      for (const id of from) drawn.delete(id);
      left = from.filter((id) => !taken.has(id));
      if (left.length === 0) left = from;
    }

    const role = randomRole(random, left);
    player.role = role;
    drawn.add(role);
  }
}
