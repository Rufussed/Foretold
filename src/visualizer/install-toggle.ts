import {
  INSTALL_ICON,
  installInstructions,
  installOffered,
  onInstallChange,
  promptInstall,
} from "../utils/pwa-install";

export interface InstallToggle {
  dispose(): void;
}

// A button to install the site as an app, between the sound-effects and
// fullscreen buttons. Where the browser has its own install dialog (Chrome
// and Edge, on Android and desktop) it opens that; on an iPhone, or an
// Android browser without one, it shows how to do it from the browser's menu.
// Hidden once installed, and anywhere installing isn't on offer.
export function createInstallToggle(root: HTMLElement, hintRoot: HTMLElement): InstallToggle {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "install-toggle";
  button.innerHTML = INSTALL_ICON;
  button.title = "Install as an app";
  button.setAttribute("aria-label", "Install as an app");
  root.append(button);

  let hint: HTMLElement | null = null;
  const closeHint = () => {
    hint?.remove();
    hint = null;
  };

  const render = () => {
    button.hidden = !installOffered();
    if (button.hidden) closeHint();
  };

  button.addEventListener("click", async () => {
    if (hint) {
      closeHint();
      return;
    }
    if (await promptInstall()) return;
    hint = document.createElement("div");
    hint.className = "install-help";
    hint.setAttribute("role", "status");
    hint.textContent = installInstructions();
    hint.addEventListener("click", closeHint);
    hintRoot.append(hint);
  });

  const stopWatching = onInstallChange(render);
  render();

  return {
    dispose() {
      stopWatching();
      closeHint();
      button.remove();
    },
  };
}
