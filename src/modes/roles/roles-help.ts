import { ROLES } from "../../../backend/src/game/wizard/modes/roles/roles";
import { openInfoWindow } from "../../components/info-window";
import { t } from "../../i18n";

// The window behind a Roles room's purple "?": every role, its card and what
// it does, with the rules all roles share first.
export function openRolesHelp(): void {
  openInfoWindow(
    "roles-help",
    t("roles.help.title"),
    `
      <div class="home-rules-content roles-help">
        <section class="home-rules-section">
          <p>${t("roles.help.intro")}</p>
        </section>
        ${ROLES.map(
          ({ id, card }) => `
            <section class="home-rules-section">
              <h3><span class="roles-help-card">${card}</span>${t(`role.${id}`)}</h3>
              <p>${t(`role.${id}.power`)}</p>
            </section>
          `,
        ).join("")}
      </div>
    `,
  );
}

// The purple "?" beside a role list.
export function rolesHelpButton(): string {
  return `
    <button
      type="button"
      class="roles-help-button mode-roles"
      aria-label="${t("roles.help.button")}"
      title="${t("roles.help.button")}"
    >?</button>
  `;
}
