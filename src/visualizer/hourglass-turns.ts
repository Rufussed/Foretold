import type { PublicWizardGameState } from "../../backend/src/game/wizard/models/wizardGame";
import { isBotName } from "../../backend/src/game/wizard/models/bot";
import { TURN_HOURGLASS } from "./config";
import type { TurnHourglass } from "./turn-hourglass";

export interface HourglassTurns {
  // Call whenever the HUD's state or whether its turn is shown changes.
  applyState(): void;
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

// Times each human player's move on the hourglass, from when the table shows
// it is their turn. NPCs move at once, so their turns leave it run out.
export function createHourglassTurns(
  hourglass: TurnHourglass,
  hud: { state(): PublicWizardGameState | null; turnShown(): boolean },
): HourglassTurns {
  let timing: string | null = null;

  return {
    applyState() {
      const state = hud.state();
      const player = state?.players[state.currentPlayerIndex];
      const key =
        state && player && hud.turnShown() && state.phase !== "finished" && !isBotName(player.username)
          ? moveKey(state)
          : null;
      if (key === timing) return;

      // The timed move was made (or the game ended): run the rest out.
      if (timing !== null) hourglass.finishTurn();
      timing = key;
      if (key !== null) hourglass.startTurn(TURN_HOURGLASS.turnSeconds);
    },
  };
}
