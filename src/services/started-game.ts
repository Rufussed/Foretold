import { API_BASE } from "./api";

// A game the player has a seat in can start while they are elsewhere: only
// the room page moves them to the table. The pages with their name (navbar,
// Home, Profile) look for such a game every few seconds and call them to it.
const STARTED_GAME_REFRESH_MS = 8000;

export interface StartedGame {
  roomId: number;
  name: string;
}

interface LobbyRoom {
  id: number;
  name: string;
  status: "waiting" | "playing";
  // Set on a running game's players who quit it (backend playerQuit.ts).
  players: { username: string; quit?: boolean }[];
}

// The lobby list holds every room the player can see, running ones too.
async function findStartedGame(username: string): Promise<StartedGame | null> {
  const token = localStorage.getItem("wizardToken");

  if (!token) {
    return null;
  }

  const response = await fetch(`${API_BASE}/wizard/lobby`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!response.ok) {
    throw new Error("Could not load rooms");
  }

  const data = (await response.json()) as { rooms?: LobbyRoom[] };
  const room = data.rooms?.find(
    (candidate) =>
      candidate.status === "playing" &&
      candidate.players.some(
        (player) => player.username === username && !player.quit,
      ),
  );

  return room ? { roomId: room.id, name: room.name } : null;
}

export function startedGameHash(game: StartedGame): string {
  return `#/game/${game.roomId}/visualizer`;
}

// Calls onChange with the started game, or null, now and every few seconds
// while the tab is in view. Stops once `anchor` leaves the page (a new page,
// or the same page drawn anew). A failed look changes nothing.
export function watchStartedGame(
  anchor: HTMLElement,
  username: string,
  onChange: (game: StartedGame | null) => void,
): void {
  const look = async (): Promise<void> => {
    try {
      const game = await findStartedGame(username);

      if (anchor.isConnected) {
        onChange(game);
      }
    } catch {
      // Try again next time.
    }
  };

  const schedule = (): void => {
    window.setTimeout(async () => {
      if (!anchor.isConnected) {
        return;
      }

      if (!document.hidden) {
        await look();
      }

      schedule();
    }, STARTED_GAME_REFRESH_MS);
  };

  void look();
  schedule();
}
