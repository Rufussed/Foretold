import { rolesOfKind, type RoleId, type RoleKind } from "../../../backend/src/game/wizard/modes/roles/roles";
import {
  SEAL_LEVELS,
  sealPoints,
  sealState,
  type RoleRecord,
  type SealLevelId,
} from "../../../backend/src/game/wizard/modes/roles/sealLevels";
import { t } from "../../i18n";
import { API_BASE } from "../../services/api";
import { openInfoWindow } from "../../components/info-window";
import { levelSealUrl, roleSealUrl } from "./seal-urls";

// Roles mode only. The Profile's Seals box (pages/Profile.ts calls it): every
// role's seal, in wax to start with. Each game that counts with a role prints
// its wood seal a little more over the wax, from the bottom up, a fine
// shining line at its edge. After that the seal earned stays whole until the
// next level is reached, and then becomes that level's (hovering a seal names
// the level under way and how far it is). The records come from the server
// (backend modes/roles/roleProgressRoutes.ts), the levels from sealLevels.ts.
//
// Dev only, on your own Profile, with the backend run with WIZARD_DEV_TOOLS
// (npm run play, or npm run dev:tools in backend/): Shift+click a seal for
// one more game with that role, Ctrl+click for one more won game,
// Ctrl+Shift+click to wipe its record.

type Records = Map<RoleId, RoleRecord>;

const progressUrl = (path: string) => `${API_BASE}/roles/progress/${path}`;
const authHeaders = () => ({ Authorization: `Bearer ${localStorage.getItem("wizardToken") ?? ""}` });

// A player's records with each role: yours, or another player's by id. None
// when they cannot be had, so the Profile still shows, its seals empty.
export async function loadRoleRecords(playerId?: number): Promise<RoleRecord[]> {
  try {
    const response = await fetch(progressUrl(playerId === undefined ? "me" : String(playerId)), { headers: authHeaders() });
    return response.ok ? ((await response.json()) as RoleRecord[]) : [];
  } catch {
    return [];
  }
}

const OPEN_KEY = "wizardProfileSeals";

// Open or closed, as the player left it; open the first time.
export function loadSealsOpen(): boolean {
  try {
    return localStorage.getItem(OPEN_KEY) !== "closed";
  } catch {
    return true;
  }
}

export function saveSealsOpen(open: boolean): void {
  try {
    localStorage.setItem(OPEN_KEY, open ? "open" : "closed");
  } catch {
    // Not kept; the page works the same.
  }
}

function renderSeal(role: RoleId, records: Records): string {
  const url = roleSealUrl(role);
  if (!url) return "";
  const record = records.get(role) ?? { role, games: 0, wins: 0 };
  const points = sealPoints(record);
  const { done, next, fill } = sealState(points);
  const art = (level: SealLevelId) => levelSealUrl(role, level) ?? url;
  // Wood, the first level earned, prints from the bottom up over the wax
  // seal every player starts with, a fine shining line at its edge; later
  // levels replace the seal once reached.
  const printing = done === SEAL_LEVELS[0].id && next !== null;
  const percent = `${(fill * 100).toFixed(1)}%`;
  const target = SEAL_LEVELS.find((entry) => entry.id === next)?.at ?? points;
  // Shown on hover, to keep the box small: the level earned, the one under
  // way and how far, and the record. "Merchant: Copper · to Silver 70/90 · …"
  const name = done ? `${t(`role.${role}`)}: ${t(`seals.level.${done}`)}` : t(`role.${role}`);
  const toward = next
    ? ` · ${t("seals.toward", { level: t(`seals.level.${next}`), points: String(points), target: String(target) })}`
    : "";
  const tip = `${name}${toward} · ${t("seals.games", { games: String(record.games), wins: String(record.wins) })}`;

  return `
    <div class="seal-tile seal-at-${done ?? "none"}" data-seal-tip="${tip}" data-seal-role="${role}" tabindex="0">
      <div class="seal-art">
        <img class="seal-base" src="${done ? art(done) : url}" alt="" />
        ${printing ? `<img class="seal-fill" src="${art(next)}" alt="" style="--fill: ${percent}" />` : ""}
        ${printing && fill > 0 ? `<span class="seal-edge" style="--fill: ${percent}; --seal: url(${art(next)})"></span>` : ""}
      </div>
      <span class="seal-name">${t(`role.${role}`)}</span>
    </div>
  `;
}

const KINDS: readonly RoleKind[] = ["basic", "master"];
const TAB_KEY = "wizardProfileSealsTab";

// The group the player last looked at; the basic roles the first time.
function loadTab(): RoleKind {
  try {
    return localStorage.getItem(TAB_KEY) === "master" ? "master" : "basic";
  } catch {
    return "basic";
  }
}

function saveTab(kind: RoleKind): void {
  try {
    localStorage.setItem(TAB_KEY, kind);
  } catch {
    // Not kept; the page works the same.
  }
}

function renderTabs(shown: RoleKind): string {
  const tab = (kind: RoleKind) =>
    `<button class="seal-tab" type="button" role="tab" aria-selected="${kind === shown}" data-seal-tab="${kind}">${t(`seals.${kind}`)}</button>`;
  return `<div class="seal-tabs" role="tablist">${KINDS.map(tab).join("")}</div>`;
}

const renderSeals = (kind: RoleKind, records: Records): string =>
  rolesOfKind(kind).map((role) => renderSeal(role.id, records)).join("");

function renderGroup(kind: RoleKind, shown: RoleKind, records: Records): string {
  return `
    <div class="seal-grid" role="tabpanel" data-seal-group="${kind}" ${kind === shown ? "" : "hidden"}>
      ${renderSeals(kind, records)}
    </div>
  `;
}

// Seals earned beyond the wax everyone starts with.
const earnedCount = (records: Records): string =>
  t("seals.earned", {
    count: String([...records.values()].filter((record) => sealPoints(record) >= SEAL_LEVELS[1].at).length),
  });

const byRole = (records: RoleRecord[]): Records => new Map(records.map((record) => [record.role, record]));

// The box. toggle and body are the Profile's open/close attributes for its
// header and its body.
export function renderSealsCard(records: RoleRecord[], toggle: string, body: string): string {
  const shown = loadTab();
  const known = byRole(records);
  return `
    <article class="profile-card profile-seals">
      <div class="profile-section-heading profile-collapse-toggle" ${toggle}>
        <div>
          <p class="profile-card-kicker">${t("mode.roles")}</p>
          <h2>${t("seals.title")}</h2>
        </div>
        <span class="profile-history-meta">
          <button type="button" class="seals-help-button" data-seals-help data-collapse-ignore aria-label="${t("seals.help.button")}" title="${t("seals.help.button")}">?</button>
          <span class="profile-opponent-count" data-seals-earned>${earnedCount(known)}</span>
          <span class="profile-chevron" aria-hidden="true"></span>
        </span>
      </div>
      <div class="profile-seals-body" ${body}>
        ${renderTabs(shown)}
        ${KINDS.map((kind) => renderGroup(kind, shown, known)).join("")}
      </div>
    </article>
  `;
}

// The tabs: one group of seals shown at a time. And each seal's level and
// record in a tip over it while hovered, kept on the page itself so the
// box's scrolling never cuts it off. own: the player's own Profile, where
// the dev clicks work.
export function setupSeals(container: HTMLElement, own: boolean): void {
  const card = container.querySelector<HTMLElement>(".profile-seals");
  if (!card) return;
  setupTip(container, card);
  card.querySelector("[data-seals-help]")?.addEventListener("click", openSealsHelp);
  const tabs = [...card.querySelectorAll<HTMLButtonElement>("[data-seal-tab]")];
  const groups = [...card.querySelectorAll<HTMLElement>("[data-seal-group]")];
  for (const tab of tabs) {
    tab.addEventListener("click", () => {
      const kind = tab.dataset.sealTab as RoleKind;
      for (const other of tabs) other.setAttribute("aria-selected", String(other === tab));
      for (const group of groups) group.hidden = group.dataset.sealGroup !== kind;
      saveTab(kind);
    });
  }
  if (import.meta.env.DEV && own) setupDevClicks(card, groups);
}

// The window behind the "?": how a seal grows, its steps from sealLevels.ts.
function openSealsHelp(): void {
  const at = Object.fromEntries(SEAL_LEVELS.map((level) => [level.id, String(level.at)]));
  openInfoWindow(
    "roles-help",
    t("seals.help.title"),
    `
      <div class="home-rules-content">
        <section class="home-rules-section">
          <p>${t("seals.help.points")}</p>
          <p>${t("seals.help.levels", at)}</p>
          <p>${t("seals.help.table")}</p>
        </section>
      </div>
    `,
  );
}

// Shows records again, in place: the seals and the count.
function showRecords(card: HTMLElement, groups: HTMLElement[], records: RoleRecord[]): void {
  const known = byRole(records);
  for (const group of groups) group.innerHTML = renderSeals(group.dataset.sealGroup as RoleKind, known);
  const earned = card.querySelector<HTMLElement>("[data-seals-earned]");
  if (earned) earned.textContent = earnedCount(known);
}

function setupDevClicks(card: HTMLElement, groups: HTMLElement[]): void {
  card.addEventListener("click", async (event) => {
    const tile = event.target instanceof Element ? event.target.closest<HTMLElement>("[data-seal-role]") : null;
    if (!tile || !(event.shiftKey || event.ctrlKey)) return;
    event.preventDefault();
    const body = { role: tile.dataset.sealRole, won: event.ctrlKey && !event.shiftKey, reset: event.ctrlKey && event.shiftKey };
    try {
      const response = await fetch(progressUrl("dev"), {
        method: "POST",
        headers: { ...authHeaders(), "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!response.ok) {
        console.warn("[dev] Seals: the backend refused; run it with WIZARD_DEV_TOOLS (npm run dev:tools in backend/).");
        return;
      }
      showRecords(card, groups, (await response.json()) as RoleRecord[]);
      card.querySelector<HTMLElement>(`[data-seal-role="${body.role}"]`)?.focus();
    } catch {
      console.warn("[dev] Seals: the backend could not be reached.");
    }
  });
}

// The tip follows whichever seal is pointed at or focused, so it keeps
// working after the dev clicks redraw the seals.
function setupTip(container: HTMLElement, card: HTMLElement): void {
  const tip = document.createElement("div");
  tip.className = "seal-tip";
  tip.hidden = true;
  container.append(tip);

  const tileOf = (target: EventTarget | null) =>
    target instanceof Element ? target.closest<HTMLElement>("[data-seal-tip]") : null;
  const show = (tile: HTMLElement) => {
    tip.textContent = tile.dataset.sealTip ?? "";
    tip.hidden = false;
    const art = (tile.querySelector(".seal-art") ?? tile).getBoundingClientRect();
    const left = art.left + art.width / 2 - tip.offsetWidth / 2;
    tip.style.left = `${Math.max(8, Math.min(left, window.innerWidth - tip.offsetWidth - 8))}px`;
    tip.style.top = `${Math.max(8, art.top - tip.offsetHeight - 6)}px`;
  };
  const hide = () => {
    tip.hidden = true;
  };

  card.addEventListener("mouseover", (event) => {
    const tile = tileOf(event.target);
    if (tile) show(tile);
  });
  card.addEventListener("mouseout", (event) => {
    if (tileOf(event.target) !== tileOf(event.relatedTarget)) hide();
  });
  card.addEventListener("focusin", (event) => {
    const tile = tileOf(event.target);
    if (tile) show(tile);
  });
  card.addEventListener("focusout", hide);
  card.querySelector(".profile-seals-body")?.addEventListener("scroll", hide);
}
