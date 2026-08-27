import { getCurrentUser, logout } from "../services/auth";

export async function renderProfilePage(container: HTMLElement): Promise<void> {
  const token = localStorage.getItem("wizardToken");

  if (!token) {
    window.location.hash = "#/home";
    return;
  }

  const user = await getCurrentUser();

  container.innerHTML = `
    <div class="page">
      <nav class="navbar">
        <a href="#/home">Home</a>
        <button id="profile-logout" type="button">Log out</button>
      </nav>

      <main class="panel">
        <h1>Profile</h1>
        <p><strong>Username:</strong> ${user.username}</p>
        <p><strong>Display name:</strong> ${user.displayName}</p>
        <p><strong>Email:</strong> ${user.email}</p>
      </main>
    </div>
  `;

  const logoutButton =
    container.querySelector<HTMLButtonElement>("#profile-logout");

  logoutButton?.addEventListener("click", () => {
    logout();
    window.location.hash = "#/home";
    window.dispatchEvent(new HashChangeEvent("hashchange"));
  });
}