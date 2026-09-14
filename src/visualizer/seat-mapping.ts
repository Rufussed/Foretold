import { CHARACTER_IDS, type CharacterId } from "./character-assets";
import { SEAT_IDS, type SeatId } from "./player-characters";

// The fields of a game-state player that seating needs.
export interface SeatablePlayer {
  username: string;
  avatar?: string | null;
}

export interface SeatAssignment {
  seat: SeatId;
  username: string;
  character: CharacterId;
}

export const isCharacterId = (value: unknown): value is CharacterId =>
  typeof value === "string" &&
  (CHARACTER_IDS as readonly string[]).includes(value);

// Fallback for a player without an avatar. FNV-1a is stable across clients
// and sessions, so every table draws that player as the same character.
export function characterForUsername(username: string): CharacterId {
  let hash = 0x811c9dc5;
  for (let i = 0; i < username.length; i++) {
    hash ^= username.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return CHARACTER_IDS[(hash >>> 0) % CHARACTER_IDS.length];
}

// The character a player appears as: their claimed avatar, or the stand-in
// picked from their name.
export function characterForPlayer(player: SeatablePlayer): CharacterId {
  return isCharacterId(player.avatar) ? player.avatar : characterForUsername(player.username);
}

// Snapshots arrive many times a round; warn about a duplicate only once.
const reportedDuplicates = new Set<string>();

// Every client sees the table from its own chair, which holds the camera and
// is never drawn. Seat numbers decide which seats a game uses: with k other
// players, seat2..seat(k+1). Within those, players sit in turn order, starting
// from the player after the local one and wrapping around, following
// `clockwiseSeats` (the seats clockwise from the local player's left), so
// turns and the deal pass clockwise round the table. 3-6 players leaves 2-5
// characters, so five seats always suffice. A viewer who isn't playing sees
// everyone from the first player, up to five.
export function computeSeatAssignments(
  players: readonly SeatablePlayer[],
  localUsername: string,
  clockwiseSeats: readonly SeatId[] = SEAT_IDS,
): SeatAssignment[] {
  const seen = new Set<string>();
  const unique = players.filter((player) => {
    if (!seen.has(player.username)) {
      seen.add(player.username);
      return true;
    }
    if (!reportedDuplicates.has(player.username)) {
      reportedDuplicates.add(player.username);
      console.warn(`[seats] "${player.username}" appears twice; seating once`);
    }
    return false;
  });

  const local = unique.findIndex((player) => player.username === localUsername);
  const ordered =
    local === -1
      ? unique
      : [...unique.slice(local + 1), ...unique.slice(0, local)];

  const opponents = ordered.slice(0, SEAT_IDS.length);
  const used = SEAT_IDS.slice(0, opponents.length);
  const seats = clockwiseSeats.filter((seat) => used.includes(seat));
  return opponents.map((player, index) => ({
    seat: seats[index],
    username: player.username,
    character: characterForPlayer(player),
  }));
}
