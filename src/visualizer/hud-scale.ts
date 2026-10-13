// Scales the corner HUD pieces to the screen, so a phone gets the same layout
// at a smaller size instead of panels that run into each other.
//
// CSS cannot turn a length into a plain number, so the factor is worked out
// here from the window's pixels and handed to CSS as --hud-scale, which the
// HUD panels apply with `zoom`. Height drives it: the corner stacks are tall,
// and a landscape phone has the least of it.

const FULL_WIDTH = 900;
const FULL_HEIGHT = 640;
const SMALLEST = 0.55;

export const hudScaleFor = (width: number, height: number): number =>
  Math.max(SMALLEST, Math.min(1, width / FULL_WIDTH, height / FULL_HEIGHT));

export function createHudScale(page: HTMLElement): { dispose(): void } {
  const apply = () => {
    const scale = hudScaleFor(window.innerWidth, window.innerHeight);
    page.style.setProperty("--hud-scale", scale.toFixed(3));
  };
  apply();
  window.addEventListener("resize", apply);
  window.addEventListener("orientationchange", apply);
  return {
    dispose() {
      window.removeEventListener("resize", apply);
      window.removeEventListener("orientationchange", apply);
    },
  };
}
