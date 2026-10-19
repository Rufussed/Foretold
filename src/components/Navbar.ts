import type { User } from "../types/auth";
import { escapeHtml } from "../utils/escape-html";
import { getLanguage, setLanguage, t } from "../i18n";

export function renderNavbar(
  container: HTMLElement,
  currentUser: User,
): void {
  const isLobbyPage = window.location.hash.split("?")[0] === "#/lobby";

  container.innerHTML = `
    <header class="lobby-header">
      <a class="lobby-brand" href="#/home">
        <span class="home-title lobby-title">Foretold</span>
      </a>

      <nav class="lobby-nav" aria-label="${t("nav.main")}">
        ${isLobbyPage ? "" : `<a href="#/lobby">${t("nav.glade")}</a>`}
      </nav>

      <div class="lobby-account">
        <button
          type="button"
          id="navbar-language"
          class="lobby-account-button lobby-language-button"
          aria-label="${t("language.switchLabel")}"
        >
          ${t("language.switchTo")}
        </button>

        <a class="lobby-username" href="#/profile">
          ${escapeHtml(currentUser.displayName || currentUser.username)}
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

  const logoutButton =
    container.querySelector<HTMLButtonElement>("#navbar-logout");

  logoutButton?.addEventListener("click", () => {
    localStorage.removeItem("wizardToken");
    window.location.hash = "#/home";
    window.dispatchEvent(new HashChangeEvent("hashchange"));
  });
}