// Installing the site as an app (a progressive web app).
//
// Chrome and Edge, on Android and desktop, offer their own install dialog,
// but only through a `beforeinstallprompt` event that fires once, early,
// whatever screen is showing. captureInstallPrompt() runs at start-up to keep
// it until a button asks. An iPhone has no such event: the only way there is
// Share > Add to Home Screen, so it gets instructions instead, as does an
// Android browser that never offered the dialog.

export const INSTALL_ICON = `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3v12M7 10l5 5 5-5M5 20h14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>`;

interface InstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

let deferred: InstallPromptEvent | null = null;
const listeners = new Set<() => void>();
const notify = () => listeners.forEach((listener) => listener());

export const isIPhone = (): boolean => /iPhone|iPod/.test(navigator.userAgent);
export const isAndroid = (): boolean => /Android/.test(navigator.userAgent);

// Running as the installed app rather than in a browser tab.
export const isInstalled = (): boolean =>
  (navigator as Navigator & { standalone?: boolean }).standalone === true ||
  window.matchMedia("(display-mode: standalone)").matches ||
  window.matchMedia("(display-mode: fullscreen)").matches;

export function captureInstallPrompt(): void {
  // public/sw.js, which caches nothing; it only makes the site installable.
  navigator.serviceWorker?.register("/sw.js").catch((error) => {
    console.warn("[install] no service worker:", error);
  });
  window.addEventListener("beforeinstallprompt", (event) => {
    event.preventDefault(); // keep the browser's own mini-bar away; the button offers it
    deferred = event as InstallPromptEvent;
    notify();
  });
  window.addEventListener("appinstalled", () => {
    deferred = null;
    notify();
  });
}

// The browser's own install dialog is ready to show.
export const canPromptInstall = (): boolean => deferred !== null;

// Worth offering at all: the browser's dialog, or instructions on a phone.
export const installOffered = (): boolean =>
  !isInstalled() && (canPromptInstall() || isIPhone() || isAndroid());

// Shows the browser's dialog; false when there is none, for instructions instead.
export async function promptInstall(): Promise<boolean> {
  const event = deferred;
  if (!event) return false;
  deferred = null; // each event can prompt once
  await event.prompt();
  await event.userChoice;
  notify();
  return true;
}

export const installInstructions = (): string =>
  isIPhone()
    ? "To install: tap Share, then Add to Home Screen."
    : "To install: open the browser menu (⋮), then Install app or Add to Home screen.";

// Runs the handler when installing becomes possible or stops being; returns how to stop.
export function onInstallChange(handler: () => void): () => void {
  listeners.add(handler);
  return () => listeners.delete(handler);
}
