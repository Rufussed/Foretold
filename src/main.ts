import "./style.css";
import "@fontsource-variable/cinzel";
import { renderApp } from "./app";
import { captureInstallPrompt } from "./utils/pwa-install";

// Keep the entry point limited to bootstrapping. Application composition and
// route-specific rendering belong to the layers below it.
const app = document.querySelector<HTMLDivElement>("#app");

if (!app) {
  throw new Error("The #app element was not found");
}

// Before anything renders: the browser offers its install dialog once, early.
captureInstallPrompt();
renderApp(app);