import { startRouter } from "./router/router";

export function renderApp(container: HTMLElement): void {
  startRouter(container);
}