import { localPlayer, type GameConnection } from "../game-connection";
import type { HudPart } from "./hud-part";
import { createRoundStat } from "./round-stats";

// Bottom right, beside your portrait: your prediction and tricks won this round.
export function createSelfRoundStats(root: HTMLElement, game: GameConnection): HudPart {
  const box = document.createElement("section");
  box.className = "hud-panel hud-self";
  box.setAttribute("aria-label", "Your round");
  box.hidden = true;

  const prediction = createRoundStat("Prediction");
  const won = createRoundStat("Won");
  box.append(prediction.element, won.element);
  root.append(box);

  return {
    applyState() {
      const me = localPlayer(game);
      if (!me) {
        box.hidden = true;
        return;
      }
      prediction.set(me.prediction);
      won.set(me.tricksWon);
      box.hidden = false;
    },

    dispose() {
      box.remove();
    },
  };
}
