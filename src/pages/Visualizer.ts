import { createWizardScene, type WizardSceneHandle } from "../visualizer/scene";

let activeScene: WizardSceneHandle | null = null;

// The router swaps container.innerHTML on navigation, which would otherwise
// leak the previous PlayCanvas app (it keeps its own render loop running
// independent of the DOM). Tear it down before mounting a new one.
export function destroyVisualizer(): void {
  activeScene?.destroy();
  activeScene = null;
}

export function renderVisualizerPage(
  container: HTMLElement,
  roomId: number,
): void {
  destroyVisualizer();

  container.innerHTML = `
    <main class="visualizer-page">
      <div class="visualizer-canvas-wrap">
        <canvas id="wizard-visualizer-canvas"></canvas>
        <div id="wizard-visualizer-loading">Loading scene…</div>
      </div>

      <nav class="visualizer-nav">
        <a href="#/home">Home</a>
        <a href="#/lobby">Lobby</a>
        <a href="#/game/${roomId}">Back to Game</a>
      </nav>
    </main>
  `;

  const canvas = container.querySelector<HTMLCanvasElement>(
    "#wizard-visualizer-canvas",
  );
  const loadingEl = container.querySelector<HTMLDivElement>(
    "#wizard-visualizer-loading",
  );

  if (!canvas) {
    throw new Error("Visualizer canvas element was not found");
  }

  activeScene = createWizardScene(canvas, {
    onLoading: (loading) => {
      loadingEl?.classList.toggle("hidden", !loading);
    },
    onError: (message) => {
      if (loadingEl) {
        loadingEl.textContent = message;
      }
      console.error(message);
    },
  });
}
