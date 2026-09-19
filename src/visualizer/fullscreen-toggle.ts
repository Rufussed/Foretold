// A button to take the 3D view fullscreen, beside the music toggle.
//
// It earns its place on a phone: the browser's address bar and toolbars eat
// a third of a small screen, and the table is the one view worth all of it.
//
// Not every browser offers it - an iPhone's Safari refuses fullscreen for
// anything but a video - so the button only appears where it can work,
// rather than sitting there doing nothing.

const EXPAND = `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
const COLLAPSE = `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 4v5H4M15 4v5h5M9 20v-5H4M15 20v-5h5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>`;

export interface FullscreenToggle {
  dispose(): void;
}

// Safari names all of this with a webkit prefix, and older iPads only have
// the prefixed form, so both spellings are tried.
interface FullscreenElement extends HTMLElement {
  webkitRequestFullscreen?: () => Promise<void> | void;
}
interface FullscreenDocument extends Document {
  webkitFullscreenElement?: Element | null;
  webkitExitFullscreen?: () => Promise<void> | void;
}

const doc = (): FullscreenDocument => document as FullscreenDocument;

const isFullscreen = (): boolean =>
  Boolean(doc().fullscreenElement ?? doc().webkitFullscreenElement);

export const fullscreenAvailable = (element: HTMLElement): boolean => {
  const target = element as FullscreenElement;
  return Boolean(
    (document.fullscreenEnabled || doc().webkitFullscreenElement !== undefined) &&
      (target.requestFullscreen || target.webkitRequestFullscreen),
  );
};

export function createFullscreenToggle(
  root: HTMLElement,
  target: HTMLElement,
): FullscreenToggle | null {
  if (!fullscreenAvailable(target)) return null;

  const button = document.createElement("button");
  button.type = "button";
  button.className = "fullscreen-toggle";
  root.append(button);

  const render = () => {
    const on = isFullscreen();
    button.innerHTML = on ? COLLAPSE : EXPAND;
    const label = on ? "Leave fullscreen" : "Fullscreen";
    button.title = label;
    button.setAttribute("aria-label", label);
    button.setAttribute("aria-pressed", String(on));
  };

  const toggle = async () => {
    const element = target as FullscreenElement;
    try {
      if (isFullscreen()) await (doc().exitFullscreen?.() ?? doc().webkitExitFullscreen?.());
      else await (element.requestFullscreen?.() ?? element.webkitRequestFullscreen?.());
    } catch (error) {
      // A browser may refuse - the gesture was not direct enough, or the
      // page is in an iframe without permission. Nothing else breaks.
      console.warn("[fullscreen] refused:", error);
    }
    render();
  };

  button.addEventListener("click", () => void toggle());
  // The viewer can also leave with Escape or the system gesture, so follow
  // the document rather than assuming the button is the only way out.
  document.addEventListener("fullscreenchange", render);
  document.addEventListener("webkitfullscreenchange", render);
  render();

  return {
    dispose() {
      document.removeEventListener("fullscreenchange", render);
      document.removeEventListener("webkitfullscreenchange", render);
      button.remove();
    },
  };
}
