import type { User } from "../types/auth";
import { escapeHtml } from "../utils/escape-html";
import { getLanguage, setLanguage, t, type MessageKey } from "../i18n";

// The window title of the "?" button for each page with a navbar. The text
// below it is the same placeholder everywhere until each page has its own.
function helpTitle(): MessageKey {
  const page = window.location.hash.split("?")[0].split("/")[1];

  switch (page) {
    case "profile":
      return "help.title.profile";
    case "room":
      return "help.title.room";
    case "admin":
      return "help.title.admin";
    default:
      return "help.title.lobby";
  }
}

// Opens the help window, styled like the Home windows. It closes with the
// cross, a click beside it, Escape or a change of page.
function openHelp(): void {
  document.querySelector("#navbar-help")?.remove();

  const backdrop = document.createElement("div");
  backdrop.className = "home-modal-backdrop";
  backdrop.id = "navbar-help";
  backdrop.innerHTML = `
    <section
      class="home-modal"
      role="dialog"
      aria-modal="true"
      aria-labelledby="navbar-help-title"
    >
      <button
        type="button"
        class="home-close-button"
        aria-label="${t("common.close")}"
      >
        <span></span>
        <span></span>
      </button>

      <h2 id="navbar-help-title">${t(helpTitle())}</h2>

      <p class="home-modal-copy">${t("help.placeholder")}</p>
    </section>
  `;

  function close(): void {
    backdrop.remove();
    document.removeEventListener("keydown", closeOnEscape);
    window.removeEventListener("hashchange", close);
  }

  function closeOnEscape(event: KeyboardEvent): void {
    if (event.key === "Escape") {
      close();
    }
  }

  // Only a press that began on the backdrop closes it, as on Home, so
  // selecting text in the window and letting go beside it does not.
  let pressedOnBackdrop = false;
  backdrop.addEventListener("pointerdown", (event) => {
    pressedOnBackdrop = event.target === backdrop;
  });
  backdrop.addEventListener("click", (event) => {
    if (event.target === backdrop && pressedOnBackdrop) {
      close();
    }
    pressedOnBackdrop = false;
  });

  backdrop
    .querySelector<HTMLButtonElement>(".home-close-button")
    ?.addEventListener("click", close);
  document.addEventListener("keydown", closeOnEscape);
  window.addEventListener("hashchange", close);

  document.body.append(backdrop);
}

export function renderNavbar(
  container: HTMLElement,
  currentUser: User,
): void {
  const isLobbyPage = window.location.hash.split("?")[0] === "#/lobby";

  container.innerHTML = `
    <header class="lobby-header">
      <div class="lobby-brand-group">
        <a class="lobby-brand" href="#/home">
          <img src="/wizardForetold.webp" alt="Wizard" />
        </a>

        <button
          type="button"
          id="navbar-help-button"
          class="lobby-help-button"
          aria-label="${t("help.button")}"
          data-tooltip="${t("help.button")}"
        >
          ?
        </button>
      </div>

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

  container
    .querySelector<HTMLButtonElement>("#navbar-help-button")
    ?.addEventListener("click", openHelp);

  const logoutButton =
    container.querySelector<HTMLButtonElement>("#navbar-logout");

  logoutButton?.addEventListener("click", () => {
    localStorage.removeItem("wizardToken");
    window.location.hash = "#/home";
    window.dispatchEvent(new HashChangeEvent("hashchange"));
  });
}