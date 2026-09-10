import "./style.css";
import { renderApp } from "./app";

// Keep the entry point limited to bootstrapping. Application composition and
// route-specific rendering belong to the layers below it.
const app = document.querySelector<HTMLDivElement>("#app");

if (!app) {
  throw new Error("The #app element was not found");
}

renderApp(app);