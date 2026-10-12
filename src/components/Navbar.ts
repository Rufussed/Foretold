import type { User } from "../types/auth";

export function renderNavbar(
  container: HTMLElement,
  currentUser: User,
): void {
  const isLobbyPage = window.location.hash.split("?")[0] === "#/lobby";

  container.innerHTML = `
    <header class="lobby-header">
      <a class="lobby-brand" href="#/home">
        <img src="/wizardLogo.png" alt="Wizard" />
      </a>

      <nav class="lobby-nav" aria-label="Main navigation">
        ${isLobbyPage ? "" : '<a href="#/lobby">The Glade</a>'}
      </nav>

      <div class="lobby-account">
        <a class="lobby-username" href="#/profile">
          ${currentUser.displayName || currentUser.username}
        </a>

        <button
          type="button"
          id="navbar-logout"
          class="lobby-account-button"
        >
          Log out
        </button>
      </div>
    </header>
  `;

  const logoutButton =
    container.querySelector<HTMLButtonElement>("#navbar-logout");

  logoutButton?.addEventListener("click", () => {
    localStorage.removeItem("wizardToken");
    window.location.hash = "#/home";
    window.dispatchEvent(new HashChangeEvent("hashchange"));
  });
}