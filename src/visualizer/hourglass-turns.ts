import type { PublicWizardGameState } from "../../backend/src/game/wizard/models/wizardGame";
import { isBotName } from "../../backend/src/game/wizard/models/bot";
import { TURN_HOURGLASS } from "./config";
import { deadlineOf, moveKey } from "./move-deadline";
import type { TurnHourglass } from "./turn-hourglass";

export interface HourglassTurns {
  // Call whenever the HUD's state, whether its turn is shown, or the latest
  // snapshot from the server changes.
  applyState(): void;
}

export interface HourglassTurnsOptions {
  // What the HUD shows now, and whether its current move has been announced.
  state(): PublicWizardGameState | null;
  turnShown(): boolean;
  // The newest snapshot from the server, which can carry the move's deadline
  // before the table has caught up with it.
  latest(): PublicWizardGameState | null;
  // Shown only in rooms with a time limit.
  setShown(shown: boolean): void;
}

// Times each human player's move on the hourglass. It starts when the table
// shows it is their turn and runs out at the server's deadline for the move
// (turnDeadlineAt), when the game makes the move for them. The server sets
// that deadline a moment after the move begins, so until it arrives the
// hourglass runs on the room's time limit and is re-timed once it does. NPCs
// move at once, so their turns leave it run out.
export function createHourglassTurns(
  hourglass: TurnHourglass,
  options: HourglassTurnsOptions,
): HourglassTurns {
  let timing: string | null = null;
  let timedTo: number | null = null; // the deadline the hourglass runs to

  const deadline = (key: string) => deadlineOf(key, [options.latest(), options.state()]);

  return {
    applyState() {
      const state = options.state();
      options.setShown(!!state && state.turnTimeoutMs !== null);
      const player = state?.players[state.currentPlayerIndex];
      const key =
        state &&
        player &&
        options.turnShown() &&
        state.phase !== "finished" &&
        state.turnTimeoutMs !== null &&
        !isBotName(player.username)
          ? moveKey(state)
          : null;

      if (key !== timing) {
        // The timed move was made (or the game ended): run the rest out.
        if (timing !== null) hourglass.finishTurn();
        timing = key;
        timedTo = null;
        if (key === null || !state) return;
        const due = deadline(key);
        timedTo = due;
        const seconds =
          due !== null
            ? (due - Date.now()) / 1000
            : (state.turnTimeoutMs ?? TURN_HOURGLASS.turnSeconds * 1000) / 1000;
        hourglass.startTurn(Math.max(seconds, 0));
        return;
      }

      // The same move: its deadline may have just arrived.
      if (key !== null) {
        const due = deadline(key);
        if (due !== null && due !== timedTo) {
          timedTo = due;
          hourglass.retime(Math.max((due - Date.now()) / 1000, 0));
        }
      }
    },
  };
}
