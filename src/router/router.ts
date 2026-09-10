import { renderHomePage } from "../pages/Home";
import { renderProfilePage } from "../pages/Profile";
import { renderLobbyPage } from "../pages/Lobby";
import { renderWizardGamePage } from "../pages/WizardGame";

// PlayCanvas is large; only pull the visualizer bundle in when it's actually
// needed instead of paying for it on every route.
let visualizerModule: typeof import("../pages/Visualizer") | null = null;

async function destroyVisualizer(): Promise<void> {
  visualizerModule?.destroyVisualizer();
}

async function loadVisualizer(
  container: HTMLElement,
  roomId: number,
): Promise<void> {
  visualizerModule ??= await import("../pages/Visualizer");
  visualizerModule.renderVisualizerPage(container, roomId);
}

// The frontend uses hash routes so navigation works without a server-side
// fallback configuration. Protected routes redirect unauthenticated users.
function renderCurrentRoute(container: HTMLElement): void {
  const route = window.location.hash || "#/home";

  if (!route.startsWith("#/game/") || !route.endsWith("/visualizer")) {
    destroyVisualizer();
  }

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

    const isVisualizerRoute = route.endsWith("/visualizer");
    const roomIdText = isVisualizerRoute
      ? route.slice("#/game/".length, -"/visualizer".length)
      : route.slice("#/game/".length);
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

    if (isVisualizerRoute) {
      void loadVisualizer(container, roomId);
      return;
    }

    void renderWizardGamePage(container, roomId);
    return;
  }

  renderHomePage(container);
}

export function startRouter(container: HTMLElement): void {
  // Render immediately and then re-render whenever the URL hash changes.
  renderCurrentRoute(container);

  window.addEventListener("hashchange", () => {
    renderCurrentRoute(container);
  });
}