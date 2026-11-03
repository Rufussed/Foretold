import { t, getLanguage, setLanguage } from "../i18n";
import { escapeHtml } from "../utils/escape-html";
import { followAccountLink } from "../services/auth";

// Where the links in the site's mails lead: #/verify/<token> confirms the
// address, #/reset/<token> asks for a new password. Either ends signed in.
// One card in the middle, like an invite link's page (pages/Join.ts).
export function renderAccountLinkPage(
  container: HTMLElement,
  kind: "verify" | "reset",
  token: string,
): void {
  container.innerHTML = `
    <main class="join-page">
      <button type="button" class="join-language" id="account-language">
        ${t("language.switchTo")}
      </button>
      <section class="join-card" aria-live="polite"></section>
    </main>
  `;

  container.querySelector("#account-language")?.addEventListener("click", () => {
    setLanguage(getLanguage() === "de" ? "en" : "de");
  });

  const card = container.querySelector<HTMLElement>(".join-card");
  if (!card) return;

  if (kind === "verify") {
    void verify(card, token);
  } else {
    showResetForm(card, token);
  }
}

async function verify(card: HTMLElement, token: string): Promise<void> {
  card.innerHTML = `
    <p class="lobby-kicker">${t("account.kicker")}</p>
    <p class="join-message">${t("account.verifying")}</p>
  `;

  try {
    await followAccountLink("verify-email", token);
    if (card.isConnected) showDone(card, t("account.verified"));
  } catch (error) {
    if (card.isConnected) showFailed(card, error);
  }
}

function showResetForm(card: HTMLElement, token: string): void {
  card.innerHTML = `
    <p class="lobby-kicker">${t("account.kicker")}</p>
    <h1 class="join-title">${t("account.resetTitle")}</h1>
    <form class="join-form" id="account-reset-form" novalidate>
      <label class="room-form-field" for="account-password">
        <span>${t("signup.password")}</span>
        <input
          id="account-password"
          name="password"
          type="password"
          autocomplete="new-password"
          minlength="8"
          required
        />
      </label>
      <label class="room-form-field" for="account-password-again">
        <span>${t("signup.confirmPassword")}</span>
        <input
          id="account-password-again"
          name="confirmPassword"
          type="password"
          autocomplete="new-password"
          minlength="8"
          required
        />
      </label>
      <button type="submit" class="create-room-submit join-submit">
        ${t("account.resetSubmit")}
      </button>
    </form>
    <p class="join-error" id="account-error" role="alert" hidden></p>
  `;

  const form = card.querySelector<HTMLFormElement>("#account-reset-form");
  const errorEl = card.querySelector<HTMLParagraphElement>("#account-error");
  const showError = (message: string) => {
    if (!errorEl) return;
    errorEl.textContent = message;
    errorEl.hidden = !message;
  };

  card.querySelector<HTMLInputElement>("#account-password")?.focus();

  form?.addEventListener("submit", async (event) => {
    event.preventDefault();

    const submit = form.querySelector<HTMLButtonElement>("button[type=submit]");
    const data = new FormData(form);
    const password = String(data.get("password") ?? "");

    if (password.length < 8) {
      showError(t("error.passwordTooShort"));
      return;
    }
    if (password !== String(data.get("confirmPassword") ?? "")) {
      showError(t("signup.passwordMismatch"));
      return;
    }

    if (submit) submit.disabled = true;
    showError("");

    try {
      await followAccountLink("reset-password", token, password);
      if (card.isConnected) showDone(card, t("account.resetDone"));
    } catch (error) {
      if (card.isConnected) showFailed(card, error);
    }
  });
}

// Signed in now: on to the lobby. The link worked once and would fail if
// opened again, so the address bar forgets it: a reload (or a language
// switch, which redraws the page) lands in the lobby instead.
function showDone(card: HTMLElement, message: string): void {
  history.replaceState(null, "", "#/lobby");
  card.innerHTML = `
    <p class="lobby-kicker">${t("account.kicker")}</p>
    <p class="join-message">${escapeHtml(message)}</p>
    <a class="create-room-submit join-submit join-home" href="#/lobby">${t("account.toGlade")}</a>
  `;
}

// An unknown, used or expired link: a new one comes from the login form.
function showFailed(card: HTMLElement, error: unknown): void {
  const message = error instanceof Error ? error.message : t("account.linkFailed");
  card.innerHTML = `
    <p class="lobby-kicker">${t("account.kicker")}</p>
    <p class="join-message">${escapeHtml(message)}<br />${t("account.linkHint")}</p>
    <a class="create-room-submit join-submit join-home" href="#/home">${t("join.toHome")}</a>
  `;
}
