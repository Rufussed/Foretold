import type { PublicWizardGameState } from "../../backend/src/game/wizard/models/wizardGame";
import { moveKey } from "./move-deadline";

export interface TurnReadySignal {
  // Call whenever the HUD's state or whether its turn is shown changes.
  applyState(): void;
}

export interface TurnReadySignalOptions {
  localUsername: string;
  state(): PublicWizardGameState | null;
  turnShown(): boolean;
  send(message: object): boolean;
}

// Tells the server once your table has shown you your turn - after the
// walk-in, the deal and the camera turning to you - so a timed move's
// countdown starts from there rather than while you were still watching the
// cards land (see turn_ready in wizardSocket.ts). Once per move.
export function createTurnReadySignal(options: TurnReadySignalOptions): TurnReadySignal {
  let sentFor: string | null = null;

  return {
    applyState() {
      const state = options.state();
      const player = state?.players[state.currentPlayerIndex];
      if (
        !state ||
        !options.turnShown() ||
        state.phase === "finished" ||
        state.turnTimeoutMs === null ||
        state.turnDeadlineAt !== null ||
        player?.username !== options.localUsername
      ) {
        return;
      }
      const key = moveKey(state);
      if (key === sentFor) return;
      if (options.send({ type: "turn_ready" })) sentFor = key;
    },
  };
}
