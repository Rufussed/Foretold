// One piece of the in-game overlay, refreshed from game state.
export interface HudPart {
  // Call after every game-state update.
  applyState(): void;
  dispose(): void;
}
