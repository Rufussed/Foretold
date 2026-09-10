import { startRouter } from "./router/router";

// Mount the application once; the router owns all later screen changes.
export function renderApp(container: HTMLElement): void {
  startRouter(container);
}