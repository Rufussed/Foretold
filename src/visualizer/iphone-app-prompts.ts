// iPhone-only helpers for running the table as a home-screen web app.
//
// iPhone Safari offers no fullscreen for a page and no orientation lock, so
// the button in fullscreen-toggle.ts cannot exist there. The way to get the
// whole screen is to install the page ("Add to Home Screen"), which opens it
// without Safari's toolbars. Two small prompts support that:
//  - in the browser, a dismissible hint explaining how to install;
//  - installed, a "rotate your phone" cover while held upright, since iOS
//    ignores the manifest's landscape orientation.
// Android and iPad never see either: they have real fullscreen.

import { t } from "../i18n";

const HINT_DISMISSED_KEY = "wizard.iphoneInstallHintDismissed";

export const isIPhone = (): boolean => /iPhone|iPod/.test(navigator.userAgent);

const isInstalled = (): boolean =>
  (navigator as Navigator & { standalone?: boolean }).standalone === true ||
  window.matchMedia("(display-mode: standalone)").matches;

const wasDismissed = (): boolean => {
  try {
    return localStorage.getItem(HINT_DISMISSED_KEY) === "1";
  } catch {
    return false;
  }
};

export function createIPhoneAppPrompts(root: HTMLElement): { dispose(): void } | null {
  if (!isIPhone()) return null;

  const el = document.createElement("div");
  if (isInstalled()) {
    el.className = "rotate-cover";
    el.textContent = t("game.rotate");
  } else if (!wasDismissed()) {
    el.className = "install-hint";
    const text = document.createElement("span");
    text.textContent = t("game.iosFullscreen");
    const close = document.createElement("button");
    close.type = "button";
    close.setAttribute("aria-label", t("game.dismiss"));
    close.textContent = "×";
    close.addEventListener("click", () => {
      try {
        localStorage.setItem(HINT_DISMISSED_KEY, "1");
      } catch {
        // The hint just comes back next visit.
      }
      el.remove();
    });
    el.append(text, close);
  } else {
    return null;
  }
  root.append(el);
  return { dispose: () => el.remove() };
}
