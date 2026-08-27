export function renderNavbar(container: HTMLElement, isLoggedIn: boolean): void {
  container.innerHTML = `
    <nav class="navbar">
      <a href="#/home">Home</a>
      <a href="#/lobby">Lobby</a>
      ${isLoggedIn ? '<a href="#/profile">Profile</a>' : ""}
      ${isLoggedIn ? '<button type="button" id="navbar-logout">Log out</button>' : ""}
    </nav>
  `;

  const logoutButton =
    container.querySelector<HTMLButtonElement>("#navbar-logout");

  logoutButton?.addEventListener("click", () => {
    localStorage.removeItem("wizardToken");
    window.location.hash = "#/home";
    window.dispatchEvent(new HashChangeEvent("hashchange"));
  });
}