import { announcedName } from "./hud/announcements";
import type { ThiefHeist } from "./thief-heist";
import { t } from "../i18n";

export interface ThiefPrompt {
  // Call after every game-state update and whenever the heist's step changes.
  applyState(): void;
  dispose(): void;
}

export interface ThiefPromptOptions {
  // The Thief's choices, once the card table exists.
  heist(): ThiefHeist | null;
  // While true the prompt stays closed, e.g. until your turn has been shown.
  blocked?(): boolean;
}

// Centre of the screen after you win a trick with the Thief: only the buttons,
// a player to swap with each, and Pass, which is offered only here. What to do at each step is
// said in the announcement box (see thief-instruction.ts), and the cards
// themselves are picked on the table. Like the other prompts it has no
// backdrop, so the table stays in view.
export function createThiefPrompt(root: HTMLElement, options: ThiefPromptOptions): ThiefPrompt {
  const modal = document.createElement("section");
  modal.className = "prediction-modal power-modal";
  modal.setAttribute("role", "dialog");
  modal.hidden = true;
  modal.innerHTML = `
    <div class="power-targets"></div>
    <div class="power-actions"></div>
  `;
  root.append(modal);

  const targetsEl = modal.querySelector<HTMLDivElement>(".power-targets")!;
  const actionsEl = modal.querySelector<HTMLDivElement>(".power-actions")!;

  // What the prompt is built for, so it is rebuilt only when that changes.
  let builtFor = "";

  const button = (label: string, className = ""): HTMLButtonElement => {
    const element = document.createElement("button");
    element.type = "button";
    element.textContent = label;
    if (className) element.className = className;
    return element;
  };

  modal.addEventListener("click", (event) => {
    const heist = options.heist();
    const clicked = event.target as HTMLElement;
    if (!heist) return;

    const chosen = clicked.closest<HTMLButtonElement>("[data-target]");
    if (chosen?.dataset.target) {
      heist.chooseTarget(chosen.dataset.target);
      return;
    }

    const action = clicked.closest<HTMLButtonElement>("[data-action]")?.dataset.action;
    if (action === "skip") heist.pass();
  });

  function applyState() {
    const heist = options.heist();
    const step = heist?.step() ?? "idle";

    // Offered once, with the players; the card choices are made on the table.
    if (!heist || step !== "target" || options.blocked?.()) {
      modal.hidden = true;
      builtFor = "";
      return;
    }

    const key = heist.targets().join(",");
    if (builtFor !== key) {
      builtFor = key;
      targetsEl.replaceChildren(
        ...heist.targets().map((name) => {
          const choice = button(announcedName(name));
          choice.dataset.target = name;
          return choice;
        }),
      );
      const skip = button(t("game.powerSkip"), "power-skip");
      skip.dataset.action = "skip";
      actionsEl.replaceChildren(skip);
    }

    modal.hidden = false;
  }

  return {
    applyState,
    dispose() {
      modal.remove();
    },
  };
}
