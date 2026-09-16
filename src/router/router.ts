import { renderHomePage } from "../pages/Home";
import { renderProfilePage } from "../pages/Profile";
import { renderLobbyPage } from "../pages/Lobby";
import { destroyWizardGamePage, renderWizardGamePage } from "../pages/WizardGame";

// three.js is large; only pull the visualizer bundle in when it's actually
// needed instead of paying for it on every route.
let visualizerModule: typeof import("../pages/Visualizer") | null = null;

async function destroyVisualizer(): Promise<void> {
  visualizerModule?.destroyVisualizer();
}

// Behind every page but the 3D view: the table scene, slowly circled. Also
// three.js, so loaded on first use; kept alive across those pages and removed
// when the 3D view (which draws the table itself) opens.
let backdropModule: typeof import("../visualizer/backdrop-scene") | null = null;
let backdrop: { dispose(): void } | null = null;
let backdropWanted = false;

async function showBackdrop(): Promise<void> {
  backdropWanted = true;
  if (backdrop) return;
  backdropModule ??= await import("../visualizer/backdrop-scene");
  // The route may have changed to the 3D view while the module loaded.
  if (backdropWanted && !backdrop) backdrop = backdropModule.createBackdropScene(document.body);
}

function hideBackdrop(): void {
  backdropWanted = false;
  backdrop?.dispose();
  backdrop = null;
}

// The waiting room also pulls in three.js for its avatar portraits.
let roomModule: typeof import("../pages/Room") | null = null;

async function loadRoom(container: HTMLElement, roomId: number): Promise<void> {
  roomModule ??= await import("../pages/Room");
  void roomModule.renderRoomPage(container, roomId);
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
    void showBackdrop();
  } else {
    hideBackdrop();
  }

  roomModule?.destroyRoomPage();
  destroyWizardGamePage();

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

  if (route.startsWith("#/room/")) {
    const token = localStorage.getItem("wizardToken");

    if (!token) {
      window.location.hash = "#/home";
      return;
    }

    const roomId = Number(route.slice("#/room/".length));

    if (!Number.isInteger(roomId) || roomId <= 0) {
      window.location.hash = "#/lobby";
      return;
    }

    void loadRoom(container, roomId);
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