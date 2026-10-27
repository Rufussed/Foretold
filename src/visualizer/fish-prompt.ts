import type { PublicWizardGameState } from "../../backend/src/game/wizard/models/wizardGame";
import { fishingSpots } from "../../backend/src/game/wizard/modes/roles/fisher";
import { playerOf, type RoleOf } from "../../backend/src/game/wizard/modes/roles/rolePlay";
import { trumpColor } from "./card-textures";
import { canAct, isLocalTurn, type GameConnection } from "./game-connection";
import { t } from "../i18n";
import { announcedName, cardName } from "./hud/announcements";

export interface FishPrompt {
  // Call after every game-state update; opens or closes the prompt.
  applyState(): void;
  // The server refused an action; if a choice was on its way, say why.
  refused(message: string): void;
  dispose(): void;
}

export interface FishPromptOptions {
  // While true the prompt stays closed, e.g. until your turn is shown.
  blocked?(): boolean;
}

// The cards the local Fisher may fish, by place in the trick.
function spotsFor(state: PublicWizardGameState, local: string): number[] {
  const playedCards = state.currentTrick.playedCards;
  const roleOf: RoleOf = (username) =>
    state.players.find((player) => player.username === username)?.role ?? undefined;
  const three = playedCards.findIndex((played) => playerOf(played) === local);
  return fishingSpots(playedCards, three, state.trumpSuit, roleOf);
}

// "Fish a card": in a Roles game, once a trick is complete, a Fisher whose 3
// has its power on picks one card played after it, from a row of buttons
// like the trump choice. The choice goes to the server as `fish_card`. For
// now a HUD row; picking the card on the table itself can come later.
export function createFishPrompt(
  root: HTMLElement,
  game: GameConnection,
  options: FishPromptOptions = {},
): FishPrompt {
  const modal = document.createElement("section");
  modal.className = "prediction-modal trump-modal";
  modal.setAttribute("role", "dialog");
  modal.setAttribute("aria-labelledby", "fish-title");
  modal.hidden = true;
  modal.innerHTML = `
    <h2 id="fish-title">${t("game.fishCard")}</h2>
    <p class="prediction-round">${t("game.fishHint")}</p>
    <div class="trump-options"></div>
    <p class="prediction-error" role="alert"></p>
  `;
  root.append(modal);

  const optionsEl = modal.querySelector<HTMLDivElement>(".trump-options")!;
  const errorEl = modal.querySelector<HTMLParagraphElement>(".prediction-error")!;

  let sending = false;
  // The spots the buttons show, so they're only rebuilt when those change.
  let shown = "";
  const setButtonsEnabled = (enabled: boolean) => {
    for (const button of optionsEl.querySelectorAll("button")) button.disabled = !enabled;
  };

  const showSpots = (state: PublicWizardGameState, spots: number[]) => {
    const key = spots.join(",");
    if (key === shown) return;
    shown = key;
    optionsEl.replaceChildren(
      ...spots.map((spot) => {
        const played = state.currentTrick.playedCards[spot]!;
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
  };

  optionsEl.addEventListener("click", (event) => {
    const button = (event.target as HTMLElement).closest<HTMLButtonElement>("[data-spot]");
    if (!button || sending) return;

    errorEl.textContent = "";
    if (!game.send({ type: "fish_card", spot: Number(button.dataset.spot) })) {
      errorEl.textContent = t("game.notConnected");
      return;
    }
    sending = true;
    setButtonsEnabled(false);
    button.classList.add("is-chosen");
  });

  return {
    applyState() {
      const state = game.state();
      const open = state?.phase === "fishing" && canAct(game) && isLocalTurn(game) && !options.blocked?.();
      const spots = state && open ? spotsFor(state, game.localUsername) : [];

      if (!state || !spots.length) {
        modal.hidden = true;
        sending = false;
        shown = "";
        errorEl.textContent = "";
        return;
      }

      showSpots(state, spots);
      if (!sending) setButtonsEnabled(true);
      modal.hidden = false;
    },

    refused(message) {
      if (!sending) return;
      sending = false;
      setButtonsEnabled(true);
      for (const button of optionsEl.querySelectorAll(".is-chosen")) button.classList.remove("is-chosen");
      errorEl.textContent = message;
    },

    dispose() {
      modal.remove();
    },
  };
}
