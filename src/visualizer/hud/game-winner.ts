import type { PublicWizardGameState } from "../../../backend/src/game/wizard/models/wizardGame";
import { characterForPlayer } from "../seat-mapping";
import { headshotUrl } from "./headshots";

// The players on the game's top score: one winner, or everyone tied for it.
export function gameWinners(state: PublicWizardGameState) {
  const best = Math.max(...state.players.map((player) => player.score));
  return state.players.filter((player) => player.score === best);
}

// Under the game-over announcement: a large headshot of the winner with a big
// crown on top. A tie shows everyone on the top score, without crowns.
export function createGameWinner(container: HTMLElement, state: PublicWizardGameState): { dispose(): void } {
  const winners = gameWinners(state);
  const element = document.createElement("div");
  element.className = "hud-game-winner";
  element.classList.toggle("is-tie", winners.length > 1);
  let disposed = false;

  for (const player of winners) {
    const figure = document.createElement("figure");
    figure.className = "hud-game-winner-face";
    const image = document.createElement("img");
    image.alt = player.username;
    figure.append(image);
    element.append(figure);
    headshotUrl(characterForPlayer(player))
      .then((url) => {
        if (!disposed) image.src = url;
      })
      .catch((error) => console.warn("[winner] no headshot:", error));
  }

  container.append(element);
  return {
    dispose() {
      disposed = true;
      element.remove();
    },
  };
}
