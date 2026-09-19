// An on-screen readout for the backdrop, for a device that cannot be attached
// to a debugger. Off unless the page is opened with ?gfx-debug=1, e.g.
//   https://host/?gfx-debug=1#/home
//
// It answers the one question that decides where to look next: is the canvas
// blank because the renderer stopped, or because the page is not showing what
// the renderer is drawing? If the frame count keeps climbing while the
// background is white, the scene is being drawn and lost somewhere between
// the canvas and the screen, which is a compositing problem, not a memory one.

export interface BackdropProbe {
  frame(): void;
  note(text: string): void;
  dispose(): void;
}

export const probeWanted = (): boolean =>
  new URLSearchParams(window.location.search).get("gfx-debug") === "1";

export function createBackdropProbe(canvas: HTMLCanvasElement): BackdropProbe {
  const box = document.createElement("pre");
  box.style.cssText = [
    "position:fixed",
    "left:8px",
    "top:8px",
    "z-index:2147483647",
    "margin:0",
    "padding:6px 8px",
    "font:11px/1.35 monospace",
    "color:#0f0",
    "background:rgb(0 0 0 / 80%)",
    "pointer-events:none",
    "white-space:pre",
    "max-width:calc(100% - 16px)",
  ].join(";");
  document.body.appendChild(box);

  let frames = 0;
  const notes: string[] = [];
  const started = performance.now();

  // A phone has no console to read, so the console comes to the page: enough
  // of it to screenshot and send on. Warnings and errors only; the trail is
  // short so the readout stays a corner of the screen, not a wall of text.
  const original = { warn: console.warn, error: console.error };
  const capture = (level: string, args: unknown[]) => {
    const text = args
      .map((a) => (a instanceof Error ? `${a.name}: ${a.message}` : String(a)))
      .join(" ");
    notes.push(`${level} ${text}`.slice(0, 200));
    paint();
  };
  console.warn = (...args: unknown[]) => {
    capture("warn", args);
    original.warn(...args);
  };
  console.error = (...args: unknown[]) => {
    capture("error", args);
    original.error(...args);
  };
  const onError = (event: ErrorEvent) => capture("error", [event.message]);
  const onRejection = (event: PromiseRejectionEvent) => capture("reject", [event.reason]);
  // Any canvas on the page, not only this one: the avatar portraits and the
  // 3D view have their own contexts to lose.
  const onAnyContextLost = (event: Event) =>
    capture("gl", [`context lost on ${(event.target as HTMLElement).className || "canvas"}`]);
  window.addEventListener("error", onError);
  window.addEventListener("unhandledrejection", onRejection);
  document.addEventListener("webglcontextlost", onAnyContextLost, true);

  const paint = () => {
    const seconds = (performance.now() - started) / 1000;
    const gl = canvas.getContext("webgl2") ?? canvas.getContext("webgl");
    box.textContent = [
      `frames ${frames}  ${(frames / Math.max(seconds, 0.001)).toFixed(0)}/s`,
      `canvas ${canvas.width}x${canvas.height} css ${canvas.clientWidth}x${canvas.clientHeight}`,
      `dpr ${window.devicePixelRatio}  visible ${getComputedStyle(canvas).display}`,
      `context ${gl ? (gl.isContextLost() ? "LOST" : "ok") : "none"}`,
      ...notes.slice(-8),
    ].join("\n");
  };

  const timer = window.setInterval(paint, 500);
  paint();

  return {
    frame() {
      frames += 1;
    },
    note(text) {
      notes.push(`${new Date().toISOString().slice(11, 19)} ${text}`);
      paint();
    },
    dispose() {
      window.clearInterval(timer);
      window.removeEventListener("error", onError);
      window.removeEventListener("unhandledrejection", onRejection);
      document.removeEventListener("webglcontextlost", onAnyContextLost, true);
      console.warn = original.warn;
      console.error = original.error;
      box.remove();
    },
  };
}
