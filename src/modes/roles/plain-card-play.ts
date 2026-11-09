import type { PublicWizardGameState } from "../../../backend/src/game/wizard/models/wizardGame";

// Roles mode only. A card just played is not showcased (held big in front of
// the trick before it settles; visualizer/table-cards.ts, PLAYED_CARDS.showcase*)
// in a Roles game: swaps and picks follow plays quickly there, and a card still
// on its way to its place made them hard to follow. It goes straight to its
// place instead. Every other mode keeps the showcase.
export function showcasesPlays(state: Pick<PublicWizardGameState, "options"> | null | undefined): boolean {
  return state?.options?.mode !== "roles";
}
