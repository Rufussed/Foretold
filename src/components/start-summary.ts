import { escapeHtml } from "../utils/escape-html";
import { t } from "../i18n";

export interface StartSummaryRow {
  label: string;
  value: string;
  // Set apart from the default, so the host's own choices stand out.
  changed?: boolean;
}

// The host's last look before a game starts: everything chosen in the room,
// none of which can change once it runs. Begin starts the game (onBegin);
// Back, the cross, a click beside it or Escape return to the settings.
// Styled like the Home windows.
export function openStartSummary(
  rows: StartSummaryRow[],
  onBegin: () => void,
): void {
  document.querySelector("#room-start-summary")?.remove();

  const backdrop = document.createElement("div");
  backdrop.className = "home-modal-backdrop";
  backdrop.id = "room-start-summary";
  backdrop.innerHTML = `
    <section
      class="home-modal"
      role="dialog"
      aria-modal="true"
      aria-labelledby="room-start-summary-title"
    >
      <button
        type="button"
        class="home-close-button"
        aria-label="${t("common.close")}"
      >
        <span></span>
        <span></span>
      </button>

      <h2 id="room-start-summary-title">${t("start.title")}</h2>

      <dl class="start-summary-list">
        ${rows
          .map(
            ({ label, value, changed }) => `
              <dt>${escapeHtml(label)}</dt>
              <dd${changed ? ` class="is-changed"` : ""}>${escapeHtml(value)}</dd>
            `,
          )
          .join("")}
      </dl>

      <p class="home-modal-copy start-summary-note">${t("start.note")}</p>

      <div class="visualizer-leave-actions">
        <button type="button" class="secondary-action" data-start-back>
          ${t("start.back")}
        </button>
        <button type="button" class="home-modal-primary" data-start-begin>
          ${t("start.begin")}
        </button>
      </div>
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

  // Only a press that began on the backdrop closes it, as on Home.
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
  backdrop
    .querySelector<HTMLButtonElement>("[data-start-back]")
    ?.addEventListener("click", close);
  backdrop
    .querySelector<HTMLButtonElement>("[data-start-begin]")
    ?.addEventListener("click", () => {
      close();
      onBegin();
    });

  document.addEventListener("keydown", closeOnEscape);
  window.addEventListener("hashchange", close);
  document.body.append(backdrop);

  backdrop.querySelector<HTMLButtonElement>("[data-start-begin]")?.focus();
}
