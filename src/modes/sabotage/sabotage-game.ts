import type { PublicWizardGameState } from "../../../backend/src/game/wizard/models/wizardGame";

// Whether the table shows a Sabotage game. Set from the game's first state,
// before the scene is built (pages/Visualizer.ts), so the deck, the layout and
// the torches know which look to take; cleared when the page is left.
let sabotage = false;

export function setSabotageGame(state: Pick<PublicWizardGameState, "options"> | null): void {
  sabotage = state?.options?.mode === "sabotage";
}

export const isSabotageGame = (): boolean => sabotage;
