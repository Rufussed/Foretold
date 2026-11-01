import { rolesOfKind, type RoleKind } from "../../../backend/src/game/wizard/modes/roles/roles";
import { openInfoWindow } from "../../components/info-window";
import { t } from "../../i18n";

const TEXTS = {
  basic: { title: "roles.help.title", intro: "roles.help.intro", button: "roles.help.button" },
  master: { title: "roles.master.help.title", intro: "roles.master.help.intro", button: "roles.master.help.button" },
} as const;

// The window behind a Roles room's purple "?": the basic roles, each with its
// card and what it does, or the master roles (the colour Wizards), with the
// rules they share first.
export function openRolesHelp(kind: RoleKind): void {
  const texts = TEXTS[kind];
  openInfoWindow(
    "roles-help",
    t(texts.title),
    `
      <div class="home-rules-content roles-help">
        <section class="home-rules-section">
          <p>${t(texts.intro)}</p>
        </section>
        ${rolesOfKind(kind).map(
          ({ id, card }) => `
            <section class="home-rules-section">
              <h3>${card === null ? "" : `<span class="roles-help-card">${card}</span>`}${t(`role.${id}`)}</h3>
              <p>${t(`role.${id}.power`)}</p>
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
