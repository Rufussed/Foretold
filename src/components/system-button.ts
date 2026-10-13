import {
  COLLAPSE,
  EXPAND,
  fullscreenAvailable,
  isFullscreen,
  onFullscreenChange,
  toggleFullscreen,
} from "../visualizer/fullscreen-toggle";
import { INSTALL_ICON as INSTALL, isInstalled as installed } from "../utils/pwa-install";
import { isIPhone } from "../visualizer/iphone-app-prompts";

// One small button at the top right of every screen outside a game, so the
// whole screen is on offer from the first page rather than only at the table:
//  - where the browser can do fullscreen (Android, iPad, desktop), it toggles it;
//  - on an iPhone, which cannot, it explains how to install the page as an app,
//    which is the way to lose Safari's toolbars there;
//  - in an installed app, where there is nothing to gain, it is not shown.
// In a game the HUD has its own fullscreen button, so the router hides this.

export interface SystemButton {
  setVisible(visible: boolean): void;
}

export function mountSystemButton(): SystemButton {
  const asFullscreen = fullscreenAvailable(document.documentElement);
  const asInstall = !asFullscreen && isIPhone() && !installed();
  if (installed() || (!asFullscreen && !asInstall)) return { setVisible() {} };

  const button = document.createElement("button");
  button.type = "button";
  button.className = "system-button";
  document.body.append(button);

  let hint: HTMLElement | null = null;
  const closeHint = () => {
    hint?.remove();
    hint = null;
  };

  const render = () => {
    if (asFullscreen) {
      const on = isFullscreen();
      button.innerHTML = on ? COLLAPSE : EXPAND;
      const label = on ? "Leave fullscreen" : "Fullscreen";
      button.title = label;
      button.setAttribute("aria-label", label);
    } else {
      button.innerHTML = INSTALL;
      button.title = "Install for fullscreen";
      button.setAttribute("aria-label", "Install for fullscreen");
    }
  };

  button.addEventListener("click", () => {
    if (asFullscreen) {
      void toggleFullscreen(document.documentElement).then(render);
      return;
    }
    if (hint) {
      closeHint();
      return;
    }
    hint = document.createElement("div");
    hint.className = "system-hint";
    hint.setAttribute("role", "status");
    hint.textContent = "For fullscreen: tap Share, then Add to Home Screen.";
    document.body.append(hint);
  });

  if (asFullscreen) onFullscreenChange(render);
  render();

  return {
    setVisible(visible) {
      button.hidden = !visible;
      document.body.classList.toggle("has-system-button", visible);
      if (!visible) closeHint();
    },
  };
}
