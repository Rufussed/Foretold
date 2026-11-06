import type { PublicWizardGameState } from "../../../../backend/src/game/wizard/models/wizardGame";
import { roleCard, rolesHeld } from "../../../../backend/src/game/wizard/modes/roles/roles";
import { t } from "../../../i18n";
import { displayName } from "../../../utils/display-name";
import { escapeHtml } from "../../../utils/escape-html";
import { levelSealUrl } from "../seal-urls";

// Roles mode only. A Roles button beside the Log button (visualizer/hud/
// event-log.ts) opens a see-through panel over the player list with the
// roles at this table: each player, starting with you and going clockwise
// round the table as play does (a spectator sees the game's own order), with
// their role's seal in their level with it, card number and power. Roles are kept all
// game, so the list is the same from start to end. The panel and the Log
// share their place: opening one closes the other.

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
  // state.players is turn order, which runs clockwise round the table (see
  // computeSeatAssignments); start it at the local player.
  const local = state.players.findIndex((player) => player.username === localUsername);
  const players = local === -1 ? state.players : [...state.players.slice(local), ...state.players.slice(0, local)];

  panel.innerHTML = `<ol class="table-roles-list">${players
    // One line per role held: two in a basic + master game.
    .flatMap((player) => rolesHeld(player).map((role) => ({ player, role })))
    .map(({ player, role }) => {
      const card = roleCard(role);
      const seal = levelSealUrl(role, role === player.masterRole ? player.masterSealLevel : player.sealLevel);
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
    // Text selected in it goes with it, so no hidden selection is left behind.
    const selection = window.getSelection();
    if (!open && selection && panel.contains(selection.anchorNode)) selection.removeAllRanges();
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
