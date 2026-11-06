import { isBotName } from "../../models/bot.js";
import type { GamePlayer } from "../../models/wizardGame.js";
import { ROLES, roleKind, rolesOfKind, type RoleId, type RoleKind } from "./roles.js";

// A role drawn at random from those given (every role, basic and master, when
// left out), for a bot or a player who chose none.
export function randomRole(random: () => number = Math.random, from: readonly RoleId[] = ROLES.map((role) => role.id)): RoleId {
  const index = Math.min(Math.floor(random() * from.length), from.length - 1);

  return from[index] ?? "thief";
}

// What a player chose in the Antechamber: a basic role, and in a basic +
// master room a master role too; null for none.
export interface ChosenRoles {
  role: RoleId | null;
  masterRole?: RoleId | null;
}

export interface AssignOptions {
  random?: () => number;
  // A basic + master game (rolePairs.ts): everyone gets one of each.
  pair?: boolean;
  // The roles open to a player (roleLocks.ts); every role when left out.
  openFor?: (username: string) => readonly RoleId[];
}

// At the start of a Roles game, every seat gets its roles for the whole game:
// a basic role, and in a basic + master game a master role too. Each is the
// one its player chose in the Antechamber, or one drawn at random for bots
// and for anyone who chose none: players draw from the roles open to them,
// bots from every role of the kind. Roles drawn at random are never drawn
// twice in one game and never one a player chose, so no NPC shares a role
// with an NPC or a player; only once every such role is out can one come
// round again. A master role chosen for a one-role game is not played.
export function assignRoles(
  players: GamePlayer[],
  chosen: ReadonlyMap<string, ChosenRoles>,
  { random = Math.random, pair = false, openFor = () => ROLES.map((role) => role.id) }: AssignOptions = {},
): void {
  const pick = (kind: RoleKind) => (player: GamePlayer): RoleId | null => {
    const own = chosen.get(player.username);
    const role = kind === "basic" ? own?.role : own?.masterRole;
    return role && roleKind(role) === kind ? role : null;
  };

  drawSlot(players, "basic", pick("basic"), (player, role) => { player.role = role; }, random, openFor);
  if (pair) {
    drawSlot(players, "master", pick("master"), (player, role) => { player.masterRole = role; }, random, openFor);
  }
}

// One slot, basic or master, for every seat.
function drawSlot(
  players: GamePlayer[],
  kind: RoleKind,
  chosenOf: (player: GamePlayer) => RoleId | null,
  give: (player: GamePlayer, role: RoleId) => void,
  random: () => number,
  openFor: (username: string) => readonly RoleId[],
): void {
  const all = rolesOfKind(kind).map((role) => role.id);
  const taken = new Set(players.map(chosenOf).filter((role) => role !== null));
  const drawn = new Set<RoleId>();

  for (const player of players) {
    const own = chosenOf(player);
    if (own) {
      give(player, own);
      continue;
    }

    const open = isBotName(player.username) ? all : all.filter((id) => openFor(player.username).includes(id));
    // A player with none of the kind open (no master yet) gets none.
    if (open.length === 0) continue;
    let left = open.filter((id) => !taken.has(id) && !drawn.has(id));
    if (left.length === 0) {
      // Every such role is out: they come round again.
      for (const id of open) drawn.delete(id);
      left = open.filter((id) => !taken.has(id));
      if (left.length === 0) left = open;
    }

    const role = randomRole(random, left);
    give(player, role);
    drawn.add(role);
  }
}
