import { SEER_VALUE, THIEF_VALUE, TRICKSTER_VALUE } from "../../backend/src/game/wizard/models/card";
import { cardKey } from "./card-textures";
import { localPlayer, type GameConnection } from "./game-connection";

export interface DevThiefKey {
  dispose(): void;
}

// Dev-only: Shift+Q, Shift+W and Shift+E turn the card you are pointing at, or
// else the one you have raised, into a Thief, Trickster or Seer of the trump suit (your first
// card if none), and Shift+R and Shift+T into a Fool or a Wizard of its own
// suit, at any time, for trying them. The server honours it
// only when run by `npm run play`. Play it first in a trick, in a round of more
// than one card, to win with it.
const KEYS: Record<string, number> = {
  KeyR: 0,
  KeyT: 14,
  KeyQ: THIEF_VALUE,
  KeyW: TRICKSTER_VALUE,
  KeyE: SEER_VALUE,
};

export function createDevThiefKey(game: GameConnection, selected: () => string | null): DevThiefKey {
  const onKey = (event: KeyboardEvent) => {
    if (event.repeat || event.ctrlKey || event.metaKey || event.altKey || !event.shiftKey) return;
    const value = KEYS[event.code];
    if (value === undefined) return;
    const key = selected();
    const cardIndex = Math.max(0, localPlayer(game)?.hand.findIndex((card) => cardKey(card) === key) ?? 0);
    game.send({ type: "dev_give_card", value, cardIndex });
  };

  window.addEventListener("keydown", onKey);
  return { dispose: () => window.removeEventListener("keydown", onKey) };
}
