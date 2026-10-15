import type { PublicWizardGameState } from "../../backend/src/game/wizard/models/wizardGame";
import { isBotName } from "../../backend/src/game/wizard/models/bot";
import { TURN_HOURGLASS } from "./config";
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

// One move: who, in which phase, and how far into the round. The trick count
// tells apart a player leading two tricks in a row.
const moveKey = (state: PublicWizardGameState): string => {
  const tricks = state.players.reduce((sum, player) => sum + player.tricksWon, 0);
  return [
    state.currentRound,
    state.phase,
    state.currentPlayerIndex,
    tricks,
    state.currentTrick.playedCards.length,
  ].join(":");
};

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

  // The move's deadline, from whichever snapshot of this move has it.
  const deadlineOf = (key: string): number | null => {
    for (const state of [options.latest(), options.state()]) {
      if (state && state.turnDeadlineAt !== null && moveKey(state) === key) {
        return state.turnDeadlineAt;
      }
    }
    return null;
  };

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
        const deadline = deadlineOf(key);
        timedTo = deadline;
        const seconds =
          deadline !== null
            ? (deadline - Date.now()) / 1000
            : (state.turnTimeoutMs ?? TURN_HOURGLASS.turnSeconds * 1000) / 1000;
        hourglass.startTurn(Math.max(seconds, 0));
        return;
      }

      // The same move: its deadline may have just arrived.
      if (key !== null) {
        const deadline = deadlineOf(key);
        if (deadline !== null && deadline !== timedTo) {
          timedTo = deadline;
          hourglass.retime(Math.max((deadline - Date.now()) / 1000, 0));
        }
      }
    },
  };
}
