import { rolesOfKind, type RoleId, type RoleKind } from "../../../backend/src/game/wizard/modes/roles/roles";
import { openInfoWindow } from "../../components/info-window";
import { t } from "../../i18n";
import { roleRulesHtml } from "./role-rules";

const TEXTS = {
  basic: { title: "roles.help.title", intro: "roles.help.intro", button: "roles.help.button" },
  master: { title: "roles.master.help.title", intro: "roles.master.help.intro", button: "roles.master.help.button" },
} as const;

// The window behind a Roles room's purple "?": a short word on what roles
// or powers are, then each one open to the player, with its card and rules
// (role-rules.ts). Locked ones stay hidden, as in the lists, and appear as
// they are unlocked; open is null when not known, and then all show.
export function openRolesHelp(kind: RoleKind, open: readonly RoleId[] | null = null): void {
  const texts = TEXTS[kind];
  const shown = rolesOfKind(kind).filter(({ id }) => !open || open.includes(id));
  openInfoWindow(
    "roles-help",
    t(texts.title),
    `
      <div class="home-rules-content roles-help">
        <section class="home-rules-section">
          <p>${t(texts.intro)}</p>
          ${shown.length ? "" : `<p>${t("roles.help.noneOpen")}</p>`}
        </section>
        ${shown.map(
          ({ id, card }) => `
            <section class="home-rules-section">
              <h3>${card === null ? "" : `<span class="roles-help-card">${card}</span>`}${t(`role.${id}`)}</h3>
              ${roleRulesHtml(id)}
            </section>
          `,
        ).join("")}
      </div>
    `,
  );
}

// The purple "?" beside a role list, for that list's kind.
export function rolesHelpButton(kind: RoleKind): string {
  const label = t(TEXTS[kind].button);
  return `
    <button
      type="button"
      class="roles-help-button mode-roles"
      data-kind="${kind}"
      aria-label="${label}"
      title="${label}"
    >?</button>
  `;
}
