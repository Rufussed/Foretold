import { cardKey } from "../../../visualizer/card-textures";
import { localPlayer, type GameConnection } from "../../../visualizer/game-connection";

export interface RolesDevKeys {
  dispose(): void;
}

// Dev-only, for trying a role without waiting for its card: Shift+Q turns the
// card you are pointing at, or else the one you have raised (your first card
// if none), into your role's card in trumps; Shift+W into your role's card in
// a plain suit, which is also the one to use in a round with no trumps. Lead
// the plain one to have its power on. The server honours it only when run with
// WIZARD_DEV_TOOLS (npm run play, or npm run dev:tools in backend/).
export function createRolesDevKeys(game: GameConnection, selected: () => string | null): RolesDevKeys {
  const onKey = (event: KeyboardEvent) => {
    if (event.repeat || event.ctrlKey || event.metaKey || event.altKey || !event.shiftKey) return;
    if (event.code !== "KeyQ" && event.code !== "KeyW") return;
    const key = selected();
    const cardIndex = Math.max(0, localPlayer(game)?.hand.findIndex((card) => cardKey(card) === key) ?? 0);
    game.send({ type: "dev_role_card", trump: event.code === "KeyQ", cardIndex });
  };

  window.addEventListener("keydown", onKey);
  return { dispose: () => window.removeEventListener("keydown", onKey) };
}
