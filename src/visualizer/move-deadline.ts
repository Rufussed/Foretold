import type { PublicWizardGameState } from "../../backend/src/game/wizard/models/wizardGame";

// One move: who, in which phase, and how far into the round. The trick count
// tells apart a player leading two tricks in a row.
export const moveKey = (state: PublicWizardGameState): string => {
  const tricks = state.players.reduce((sum, player) => sum + player.tricksWon, 0);
  return [
    state.currentRound,
    state.phase,
    state.currentPlayerIndex,
    tricks,
    state.currentTrick.playedCards.length,
  ].join(":");
};

// A move's deadline (the server's turnDeadlineAt), from whichever of these
// snapshots is of that move and has it. The server sets the deadline a moment
// after the move begins, so the newest snapshot can carry it before the
// table has caught up.
export const deadlineOf = (
  key: string,
  states: ReadonlyArray<PublicWizardGameState | null>,
): number | null => {
  for (const state of states) {
    if (state && state.turnDeadlineAt !== null && moveKey(state) === key) {
      return state.turnDeadlineAt;
    }
  }
  return null;
};
