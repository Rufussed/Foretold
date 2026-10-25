import { API_BASE } from "../services/api";
import { t } from "../i18n";
import { serverError, type ServerError } from "../i18n/server-error";

// Leave Table, for a player still playing their seat: leave for now and keep
// the seat (the gold name and Take your seat bring them back), or quit for
// good, and the server plays the seat to the end (backend playerQuit.ts).
// Styled like the Home windows.
export function openLeaveDialog(
  root: HTMLElement,
  roomId: number,
  token: string,
  leaveTo: string,
): void {
  root.querySelector("#visualizer-leave-dialog")?.remove();

  const backdrop = document.createElement("div");
  backdrop.className = "home-modal-backdrop";
  backdrop.id = "visualizer-leave-dialog";
  backdrop.innerHTML = `
    <section
      class="home-modal"
      role="dialog"
      aria-modal="true"
      aria-labelledby="visualizer-leave-title"
    >
      <button
        type="button"
        class="home-close-button"
        aria-label="${t("common.close")}"
      >
        <span></span>
        <span></span>
      </button>

      <h2 id="visualizer-leave-title">${t("leave.title")}</h2>

      <p class="home-modal-copy">${t("leave.forNowHint")}</p>
      <p class="home-modal-copy">${t("leave.quitHint")}</p>

      <div class="visualizer-leave-actions">
        <button type="button" class="secondary-action" data-leave-for-now>
          ${t("leave.forNow")}
        </button>
        <button type="button" class="home-modal-primary" data-leave-quit>
          ${t("leave.quit")}
        </button>
      </div>
    </section>
  `;

  const close = (): void => {
    backdrop.remove();
    document.removeEventListener("keydown", closeOnEscape);
  };

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
    .querySelector<HTMLButtonElement>("[data-leave-for-now]")
    ?.addEventListener("click", () => {
      close();
      window.location.hash = leaveTo;
    });

  const quitButton =
    backdrop.querySelector<HTMLButtonElement>("[data-leave-quit]");

  quitButton?.addEventListener("click", async () => {
    quitButton.disabled = true;

    try {
      const response = await fetch(`${API_BASE}/wizard/games/${roomId}/quit`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!response.ok) {
        const data = (await response.json().catch(() => null)) as ServerError | null;
        throw new Error(serverError(data, "leave.quitFailed"));
      }

      close();
      window.location.hash = leaveTo;
    } catch (error) {
      quitButton.disabled = false;
      window.alert(error instanceof Error ? error.message : t("leave.quitFailed"));
    }
  });

  document.addEventListener("keydown", closeOnEscape);
  root.append(backdrop);
}
