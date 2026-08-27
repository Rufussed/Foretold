import { renderHomePage } from "../pages/Home";
import { renderProfilePage } from "../pages/Profile";
import { renderLobbyPage } from "../pages/Lobby";

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

  renderHomePage(container);
}

export function startRouter(container: HTMLElement): void {
  renderCurrentRoute(container);

  window.addEventListener("hashchange", () => {
    renderCurrentRoute(container);
  });
}
