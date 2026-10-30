import { canAct, isLocalTurn, localPlayer, type GameConnection } from "./game-connection";
import { announcedName, powerName } from "./hud/announcements";
import { t } from "../i18n";

export interface PowerPrompt {
  // Call after every game-state update; opens or closes the prompt.
  applyState(): void;
  // The server refused an action; if a choice was on its way, say why.
  refused(message: string): void;
  dispose(): void;
}

export interface PowerPromptOptions {
  // While true the prompt stays closed, e.g. until your turn has been shown.
  blocked?(): boolean;
}

// Centre of the screen after you win a trick with a Seer or a Trickster. The
// Seer offers your own prediction one lower, as it stands and one higher; the
// Trickster first asks whose prediction, then offers theirs the same way. The
// ends of 0 to the round's tricks are left out. Picking the number already
// held means no change, which is sent as `skip_power`; a change is sent as
// `use_power`. Like the other prompts it has no backdrop, so the table stays
// in view.
export function createPowerPrompt(
  root: HTMLElement,
  game: GameConnection,
  options: PowerPromptOptions = {},
): PowerPrompt {
  const modal = document.createElement("section");
  modal.className = "prediction-modal power-modal";
  modal.setAttribute("role", "dialog");
  modal.setAttribute("aria-labelledby", "power-title");
  modal.hidden = true;
  modal.innerHTML = `
    <h2 id="power-title"></h2>
    <p class="prediction-round"></p>
    <div class="power-targets"></div>
    <div class="prediction-options"></div>
    <div class="power-actions"></div>
    <p class="prediction-error" role="alert"></p>
  `;
  root.append(modal);

  const titleEl = modal.querySelector<HTMLElement>("#power-title")!;
  const promptEl = modal.querySelector<HTMLParagraphElement>(".prediction-round")!;
  const targetsEl = modal.querySelector<HTMLDivElement>(".power-targets")!;
  const optionsEl = modal.querySelector<HTMLDivElement>(".prediction-options")!;
  const actionsEl = modal.querySelector<HTMLDivElement>(".power-actions")!;
  const errorEl = modal.querySelector<HTMLParagraphElement>(".prediction-error")!;

  // Which choice the prompt is built for, so it is rebuilt only when that changes.
  let builtFor = "";
  // The Trickster's chosen player, once chosen; null while still choosing.
  let target: string | null = null;
  let sending = false;

  const setButtonsEnabled = (enabled: boolean) => {
    for (const button of modal.querySelectorAll("button")) button.disabled = !enabled;
  };

  const button = (label: string, className = ""): HTMLButtonElement => {
    const element = document.createElement("button");
    element.type = "button";
    element.textContent = label;
    if (className) element.className = className;
    return element;
  };

  const send = (message: object, chosen: HTMLButtonElement) => {
    errorEl.textContent = "";
    if (!game.send(message)) {
      errorEl.textContent = t("game.notConnected");
      return;
    }
    sending = true;
    setButtonsEnabled(false);
    chosen.classList.add("is-chosen");
    // Close straight away: the table may still be showing earlier moves when
    // the server's answer arrives. It reopens if the server refuses.
    modal.hidden = true;
  };

  // The one lower, the same, and the one higher, kept within 0 to the tricks.
  const buildNumbers = (whose: string, current: number, tricks: number) => {
    targetsEl.replaceChildren();
    actionsEl.replaceChildren();
    optionsEl.replaceChildren(
      ...[current - 1, current, current + 1]
        .filter((value) => value >= 0 && value <= tricks)
        .map((value) => {
          const choice = button(String(value), value === current ? "is-current" : "");
          choice.dataset.prediction = String(value);
          choice.title = value === current ? t("game.powerNoChange") : "";
          return choice;
        }),
    );
    optionsEl.dataset.whose = whose;
  };

  const buildTargets = (names: string[], predictions: Map<string, number>) => {
    optionsEl.replaceChildren();
    targetsEl.replaceChildren(
      ...names.map((name) => {
        const choice = button(`${announcedName(name)} · ${predictions.get(name)}`);
        choice.dataset.target = name;
        return choice;
      }),
    );
  };

  const buildActions = (withBack: boolean) => {
    actionsEl.replaceChildren();
    if (withBack) {
      const back = button(t("game.powerBack"), "power-back");
      back.dataset.action = "back";
      actionsEl.append(back);
    }
    const skip = button(t("game.powerSkip"), "power-skip");
    skip.dataset.action = "skip";
    actionsEl.append(skip);
  };

  modal.addEventListener("click", (event) => {
    const clicked = event.target as HTMLElement;
    const state = game.state();
    const power = state?.currentTrick.power;
    if (!state || !power || sending) return;

    const chosenTarget = clicked.closest<HTMLButtonElement>("[data-target]");
    if (chosenTarget) {
      target = chosenTarget.dataset.target ?? null;
      builtFor = "";
      applyState();
      return;
    }

    const action = clicked.closest<HTMLButtonElement>("[data-action]");
    if (action) {
      if (action.dataset.action === "back") {
        target = null;
        builtFor = "";
        applyState();
      } else {
        send({ type: "skip_power" }, action);
      }
      return;
    }

    const number = clicked.closest<HTMLButtonElement>("[data-prediction]");
    if (!number) return;
    const value = Number(number.dataset.prediction);
    const whose = power.kind === "seer" ? game.localUsername : target;
    const held = state.players.find((player) => player.username === whose)?.prediction;

    // The number already held changes nothing.
    if (value === held || !whose) {
      send({ type: "skip_power" }, number);
      return;
    }
    send(power.kind === "seer" ? { type: "use_power", prediction: value } : { type: "use_power", target: whose, prediction: value }, number);
  });

  function applyState() {
    const state = game.state();
    const power = state?.currentTrick.power;
    const open =
      state?.phase === "power" &&
      !!power &&
      power.kind !== "thief" &&
      !power.resolved &&
      power.username === game.localUsername &&
      canAct(game) &&
      isLocalTurn(game) &&
      !options.blocked?.();

    if (!state || !power || !open) {
      modal.hidden = true;
      sending = false;
      target = null;
      builtFor = "";
      errorEl.textContent = "";
      return;
    }

    const me = localPlayer(game);
    const tricks = state.currentRound;
    const opponents = state.players.filter((player) => player.username !== game.localUsername && player.prediction !== null);
    const key = [
      state.currentRound,
      power.kind,
      state.players.map((player) => `${player.tricksWon}/${player.prediction}`).join(","),
      target ?? "",
    ].join(":");

    titleEl.textContent = powerName(power.kind);

    if (builtFor !== key) {
      builtFor = key;
      if (power.kind === "seer") {
        promptEl.textContent = t("game.seerPrompt");
        buildNumbers(game.localUsername, me?.prediction ?? 0, tricks);
        buildActions(false);
      } else if (target === null) {
        promptEl.textContent = t("game.tricksterPrompt");
        buildTargets(
          opponents.map((player) => player.username),
          new Map(opponents.map((player) => [player.username, player.prediction as number])),
        );
        buildActions(false);
      } else {
        const chosen = state.players.find((player) => player.username === target);
        promptEl.textContent = t("game.tricksterNumbers", {
          name: announcedName(target),
          count: String(chosen?.prediction ?? 0),
        });
        buildNumbers(target, chosen?.prediction ?? 0, tricks);
        buildActions(true);
      }
    }

    if (sending) return;
    setButtonsEnabled(true);
    modal.hidden = false;
  }

  return {
    applyState,

    refused(message) {
      if (!sending) return;
      sending = false;
      setButtonsEnabled(true);
      for (const chosen of modal.querySelectorAll(".is-chosen")) chosen.classList.remove("is-chosen");
      errorEl.textContent = message;
      modal.hidden = false;
    },

    dispose() {
      modal.remove();
    },
  };
}
