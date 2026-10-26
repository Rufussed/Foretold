import { t, getLanguage, setLanguage } from "../i18n";
import { escapeHtml } from "../utils/escape-html";
import {
  getInvite,
  getInvitedGuestRoomId,
  getToken,
  joinAsGuest,
  joinByInvite,
  type InviteInfo,
} from "../services/auth";

// Where an invite link leads (#/join/<code>): who invites, to which room, and
// a name to play under. No sign-up: the guest sits down at once, and their
// name is theirs for this one game. A signed-up wizard joins as themselves.
export async function renderJoinPage(container: HTMLElement, code: string): Promise<void> {
  // A guest coming back by the same link (a closed tab, a phone that dropped
  // the page) still has their seat: straight back to it.
  const seatedRoomId = getInvitedGuestRoomId();

  if (seatedRoomId !== null) {
    window.location.hash = `#/room/${seatedRoomId}`;
    return;
  }

  container.innerHTML = `
    <main class="join-page">
      <button type="button" class="join-language" id="join-language">
        ${t("language.switchTo")}
      </button>
      <section class="join-card" aria-live="polite">
        <p class="lobby-kicker">${t("join.kicker")}</p>
        <p class="join-message">${t("join.loading")}</p>
      </section>
    </main>
  `;

  container.querySelector("#join-language")?.addEventListener("click", () => {
    setLanguage(getLanguage() === "de" ? "en" : "de");
  });

  const card = container.querySelector<HTMLElement>(".join-card");

  if (!card) {
    return;
  }

  let invite: InviteInfo;

  try {
    invite = await getInvite(code);
  } catch (error) {
    if (!card.isConnected) return;
    showEnd(card, error instanceof Error ? error.message : t("join.invalid"));
    return;
  }

  if (!card.isConnected) {
    return;
  }

  if (invite.status !== "waiting") {
    showEnd(card, t("join.started"));
    return;
  }

  const isFull = invite.players >= invite.maxPlayers;
  const loggedIn = getToken() !== null;

  card.innerHTML = `
    <p class="lobby-kicker">${t("join.kicker")}</p>
    <h1 class="join-title">
      ${t("join.title", {
        host: escapeHtml(invite.hostName),
        room: `<span class="room-intro-name">${escapeHtml(invite.roomName)}</span>`,
      })}
    </h1>
    <p class="join-seats">
      ${t(isFull ? "join.full" : "join.seats", {
        count: String(invite.players),
        max: String(invite.maxPlayers),
      })}
    </p>

    ${
      isFull
        ? ""
        : loggedIn
          ? `
            <button type="button" class="create-room-submit join-submit" id="join-self">
              ${t("join.asSelf")}
            </button>
          `
          : `
            <form class="join-form" id="join-form" novalidate>
              <label class="room-form-field" for="join-name">
                <span>${t("join.nameLabel")}</span>
                <input
                  id="join-name"
                  name="name"
                  type="text"
                  maxlength="20"
                  autocomplete="nickname"
                  placeholder="${t("join.namePlaceholder")}"
                  required
                />
              </label>
              <button type="submit" class="create-room-submit join-submit">
                ${t("join.asGuest")}
              </button>
              <p class="join-note">${t("join.note")}</p>
            </form>
          `
    }

    <p class="join-error" id="join-error" role="alert" hidden></p>
  `;

  const errorEl = card.querySelector<HTMLParagraphElement>("#join-error");
  const showError = (message: string) => {
    if (!errorEl) return;
    errorEl.textContent = message;
    errorEl.hidden = !message;
  };

  // Either way in ends in the Antechamber, with a seat.
  const enter = async (button: HTMLButtonElement, join: () => Promise<number>) => {
    button.disabled = true;
    showError("");

    try {
      const roomId = await join();
      window.location.hash = `#/room/${roomId}`;
    } catch (error) {
      showError(error instanceof Error ? error.message : t("join.failed"));
      button.disabled = false;
    }
  };

  const selfButton = card.querySelector<HTMLButtonElement>("#join-self");
  selfButton?.addEventListener("click", () => {
    void enter(selfButton, () => joinByInvite(code));
  });

  const form = card.querySelector<HTMLFormElement>("#join-form");
  const nameInput = card.querySelector<HTMLInputElement>("#join-name");
  nameInput?.focus();

  form?.addEventListener("submit", (event) => {
    event.preventDefault();
    const submit = form.querySelector<HTMLButtonElement>("button[type=submit]");
    const name = nameInput?.value.trim() ?? "";

    if (!submit) return;

    if (!name) {
      showError(t("join.nameMissing"));
      nameInput?.focus();
      return;
    }

    void enter(submit, () => joinAsGuest(code, name));
  });
}

// An invitation that leads nowhere any more, with the way to the site.
function showEnd(card: HTMLElement, message: string): void {
  card.innerHTML = `
    <p class="lobby-kicker">${t("join.kicker")}</p>
    <p class="join-message">${escapeHtml(message)}</p>
    <a class="create-room-submit join-submit join-home" href="#/home">${t("join.toHome")}</a>
  `;
}
