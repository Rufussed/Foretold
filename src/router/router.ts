import { renderHomePage } from "../pages/Home";
import { renderProfilePage } from "../pages/Profile";
import { renderLobbyPage } from "../pages/Lobby";
import { renderWizardGamePage } from "../pages/WizardGame";

function renderCurrentRoute(container: HTMLElement): void {
  const route = window.location.hash || "#/home";

  if (route === "#/profile") {
    const token = localStorage.getItem("wizardToken");

    if (!token) {
      window.location.hash = "#/home";
      return;
    }

    void renderProfilePage(container);
    return;
  }

  
  if (route === "#/lobby") {
    const token = localStorage.getItem("wizardToken");
    
    if (!token) {
      window.location.hash = "#/home";
      return;
    }
    
    renderLobbyPage(container);
    return;
  }

  if (route.startsWith("#/game/")) {
    const token = localStorage.getItem("wizardToken");

    if (!token) {
      window.location.hash = "#/home";
      return;
    }

    const roomIdText = route.slice("#/game/".length);
    const roomId = Number(roomIdText);

    if (!Number.isInteger(roomId) || roomId <= 0) {
      container.innerHTML = `
        <main class="page">
          <section class="panel">
            <h1>Invalid game room</h1>
            <a href="#/lobby">Back to Lobby</a>
          </section>
        </main>
      `;
      return;
    }

    void renderWizardGamePage(container, roomId);
    return;
  }

  renderHomePage(container);
}

export function startRouter(container: HTMLElement): void {
  renderCurrentRoute(container);

  window.addEventListener("hashchange", () => {
    renderCurrentRoute(container);
  });
}