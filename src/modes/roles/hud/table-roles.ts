import type { PublicWizardGameState } from "../../../../backend/src/game/wizard/models/wizardGame";
import { roleCard } from "../../../../backend/src/game/wizard/modes/roles/roles";
import { t } from "../../../i18n";
import { displayName } from "../../../utils/display-name";
import { escapeHtml } from "../../../utils/escape-html";
import { roleSealUrl } from "../seal-urls";

// Roles mode only. A Roles button beside the Log button (visualizer/hud/
// event-log.ts) opens a see-through panel over the player list with the
// roles at this table: each player, in seating order, with their role's
// seal, card number and power. Roles are kept all game, so the list is the
// same from start to end. The panel and the Log share their place: opening
// one closes the other.

export interface TableRoles {
  dispose(): void;
}

export function createTableRoles(
  page: HTMLElement,
  state: PublicWizardGameState,
  localUsername: string,
): TableRoles {
  const logButton = page.querySelector<HTMLButtonElement>(".event-log-toggle");
  const logPanel = page.querySelector<HTMLElement>(".event-log");

  const button = document.createElement("button");
  button.type = "button";
  button.className = "event-log-toggle table-roles-toggle";
  button.textContent = t("game.tableRoles");
  button.setAttribute("aria-expanded", "false");
  page.append(button);

  const panel = document.createElement("section");
  panel.className = "event-log table-roles";
  panel.setAttribute("aria-label", t("game.tableRoles"));
  panel.hidden = true;
  panel.innerHTML = `<ol class="table-roles-list">${state.players
    .filter((player) => player.role)
    .map((player) => {
      const role = player.role!;
      const card = roleCard(role);
      const seal = roleSealUrl(role);
      const own = player.username === localUsername;
      return `
        <li class="table-roles-item${own ? " is-own" : ""}">
          ${seal ? `<img class="table-roles-seal" src="${seal}" alt="" />` : ""}
          <div>
            <p class="table-roles-name">
              ${escapeHtml(displayName(player.username))}
              <span class="table-roles-role">${card === null ? "" : `${card} · `}${t(`role.${role}`)}</span>
            </p>
            <p class="table-roles-power">${t(`role.${role}.power`)}</p>
          </div>
        </li>
      `;
    })
    .join("")}</ol>`;
  page.append(panel);

  const show = (open: boolean) => {
    panel.hidden = !open;
    button.setAttribute("aria-expanded", String(open));
  };

  // Right of the Log button, at its height; the panel where the Log's goes.
  const place = () => {
    if (!logButton) return;
    button.style.bottom = logButton.style.bottom;
    button.style.left = `${logButton.offsetLeft + logButton.offsetWidth + 8}px`;
    panel.style.bottom = `${Math.round(parseFloat(logButton.style.bottom || "0") + logButton.offsetHeight + 8)}px`;
  };
  let frame = 0;
  const track = () => {
    place();
    frame = requestAnimationFrame(track);
  };
  track();

  const toggle = () => {
    const open = panel.hidden !== false;
    // Opening this closes the Log, which shares the place.
    if (open && logPanel && !logPanel.hidden) logButton?.click();
    show(open);
  };
  // Opening the Log closes this.
  const onLog = () => show(false);
  button.addEventListener("click", toggle);
  logButton?.addEventListener("click", onLog);

  return {
    dispose() {
      cancelAnimationFrame(frame);
      button.removeEventListener("click", toggle);
      logButton?.removeEventListener("click", onLog);
      button.remove();
      panel.remove();
    },
  };
}
