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

  const paint = () => {
    const seconds = (performance.now() - started) / 1000;
    const gl = canvas.getContext("webgl2") ?? canvas.getContext("webgl");
    box.textContent = [
      `frames ${frames}  ${(frames / Math.max(seconds, 0.001)).toFixed(0)}/s`,
      `canvas ${canvas.width}x${canvas.height} css ${canvas.clientWidth}x${canvas.clientHeight}`,
      `dpr ${window.devicePixelRatio}  visible ${getComputedStyle(canvas).display}`,
      `context ${gl ? (gl.isContextLost() ? "LOST" : "ok") : "none"}`,
      ...notes.slice(-4),
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
      box.remove();
    },
  };
}
