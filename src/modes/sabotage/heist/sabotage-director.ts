import type { PublicWizardGameState } from "../../../../backend/src/game/wizard/models/wizardGame";

// What the table director (visualizer/table-director.ts) needs to know about
// a Sabotage Thief between two game states.

// The same move as before, but for the player a Thief's winner has chosen so
// far: the camera is on that player and must not be turned back.
export const onlyThiefTargetChanged = (previous: PublicWizardGameState, next: PublicWizardGameState): boolean => {
  const before = previous.currentTrick.sabotagePower;
  const after = next.currentTrick.sabotagePower;
  if (before?.kind !== "thief" || after?.kind !== "thief" || before.resolved || after.resolved) return false;
  const bare = (state: PublicWizardGameState) =>
    JSON.stringify({
      ...state,
      turnDeadlineAt: null,
      currentTrick: { ...state.currentTrick, sabotagePower: { ...state.currentTrick.sabotagePower, target: null } },
    });
  return bare(previous) === bare(next);
};

// A Thief's swap has happened: both cards are in their new hands.
export const thiefSwapped = (state: PublicWizardGameState | null): boolean => {
  const power = state?.currentTrick.sabotagePower;
  return power?.kind === "thief" && power.resolved && power.targetIndex != null;
};

// Only the cards in hand differ: a test shortcut swapped one, so the table
// just shows it, with no turn to replay.
export const onlyHandsChanged = (previous: PublicWizardGameState, next: PublicWizardGameState): boolean => {
  const bare = (state: PublicWizardGameState) =>
    JSON.stringify({ ...state, turnDeadlineAt: null, players: state.players.map((p) => ({ ...p, hand: null })) });
  return bare(previous) === bare(next) && JSON.stringify(previous.players) !== JSON.stringify(next.players);
};
