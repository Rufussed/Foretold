import type { User } from "../types/auth";
import { escapeHtml } from "../utils/escape-html";
import { getLanguage, setLanguage, t, type MessageKey } from "../i18n";
import { helpHtml, type HelpPage } from "../i18n/long-texts";
import { watchStartedGame } from "../services/started-game";
import { openInfoWindow } from "./info-window";

// Which page the "?" button explains: each page with a navbar has its own
// help, the Glade's for anything else.
function helpPage(): HelpPage {
  const page = window.location.hash.split("?")[0].split("/")[1];

  switch (page) {
    case "profile":
    case "room":
    case "admin":
      return page;
    default:
      return "lobby";
  }
}

const HELP_TITLES: Record<HelpPage, MessageKey> = {
  lobby: "help.title.lobby",
  profile: "help.title.profile",
  room: "help.title.room",
  admin: "help.title.admin",
};

// Opens the help window for the page.
function openHelp(): void {
  const page = helpPage();

  openInfoWindow(
    "navbar-help",
    t(HELP_TITLES[page]),
    helpHtml(page) ?? `<p class="home-modal-copy">${t("help.placeholder")}</p>`,
  );
}

export function renderNavbar(
  container: HTMLElement,
  currentUser: User,
): void {
  const isLobbyPage = window.location.hash.split("?")[0] === "#/lobby";

  container.innerHTML = `
    <header class="lobby-header">
      <div class="lobby-brand-group">
        <a
          class="lobby-brand"
          href="#/home"
          data-tooltip="${t("nav.tipHome")}"
        >
          <img src="/wizardForetold.webp" alt="Wizard" />
        </a>

        <div class="lobby-help-group">
          <button
            type="button"
            id="navbar-help-button"
            class="lobby-help-button"
            aria-label="${t("help.button")}"
            data-tooltip="${t("help.button")}"
          >
            ?
          </button>

          <button
            type="button"
            id="navbar-back-button"
            class="lobby-help-button lobby-back-button"
            aria-label="${t("nav.back")}"
            data-tooltip="${t("nav.back")}"
          >
            &lt;
          </button>
        </div>
      </div>

      <nav class="lobby-nav" aria-label="${t("nav.main")}">
        ${
          isLobbyPage
            ? ""
            : `<a href="#/lobby" data-tooltip="${t("nav.tipLobby")}">${t("nav.glade")}</a>`
        }
      </nav>

      <div class="lobby-account">
        <button
          type="button"
          id="navbar-language"
          class="lobby-account-button lobby-language-button"
          aria-label="${t("language.switchLabel")}"
          data-tooltip="${t("language.switchLabel")}"
        >
          ${t("language.switchTo")}
        </button>

        <a
          class="lobby-username"
          id="navbar-profile"
          href="#/profile"
          data-tooltip="${t("nav.tipProfile")}"
        >
          <span class="lobby-username-text">${escapeHtml(currentUser.displayName || currentUser.username)}</span>
        </a>

        <button
          type="button"
          id="navbar-logout"
          class="lobby-account-button"
        >
          ${t("account.logout")}
        </button>
      </div>
    </header>
  `;

  // Redraws the page in the other language. The game pages have no Navbar,
  // so a game in progress is never torn down by it.
  container
    .querySelector<HTMLButtonElement>("#navbar-language")
    ?.addEventListener("click", () => {
      setLanguage(getLanguage() === "de" ? "en" : "de");
    });

  container
    .querySelector<HTMLButtonElement>("#navbar-help-button")
    ?.addEventListener("click", openHelp);

  // Back to the page before; a page opened on its own goes to the Glade.
  container
    .querySelector<HTMLButtonElement>("#navbar-back-button")
    ?.addEventListener("click", () => {
      if (window.history.length > 1) {
        window.history.back();
      } else {
        window.location.hash = "#/lobby";
      }
    });

  // A game the player is seated in has started: the name turns gold like
  // Play Now on Home, and Profile has the button to the table.
  const profileLink =
    container.querySelector<HTMLAnchorElement>("#navbar-profile");

  if (profileLink) {
    watchStartedGame(profileLink, currentUser.username, (game) => {
      profileLink.classList.toggle("lobby-username-alert", game !== null);
      profileLink.dataset.tooltip = game
        ? t("nav.tipGameStarted", { room: game.name })
        : t("nav.tipProfile");
    });
  }

  const logoutButton =
    container.querySelector<HTMLButtonElement>("#navbar-logout");

  logoutButton?.addEventListener("click", () => {
    localStorage.removeItem("wizardToken");
    window.location.hash = "#/home";
    window.dispatchEvent(new HashChangeEvent("hashchange"));
  });
}
