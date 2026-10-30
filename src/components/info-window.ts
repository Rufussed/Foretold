import { t } from "../i18n";

// A window of text over the page, styled like the Home windows: the navbar's
// help, and a Roles room's description of the roles. It closes with the cross,
// a click beside it, Escape or a change of page. One window per id at a time.
export function openInfoWindow(id: string, title: string, bodyHtml: string): void {
  document.querySelector(`#${id}`)?.remove();

  const backdrop = document.createElement("div");
  backdrop.className = "home-modal-backdrop";
  backdrop.id = id;
  backdrop.innerHTML = `
    <section
      class="home-modal"
      role="dialog"
      aria-modal="true"
      aria-labelledby="${id}-title"
    >
      <button
        type="button"
        class="home-close-button"
        aria-label="${t("common.close")}"
      >
        <span></span>
        <span></span>
      </button>

      <h2 id="${id}-title">${title}</h2>

      ${bodyHtml}
    </section>
  `;

  function close(): void {
    backdrop.remove();
    document.removeEventListener("keydown", closeOnEscape);
    window.removeEventListener("hashchange", close);
  }

  function closeOnEscape(event: KeyboardEvent): void {
    if (event.key === "Escape") {
      close();
    }
  }

  // Only a press that began on the backdrop closes it, as on Home, so
  // selecting text in the window and letting go beside it does not.
  let pressedOnBackdrop = false;
  backdrop.addEventListener("pointerdown", (event) => {
    pressedOnBackdrop = event.target === backdrop;
  });
  backdrop.addEventListener("click", (event) => {
    if (event.target === backdrop && pressedOnBackdrop) {
      close();
    }
    pressedOnBackdrop = false;
  });

  backdrop
    .querySelector<HTMLButtonElement>(".home-close-button")
    ?.addEventListener("click", close);
  document.addEventListener("keydown", closeOnEscape);
  window.addEventListener("hashchange", close);

  document.body.append(backdrop);
}
