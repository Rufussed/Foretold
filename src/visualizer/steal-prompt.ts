import type { Card } from "../../backend/src/game/wizard/models/card";
import { stealSpots } from "../../backend/src/game/wizard/modes/roles/thief";
import { trumpColor } from "./card-textures";
import { isLocalTurn, localPlayer, type GameConnection } from "./game-connection";
import { t } from "../i18n";
import { announcedName, cardName } from "./hud/announcements";

export interface StealPrompt {
  // Before the local player's card is sent: the place in the trick of the
  // card their Thief's trump 1 takes, picked from a row of buttons: once
  // played, the 1 must take one. Undefined when there is nothing to choose,
  // null when the turn passed before a choice, e.g. when time ran out.
  ask(cardIndex: number): Promise<number | null | undefined>;
  // Call after every game-state update; closes the prompt once the turn has
  // passed, e.g. when time ran out.
  applyState(): void;
  dispose(): void;
}

// The places a trump 1 just played by the local player could take from.
function spotsFor(game: GameConnection, card: Card): number[] {
  const state = game.state();
  if (!state) return [];
  const local = game.localUsername;
  const roleOf = (username: string) => state.players.find((player) => player.username === username)?.role ?? undefined;
  return stealSpots(
    [...state.currentTrick.playedCards, { username: local, playedBy: local, card }],
    state.trumpSuit,
    roleOf,
  );
}

// "Steal a Card": in a Roles game, a Thief playing their 1 as a trump picks
// which card already played to take, from a row of buttons like the Fisher's.
// The choice goes to the server with the card, as play_card's stealSpot.
export function createStealPrompt(root: HTMLElement, game: GameConnection): StealPrompt {
  const modal = document.createElement("section");
  modal.className = "prediction-modal trump-modal";
  modal.setAttribute("role", "dialog");
  modal.setAttribute("aria-labelledby", "steal-title");
  modal.hidden = true;
  modal.innerHTML = `
    <h2 id="steal-title">${t("game.stealCard")}</h2>
    <p class="prediction-round">${t("game.stealHint")}</p>
    <div class="trump-options"></div>
  `;
  root.append(modal);

  const optionsEl = modal.querySelector<HTMLDivElement>(".trump-options")!;
  let answer: ((spot: number | null) => void) | null = null;

  const close = (spot: number | null) => {
    modal.hidden = true;
    const resolve = answer;
    answer = null;
    resolve?.(spot);
  };

  optionsEl.addEventListener("click", (event) => {
    const button = (event.target as HTMLElement).closest<HTMLButtonElement>("[data-spot]");
    if (!button) return;
    close(Number(button.dataset.spot));
  });

  return {
    ask(cardIndex) {
      const card = localPlayer(game)?.hand[cardIndex];
      const spots = card ? spotsFor(game, card) : [];
      if (spots.length < 2) return Promise.resolve(undefined);

      const playedCards = game.state()!.currentTrick.playedCards;
      optionsEl.replaceChildren(
        ...spots.map((spot) => {
          const played = playedCards[spot]!;
          const button = document.createElement("button");
          button.type = "button";
          button.dataset.spot = String(spot);
          const swatch = document.createElement("span");
          swatch.className = "trump-swatch";
          swatch.style.background = trumpColor(played.card.suit);
          const name = document.createElement("span");
          name.textContent = `${cardName(played.card)} · ${announcedName(played.username)}`;
          button.append(swatch, name);
          return button;
        }),
      );
      close(null);
      modal.hidden = false;
      return new Promise((resolve) => {
        answer = resolve;
      });
    },

    applyState() {
      if (answer && (game.state()?.phase !== "playing" || !isLocalTurn(game))) close(null);
    },

    dispose() {
      close(null);
      modal.remove();
    },
  };
}
