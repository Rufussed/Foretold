import type { Suit } from "../../backend/src/game/wizard/models/card";
import { trumpColor } from "./card-textures";
import { CARDS } from "./config";
import { canAct, isLocalTurn, type GameConnection } from "./game-connection";

export interface TrumpPrompt {
  // Call after every game-state update; opens or closes the prompt.
  applyState(): void;
  // The server refused an action; if a choice was on its way, say why.
  refused(message: string): void;
  dispose(): void;
}

export interface TrumpPromptOptions {
  // While true the prompt stays closed, e.g. until every card has been dealt.
  blocked?(): boolean;
}

// "Choose Trumps": when the card turned up for trump is a Wizard or a Jester,
// the round's first player picks the suit from four swatches in the suit
// colours. The choice goes to the server as `choose_trump`. Sits where the
// prediction prompt does, which follows it.
export function createTrumpPrompt(
  root: HTMLElement,
  game: GameConnection,
  options: TrumpPromptOptions = {},
): TrumpPrompt {
  const modal = document.createElement("section");
  modal.className = "prediction-modal trump-modal";
  modal.setAttribute("role", "dialog");
  modal.setAttribute("aria-labelledby", "trump-title");
  modal.hidden = true;
  modal.innerHTML = `
    <h2 id="trump-title">Choose Trumps</h2>
    <p class="prediction-round"></p>
    <div class="trump-options"></div>
    <p class="prediction-error" role="alert"></p>
  `;
  root.append(modal);

  const reasonEl = modal.querySelector<HTMLParagraphElement>(".prediction-round")!;
  const optionsEl = modal.querySelector<HTMLDivElement>(".trump-options")!;
  const errorEl = modal.querySelector<HTMLParagraphElement>(".prediction-error")!;

  // In the same order as the Wizard and Jester gradient.
  optionsEl.replaceChildren(
    ...CARDS.specialCardGradient.map((suit) => {
      const button = document.createElement("button");
      button.type = "button";
      button.dataset.suit = suit;
      button.setAttribute("aria-label", suit);
      const swatch = document.createElement("span");
      swatch.className = "trump-swatch";
      swatch.style.background = trumpColor(suit);
      const name = document.createElement("span");
      name.textContent = suit;
      button.append(swatch, name);
      return button;
    }),
  );

  let sending = false;
  const setButtonsEnabled = (enabled: boolean) => {
    for (const button of optionsEl.querySelectorAll("button")) button.disabled = !enabled;
  };

  optionsEl.addEventListener("click", (event) => {
    const button = (event.target as HTMLElement).closest<HTMLButtonElement>("[data-suit]");
    if (!button || sending) return;

    errorEl.textContent = "";
    if (!game.send({ type: "choose_trump", suit: button.dataset.suit as Suit })) {
      errorEl.textContent = "Not connected to the game.";
      return;
    }
    sending = true;
    setButtonsEnabled(false);
    button.classList.add("is-chosen");
  });

  return {
    applyState() {
      const state = game.state();
      const open = state?.phase === "trump-selection" && canAct(game) && isLocalTurn(game) && !options.blocked?.();

      if (!state || !open) {
        modal.hidden = true;
        sending = false;
        errorEl.textContent = "";
        for (const button of optionsEl.querySelectorAll(".is-chosen")) button.classList.remove("is-chosen");
        return;
      }

      const turnedUp = state.trumpCard?.value === 14 ? "A Wizard" : "A Jester";
      reasonEl.textContent = `${turnedUp} was turned up for trumps: pick the suit.`;
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
