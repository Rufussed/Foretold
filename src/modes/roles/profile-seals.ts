import { rolesOfKind, type RoleId, type RoleKind } from "../../../backend/src/game/wizard/modes/roles/roles";
import { t } from "../../i18n";
import { roleSealUrl } from "./seal-urls";
import smithWood from "../../assets/role-seals/wood/seal-power-smith.png";

// Roles mode only. The Profile's Seals box (pages/Profile.ts calls it): every
// role's seal, dark until played. Each game that counts with a role prints
// its seal a little more, from the bottom up; once full, it is that level's
// seal, and the next level's metal starts printing afresh over a blank seal
// (hovering a seal names the level printing now). A shining line
// marks where the printing has reached.
//
// Front end only for now: the progress below is made up, to see the look.
// The server will send each role's real games and wins.

// The levels, in order, and the progress points that complete each one.
const LEVELS = [
  { id: "wood", at: 8 },
  { id: "bronze", at: 25 },
  { id: "silver", at: 60 },
  { id: "gold", at: 120 },
] as const;

type LevelId = (typeof LEVELS)[number]["id"];

interface RoleRecord {
  games: number;
  wins: number;
}

// PREVIEW: made-up records, until the server keeps the real ones.
const PREVIEW: Partial<Record<RoleId, RoleRecord>> = {
  thief: { games: 3, wins: 1 },
  servant: { games: 6, wins: 2 },
  fisher: { games: 14, wins: 4 },
  farmer: { games: 40, wins: 12 },
  merchant: { games: 70, wins: 25 },
  priest: { games: 90, wins: 40 },
  smith: { games: 4, wins: 1 },
  blueWizard: { games: 5, wins: 1 },
};

// Carlos's own drawn seals for a level (walnut for wood); the other roles
// and levels are tinted from the gold seal until theirs are drawn.
const DRAWN: Partial<Record<LevelId, Partial<Record<RoleId, string>>>> = {
  wood: { smith: smithWood },
};

// A game that counts is one point, a win one more.
const progressPoints = (record: RoleRecord): number => record.games + record.wins;

interface SealState {
  // The last level completed, or null for none yet.
  done: LevelId | null;
  // The level printing now, and how far, 0 to 1; null once gold is full.
  next: LevelId | null;
  fill: number;
}

function sealState(points: number): SealState {
  const reached = LEVELS.filter((level) => points >= level.at).length;
  const done = reached > 0 ? LEVELS[reached - 1].id : null;
  if (reached === LEVELS.length) return { done, next: null, fill: 1 };
  const from = reached > 0 ? LEVELS[reached - 1].at : 0;
  const to = LEVELS[reached].at;
  return { done, next: LEVELS[reached].id, fill: (points - from) / (to - from) };
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

function renderSeal(role: RoleId, kind: RoleKind): string {
  const url = roleSealUrl(role);
  if (!url) return "";
  const record = PREVIEW[role] ?? { games: 0, wins: 0 };
  const points = progressPoints(record);
  const { done, next, fill } = sealState(points);
  // Drawn seals show as drawn, and for now the master seals print in their
  // own colours; the rest are tinted to the level's metal.
  const metal = (level: LevelId) => (kind === "master" || DRAWN[level]?.[role] ? "own" : level);
  const art = (level: LevelId) => DRAWN[level]?.[role] ?? url;
  const percent = `${(fill * 100).toFixed(1)}%`;
  const target = next ? LEVELS.find((entry) => entry.id === next)!.at : points;
  const caption = next
    ? `${t(`seals.level.${next}`)} ${points}/${target}`
    : t("seals.level.gold");
  // Shown on hover, to keep the box small.
  const tip = `${t(`role.${role}`)} · ${caption} · ${t("seals.games", { games: String(record.games), wins: String(record.wins) })}`;

  return `
    <div class="seal-tile seal-at-${done ?? "none"}" data-seal-tip="${tip}" tabindex="0">
      <div class="seal-art">
        <img class="seal-base seal-metal-${next ? "none" : metal(done!)}" src="${next ? url : art(done!)}" alt="" />
        ${next ? `<img class="seal-fill seal-metal-${metal(next)}" src="${art(next)}" alt="" style="--fill: ${percent}" />` : ""}
        ${next && fill > 0 ? `<span class="seal-edge" style="--fill: ${percent}; --seal: url(${url})"></span>` : ""}
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

function renderGroup(kind: RoleKind, shown: RoleKind): string {
  return `
    <div class="seal-grid" role="tabpanel" data-seal-group="${kind}" ${kind === shown ? "" : "hidden"}>
      ${rolesOfKind(kind).map((role) => renderSeal(role.id, kind)).join("")}
    </div>
  `;
}

// The box. toggle and body are the Profile's open/close attributes for its
// header and its body.
export function renderSealsCard(toggle: string, body: string): string {
  const shown = loadTab();
  const earned = Object.values(PREVIEW).filter((record) => progressPoints(record) >= LEVELS[0].at).length;
  return `
    <article class="profile-card profile-seals">
      <div class="profile-section-heading profile-collapse-toggle" ${toggle}>
        <div>
          <p class="profile-card-kicker">${t("mode.roles")}</p>
          <h2>${t("seals.title")}</h2>
        </div>
        <span class="profile-history-meta">
          <span class="profile-opponent-count">${t("seals.earned", { count: String(earned) })}</span>
          <span class="profile-chevron" aria-hidden="true"></span>
        </span>
      </div>
      <div class="profile-seals-body" ${body}>
        ${renderTabs(shown)}
        ${KINDS.map((kind) => renderGroup(kind, shown)).join("")}
      </div>
    </article>
  `;
}

// The tabs: one group of seals shown at a time. And each seal's level and
// record in a tip over it while hovered, kept on the page itself so the
// box's scrolling never cuts it off.
export function setupSeals(container: HTMLElement): void {
  setupTip(container);
  const tabs = [...container.querySelectorAll<HTMLButtonElement>("[data-seal-tab]")];
  const groups = [...container.querySelectorAll<HTMLElement>("[data-seal-group]")];
  for (const tab of tabs) {
    tab.addEventListener("click", () => {
      const kind = tab.dataset.sealTab as RoleKind;
      for (const other of tabs) other.setAttribute("aria-selected", String(other === tab));
      for (const group of groups) group.hidden = group.dataset.sealGroup !== kind;
      saveTab(kind);
    });
  }
}

function setupTip(container: HTMLElement): void {
  const tip = document.createElement("div");
  tip.className = "seal-tip";
  tip.hidden = true;
  container.append(tip);

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

  for (const tile of container.querySelectorAll<HTMLElement>("[data-seal-tip]")) {
    tile.addEventListener("mouseenter", () => show(tile));
    tile.addEventListener("focus", () => show(tile));
    tile.addEventListener("mouseleave", hide);
    tile.addEventListener("blur", hide);
  }
  container.querySelector(".profile-seals-body")?.addEventListener("scroll", hide);
}
