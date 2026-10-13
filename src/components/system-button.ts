import {
  COLLAPSE,
  EXPAND,
  fullscreenAvailable,
  isFullscreen,
  onFullscreenChange,
  toggleFullscreen,
} from "../visualizer/fullscreen-toggle";
import {
  INSTALL_ICON,
  installInstructions,
  installOffered,
  isInstalled,
  onInstallChange,
  promptInstall,
} from "../utils/pwa-install";

// Small buttons at the top right of every screen outside a game, so the whole
// screen is on offer from the first page rather than only at the table:
//  - where the browser can do fullscreen (Android, iPad, desktop), a
//    fullscreen toggle in the corner;
//  - to its left, wherever installing as an app is on offer (see
//    utils/pwa-install.ts), an install button: the browser's own dialog, or
//    how to do it from the menu (an iPhone's only way to lose Safari's toolbars);
//  - in an installed app, where there is nothing to gain, neither is shown.
// In a game the HUD has its own buttons, so the router hides these.

export interface SystemButton {
  setVisible(visible: boolean): void;
}

const makeButton = (): HTMLButtonElement => {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "system-button";
  document.body.append(button);
  return button;
};

export function mountSystemButton(): SystemButton {
  if (isInstalled()) return { setVisible() {} };

  let visible = true;
  let hint: HTMLElement | null = null;
  const closeHint = () => {
    hint?.remove();
    hint = null;
  };

  const fullscreen = fullscreenAvailable(document.documentElement) ? makeButton() : null;
  if (fullscreen) {
    const render = () => {
      const on = isFullscreen();
      fullscreen.innerHTML = on ? COLLAPSE : EXPAND;
      const label = on ? "Leave fullscreen" : "Fullscreen";
      fullscreen.title = label;
      fullscreen.setAttribute("aria-label", label);
    };
    fullscreen.addEventListener("click", () => {
      void toggleFullscreen(document.documentElement).then(render);
    });
    onFullscreenChange(render);
    render();
  }

  const install = makeButton();
  // Second from the corner when the fullscreen button is there too.
  install.classList.toggle("is-second", Boolean(fullscreen));
  install.innerHTML = INSTALL_ICON;
  install.title = "Install as an app";
  install.setAttribute("aria-label", "Install as an app");
  install.addEventListener("click", async () => {
    if (hint) {
      closeHint();
      return;
    }
    if (await promptInstall()) return;
    hint = document.createElement("div");
    hint.className = "system-hint";
    hint.setAttribute("role", "status");
    hint.textContent = installInstructions();
    document.body.append(hint);
  });

  // Install comes and goes (the browser's offer arrives late, and ends once
  // used), so what shows is worked out again each time.
  const render = () => {
    const offered = installOffered();
    if (fullscreen) fullscreen.hidden = !visible;
    install.hidden = !visible || !offered;
    const count = Number(Boolean(fullscreen)) + Number(offered);
    document.body.classList.toggle("has-system-button", visible && count > 0);
    document.body.classList.toggle("has-two-system-buttons", visible && count > 1);
    if (install.hidden) closeHint();
  };
  onInstallChange(render);
  render();

  return {
    setVisible(next) {
      visible = next;
      render();
    },
  };
}
