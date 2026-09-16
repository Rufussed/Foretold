import type { CharacterId } from "./character-assets";
import { SEAT_IDS, type PlayerCharacters, type SeatId } from "./player-characters";
import { computeSeatAssignments, type SeatablePlayer } from "./seat-mapping";

export interface SeatSync {
  // Call with every game snapshot; only seats whose occupant changed are touched.
  applyPlayers(players: readonly SeatablePlayer[], localUsername: string): void;
  seatOf(username: string): SeatId | null;
  // Occupied seats and who sits in them, in seat order.
  seated(): Array<[SeatId, string]>;
}

// The backend broadcasts the whole game state on every change, so this runs
// many times a round. Reseating an unchanged seat would restart its idle,
// reroll its phase and cut off any emote in progress, so seats are diffed.
export function createSeatSync(
  characters: PlayerCharacters,
  // Seats clockwise from the local player's left; see computeSeatAssignments.
  clockwiseSeats: readonly SeatId[] = SEAT_IDS,
): SeatSync {
  const occupants = new Map<SeatId, { username: string; character: CharacterId }>();

  return {
    applyPlayers(players, localUsername) {
      const wanted = new Map(
        computeSeatAssignments(players, localUsername, clockwiseSeats).map((assignment) => [
          assignment.seat,
          assignment,
        ]),
      );

      for (const seat of SEAT_IDS) {
        const current = occupants.get(seat);
        const next = wanted.get(seat);

        if (!next) {
          if (current) {
            occupants.delete(seat);
            characters.clearPlayer(seat);
          }
          continue;
        }

        if (
          current?.username === next.username &&
          current.character === next.character
        ) {
          continue;
        }

        occupants.set(seat, { username: next.username, character: next.character });
        characters
          .setCharacter(seat, next.character)
          .catch((error) => console.warn(`[seats] seat ${seat}:`, error));
      }
    },

    seatOf(username) {
      for (const [seat, occupant] of occupants) {
        if (occupant.username === username) return seat;
      }
      return null;
    },

    seated() {
      return SEAT_IDS.flatMap((seat): Array<[SeatId, string]> => {
        const occupant = occupants.get(seat);
        return occupant ? [[seat, occupant.username]] : [];
      });
    },
  };
}
