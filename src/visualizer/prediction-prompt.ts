import { isLocalTurn, localPlayer, type GameConnection } from "./game-connection";

export interface PredictionPrompt {
  // Call after every game-state update; opens or closes the prompt.
  applyState(): void;
  // The server refused an action; if a prediction was on its way, say why.
  refused(message: string): void;
  dispose(): void;
}

// "Your Prediction?" at the start of a round, when it's your turn to bid: one
// button for every number of tricks you could win, from 0 up to the cards
// dealt this round. The choice goes to the server as `submit_prediction`, as
// the text interface sends it. There's no backdrop, so the table and your hand
// stay usable while you decide.
export interface PredictionPromptOptions {
  // While true the prompt stays closed, e.g. until every card has been dealt.
  blocked?(): boolean;
}

export function createPredictionPrompt(
  root: HTMLElement,
  game: GameConnection,
  options: PredictionPromptOptions = {},
): PredictionPrompt {
  const modal = document.createElement("section");
  modal.className = "prediction-modal";
  modal.setAttribute("role", "dialog");
  modal.setAttribute("aria-labelledby", "prediction-title");
  modal.hidden = true;
  modal.innerHTML = `
    <h2 id="prediction-title">Your Prediction?</h2>
    <p class="prediction-round"></p>
    <div class="prediction-options"></div>
    <p class="prediction-error" role="alert"></p>
  `;
  root.append(modal);

  const roundEl = modal.querySelector<HTMLParagraphElement>(".prediction-round")!;
  const optionsEl = modal.querySelector<HTMLDivElement>(".prediction-options")!;
  const errorEl = modal.querySelector<HTMLParagraphElement>(".prediction-error")!;

  let builtForRound = 0;
  let sending = false;

  const setButtonsEnabled = (enabled: boolean) => {
    for (const button of optionsEl.querySelectorAll("button")) button.disabled = !enabled;
  };

  const buildOptions = (cardsDealt: number) => {
    optionsEl.replaceChildren(
      ...Array.from({ length: cardsDealt + 1 }, (_, tricks) => {
        const button = document.createElement("button");
        button.type = "button";
        button.textContent = String(tricks);
        button.dataset.prediction = String(tricks);
        return button;
      }),
    );
    builtForRound = cardsDealt;
  };

  optionsEl.addEventListener("click", (event) => {
    const button = (event.target as HTMLElement).closest<HTMLButtonElement>("[data-prediction]");
    if (!button || sending) return;

    errorEl.textContent = "";
    if (!game.send({ type: "submit_prediction", prediction: Number(button.dataset.prediction) })) {
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
      const open =
        state?.phase === "predictions" &&
        isLocalTurn(game) &&
        localPlayer(game)?.prediction === null &&
        !options.blocked?.();

      if (!state || !open) {
        modal.hidden = true;
        sending = false;
        errorEl.textContent = "";
        return;
      }

      // The round number is also the number of cards dealt.
      const cardsDealt = state.currentRound;
      if (builtForRound !== cardsDealt) buildOptions(cardsDealt);
      roundEl.textContent = `Round ${state.currentRound} of ${state.totalRounds} · ${cardsDealt} ${cardsDealt === 1 ? "card" : "cards"}`;
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
