import type { PublicWizardGameState } from "../../../backend/src/game/wizard/models/wizardGame";
import { FISHING_TIMEOUT_MS } from "../../../backend/src/game/wizard/modes/roles/fisher";
import { GRANT_TIMEOUT_MS } from "../../../backend/src/game/wizard/modes/roles/duke";

// Roles mode only. Every role's choice is timed on the hourglass, in any
// room, with or without a time limit on turns:
// - a Fisher's catch and a Duke's grant are moves of their own, which the
//   server times (FISHING_TIMEOUT_MS, GRANT_TIMEOUT_MS) and makes for the
//   player when time runs out; roleChoiceLimitMs tells the hourglass
//   (visualizer/hourglass-turns.ts) how long they have.
// - a Thief's trump 1, a Gambler's bet and a Prophet's prediction are chosen
//   as the card is played, before anything is sent. The table times those
//   itself (createChoiceTimer): when time runs out, the safe answer goes -
//   the nearest card, no bet, the prediction kept.

export const ROLE_CHOICE = {
  // How long a choice made with a card has, in seconds; less when the turn's
  // own time runs out sooner.
  seconds: 15,
};

// A Roles move with its own time limit, whatever the room's: how long it
// has. Null for every other move.
export const roleChoiceLimitMs = (state: PublicWizardGameState): number | null =>
  state.phase === "fishing" ? FISHING_TIMEOUT_MS : state.phase === "granting" ? GRANT_TIMEOUT_MS : null;

export interface ChoiceTimer {
  // Starts timing a choice; onTimeout gives the safe answer. Starting again
  // replaces any choice still timed.
  start(onTimeout: () => void): void;
  // The choice was made (or dropped): the timing stops.
  stop(): void;
  dispose(): void;
}

export interface ChoiceTimerOptions {
  // The turn's own deadline, if it has one (the server's turnDeadlineAt).
  turnDeadline(): number | null;
  // The hourglass: a choice of this many seconds has started, or has ended.
  onStart?(seconds: number): void;
  onEnd?(): void;
}

export function createChoiceTimer({ turnDeadline, onStart, onEnd }: ChoiceTimerOptions): ChoiceTimer {
  let timer = 0;
  let timing = false;

  const stop = () => {
    window.clearTimeout(timer);
    if (!timing) return;
    timing = false;
    onEnd?.();
  };

  return {
    start(onTimeout) {
      stop();
      const deadline = turnDeadline();
      const turnLeft = deadline === null ? Infinity : (deadline - Date.now()) / 1000;
      const seconds = Math.max(0, Math.min(ROLE_CHOICE.seconds, turnLeft));
      timing = true;
      onStart?.(seconds);
      timer = window.setTimeout(() => {
        stop();
        onTimeout();
      }, seconds * 1000);
    },
    stop,
    dispose: stop,
  };
}
