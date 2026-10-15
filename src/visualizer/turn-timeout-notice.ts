import type { PublicWizardGameState } from "../../backend/src/game/wizard/models/wizardGame";
import { deadlineOf, moveKey } from "./move-deadline";

const MESSAGE = "Time waits for no one. The Fates have chosen for you.";

export interface TurnTimeoutNotice {
  // Call whenever the HUD's state, whether its turn is shown, or the latest
  // snapshot from the server changes.
  applyState(): void;
  // True once your current move's time has run out: the game is making it
  // for you, so the prompts stay closed.
  timedOut(): boolean;
  dispose(): void;
}

export interface TurnTimeoutNoticeOptions {
  localUsername: string;
  state(): PublicWizardGameState | null;
  turnShown(): boolean;
  latest(): PublicWizardGameState | null;
  // Says it, straight away.
  notice(text: string): void;
  // Your move just timed out; the prompts should look again.
  onTimedOut(): void;
}

// When your own move runs out of time, says so as it happens and closes the
// move's prompt. The server then waits its usual NPC pause before making the
// move, and would refuse anything you sent meanwhile.
export function createTurnTimeoutNotice(options: TurnTimeoutNoticeOptions): TurnTimeoutNotice {
  let watching: string | null = null; // your move being timed
  let due: number | null = null;
  let expired: string | null = null; // your move whose time ran out
  let timer = 0;

  const expire = (key: string) => {
    timer = 0;
    if (watching !== key || expired === key) return;
    expired = key;
    options.notice(MESSAGE);
    options.onTimedOut();
  };

  return {
    applyState() {
      const state = options.state();
      const player = state?.players[state.currentPlayerIndex];
      const key =
        state && options.turnShown() && state.phase !== "finished" && player?.username === options.localUsername
          ? moveKey(state)
          : null;

      if (key !== watching) {
        window.clearTimeout(timer);
        timer = 0;
        watching = key;
        due = null;
      }
      if (key === null || expired === key) return;

      const deadline = deadlineOf(key, [options.latest(), state]);
      if (deadline === null || deadline === due) return;
      due = deadline;
      window.clearTimeout(timer);
      timer = window.setTimeout(() => expire(key), Math.max(deadline - Date.now(), 0));
    },

    timedOut: () => watching !== null && expired === watching,

    dispose() {
      window.clearTimeout(timer);
    },
  };
}
