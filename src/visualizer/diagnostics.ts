const STORAGE_KEY = "wizard-visualizer-trail";
const STEPS_KEPT = 40;

interface Trail {
  steps: string[];
  // Still open: the page hasn't closed cleanly (yet).
  open: boolean;
}

export interface Diagnostics {
  // Records a step, kept across a crash so the next visit can show it.
  note(step: string): void;
  dispose(): void;
}

// Dev builds only: a trail of what the 3D view was doing, for tracking down
// problems on devices whose console you can't see (such as a phone). The trail
// is kept in session storage, so if the browser kills the tab (on phones,
// usually for running out of graphics memory) the next visit shows the last
// steps. Script errors and lost graphics contexts show it straight away.
// Otherwise it stays out of sight.
export function createDiagnostics(root: HTMLElement): Diagnostics {
  const started = performance.now();
  const stamp = () => `${((performance.now() - started) / 1000).toFixed(1)}s`;

  const readTrail = (): Trail | null => {
    try {
      return JSON.parse(sessionStorage.getItem(STORAGE_KEY) ?? "null") as Trail | null;
    } catch {
      return null;
    }
  };
  const previous = readTrail();
  const trail: Trail = { steps: [], open: true };
  const save = () => {
    try {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(trail));
    } catch {
      // Storage unavailable; the live panel still works.
    }
  };

  const panel = document.createElement("aside");
  panel.className = "visualizer-diagnostics";
  panel.hidden = true;
  panel.innerHTML = `
    <button type="button" class="visualizer-diagnostics-close" aria-label="Close">×</button>
    <p class="visualizer-diagnostics-title"></p>
    <pre></pre>
  `;
  root.append(panel);
  const title = panel.querySelector<HTMLParagraphElement>(".visualizer-diagnostics-title")!;
  const body = panel.querySelector<HTMLPreElement>("pre")!;
  panel.querySelector("button")!.addEventListener("click", () => {
    panel.hidden = true;
  });

  const show = (heading: string, steps: readonly string[]) => {
    title.textContent = heading;
    body.textContent = steps.join("\n");
    panel.hidden = false;
  };

  const note = (step: string) => {
    trail.steps = [...trail.steps, `${stamp()}  ${step}`].slice(-STEPS_KEPT);
    save();
  };

  if (previous?.open && previous.steps.length) {
    show(
      "The last visit to this page ended without closing. On a phone that usually means the browser ran out of graphics memory. Its last steps:",
      previous.steps.slice(-15),
    );
  }

  note("opened the 3D view");
  note(`${navigator.userAgent}`);
  note(`screen ${screen.width}x${screen.height} at ${window.devicePixelRatio}x, window ${innerWidth}x${innerHeight}`);

  const onError = (event: ErrorEvent) => {
    note(`error: ${event.message}`);
    show("Something went wrong in the 3D view:", trail.steps.slice(-12));
  };
  const onRejection = (event: PromiseRejectionEvent) => {
    const reason = event.reason as { message?: string } | undefined;
    note(`unhandled: ${reason?.message ?? String(event.reason)}`);
    show("Something went wrong in the 3D view:", trail.steps.slice(-12));
  };
  // Captured on the document: the event doesn't bubble, but capture still
  // passes through. Canvases already removed from the page were released on
  // purpose, so they're ignored.
  const onContextLost = (event: Event) => {
    const canvas = event.target as HTMLCanvasElement;
    if (!canvas.isConnected) return;
    note(`graphics context lost: ${canvas.id || canvas.className || "canvas"}`);
    show(
      "A 3D view lost its graphics context: the device ran out of graphics memory, or has too many 3D views open. Last steps:",
      trail.steps.slice(-12),
    );
  };
  const onPageHide = () => {
    trail.open = false;
    save();
  };

  window.addEventListener("error", onError);
  window.addEventListener("unhandledrejection", onRejection);
  window.addEventListener("pagehide", onPageHide);
  document.addEventListener("webglcontextlost", onContextLost, true);

  // Every few seconds, what the scene holds on the GPU; once, which GPU.
  let describedGpu = false;
  const stats = window.setInterval(() => {
    const renderer = (window as unknown as {
      __wizard?: { renderer?: { info: { memory: { textures: number; geometries: number }; render: { calls: number } }; getContext(): WebGLRenderingContext } };
    }).__wizard?.renderer;
    if (!renderer) return;
    if (!describedGpu) {
      describedGpu = true;
      const gl = renderer.getContext();
      const debugInfo = gl.getExtension("WEBGL_debug_renderer_info");
      const gpu = debugInfo ? gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL) : "GPU name hidden";
      note(`gpu: ${gpu}; max texture ${gl.getParameter(gl.MAX_TEXTURE_SIZE)}`);
    }
    const { memory, render } = renderer.info;
    note(`holding ${memory.textures} textures, ${memory.geometries} geometries; ${render.calls} draw calls`);
  }, 5000);

  return {
    note,
    dispose() {
      window.clearInterval(stats);
      window.removeEventListener("error", onError);
      window.removeEventListener("unhandledrejection", onRejection);
      window.removeEventListener("pagehide", onPageHide);
      document.removeEventListener("webglcontextlost", onContextLost, true);
      trail.open = false;
      save();
      panel.remove();
    },
  };
}
