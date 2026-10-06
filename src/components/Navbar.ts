import type { User } from "../types/auth";

export function renderNavbar(
  container: HTMLElement,
  currentUser: User,
): void {
  container.innerHTML = `
    <header class="lobby-header">
      <a class="lobby-brand" href="#/home">
        <img src="/wizardLogo.png" alt="Wizard" />
      </a>

      <nav class="lobby-nav" aria-label="Main navigation">
        <a href="#/home">Home</a>
        <span></span>
        <a href="#/profile">Profile</a>
      </nav>

      <div class="lobby-account">
        <span class="lobby-username">
          ${currentUser.displayName || currentUser.username}
        </span>

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