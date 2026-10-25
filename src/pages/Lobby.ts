import { API_BASE } from "../services/api";
import { displayName } from "../utils/display-name";
import { renderNavbar } from "../components/Navbar";
import { getCurrentUser } from "../services/auth";
import { formatDateTime } from "../utils/format-date-time";
import { escapeHtml } from "../utils/escape-html";
import { t } from "../i18n";
import { serverError, type ServerError } from "../i18n/server-error";

interface LobbyRoom {
  id: number;
  name: string;
  createdAt: string;
  createdBy: number;
  createdByUsername: string;
  players: {
    username: string;
    avatar: string | null;
  }[];
  maxPlayers: number;
  status: "waiting" | "playing";
  isPublic: boolean;
}

type LobbyData = {
  rooms: LobbyRoom[];
};

// A guest's username is a generated id, so they are listed as a stranger.
function playerLabel(username: string): string {
  return escapeHtml(displayName(username));
}

export async function renderLobbyPage(
  container: HTMLElement,
): Promise<void> {
  const token = localStorage.getItem("wizardToken");

  if (!token) {
    window.location.hash = "#/home";
    return;
  }

  const currentUser = await getCurrentUser();

  container.innerHTML = `
    <div id="navbar-container"></div>

      <section class="lobby-content">
        <div class="lobby-title-row">
          <div>

            <h1>${t("nav.glade")}</h1>

          </div>

          <button
            type="button"
            class="create-room-button"
            id="create-room-button"
          >
            <span>+</span>
            ${t("lobby.createRoom")}
          </button>
        </div>

        <section class="rooms-panel">
          <div class="rooms-heading">
            <span>${t("lobby.colRoom")}</span>
            <span>${t("lobby.colCreated")}</span>
            <span>${t("lobby.colPlayers")}</span>
            <span>${t("lobby.colAction")}</span>
          </div>

          <div id="room-list">
            <div class="rooms-loading">
              ${t("lobby.loading")}
            </div>
          </div>
        </section>
      </section>

      <div
        class="room-modal-backdrop"
        id="create-room-modal"
        hidden
      >
        <section
          class="room-modal"
          role="dialog"
          aria-modal="true"
          aria-labelledby="create-room-title"
        >
          <button
            type="button"
            class="room-modal-close"
            id="close-create-room"
            aria-label="${t("common.close")}"
          >
            ×
          </button>

          <p class="lobby-kicker">${t("lobby.newTable")}</p>

          <h2 id="create-room-title">
            ${t("lobby.createRoom")}
          </h2>

          <p class="room-modal-description">
            ${t("lobby.modalDescription")}
          </p>

          <form id="create-room-form">
            <label class="room-form-field">
              <span>${t("lobby.roomName")}</span>

              <input
                name="roomName"
                type="text"
                maxlength="40"
                autocomplete="off"
                placeholder="${t("lobby.roomNamePlaceholder")}"
                required
              />
            </label>

            <label class="room-form-field" for="roomVisibility">
              <span>${t("lobby.visibility")}</span>
              <select
                class="room-visibility-select"
                id="roomVisibility"
                name="isPublic"
              >
              <option value="true" selected>${t("lobby.public")}</option>
              <option value="false">${t("lobby.private")}</option>
            </select>
            </label>
            <fieldset class="room-form-field">
              <legend>${t("lobby.maxPlayers")}</legend>

              <div class="player-count-options">
                <label>
                  <input
                    type="radio"
                    name="maxPlayers"
                    value="3"
                  />
                  <span>3</span>
                </label>

                <label>
                  <input
                    type="radio"
                    name="maxPlayers"
                    value="4"
                    checked
                  />
                  <span>4</span>
                </label>

                <label>
                  <input
                    type="radio"
                    name="maxPlayers"
                    value="5"
                  />
                  <span>5</span>
                </label>

                <label>
                  <input
                    type="radio"
                    name="maxPlayers"
                    value="6"
                  />
                  <span>6</span>
                </label>
              </div>
            </fieldset>

            <div class="room-form-actions">
              <button
                type="button"
                class="secondary-action"
                id="cancel-create-room"
              >
                ${t("common.cancel")}
              </button>

              <button
                type="submit"
                class="create-room-submit"
              >
                ${t("lobby.createRoom")}
              </button>
            </div>
          </form>
        </section>
      </div>
    </main>
  `;

   const navbarContainer =
    container.querySelector<HTMLDivElement>("#navbar-container");

  if (navbarContainer) {
    renderNavbar(navbarContainer, currentUser);
  }

  const roomList =
    document.querySelector<HTMLDivElement>("#room-list");

  const createRoomButton =
    document.querySelector<HTMLButtonElement>(
      "#create-room-button",
    );

  const createRoomModal =
    document.querySelector<HTMLDivElement>(
      "#create-room-modal",
    );

  const createRoomForm =
    document.querySelector<HTMLFormElement>(
      "#create-room-form",
    );

  const closeCreateRoomButton =
    document.querySelector<HTMLButtonElement>(
      "#close-create-room",
    );

  const cancelCreateRoomButton =
    document.querySelector<HTMLButtonElement>(
      "#cancel-create-room",
    );

  function openCreateRoomModal(): void {
    if (!createRoomModal) {
      return;
    }

    createRoomModal.hidden = false;

    const roomNameInput =
      createRoomForm?.querySelector<HTMLInputElement>(
        '[name="roomName"]',
      );

    roomNameInput?.focus();
  }

  function closeCreateRoomModal(): void {
    if (!createRoomModal) {
      return;
    }

    createRoomModal.hidden = true;
  }

  createRoomButton?.addEventListener(
    "click",
    openCreateRoomModal,
  );

  closeCreateRoomButton?.addEventListener(
    "click",
    closeCreateRoomModal,
  );

  cancelCreateRoomButton?.addEventListener(
    "click",
    closeCreateRoomModal,
  );

  createRoomModal?.addEventListener(
    "click",
    (event) => {
      if (event.target === createRoomModal) {
        closeCreateRoomModal();
      }
    },
  );

  document.addEventListener(
    "keydown",
    (event) => {
      if (
        event.key === "Escape" &&
        createRoomModal &&
        !createRoomModal.hidden
      ) {
        closeCreateRoomModal();
      }
    },
  );

  async function loadRooms(): Promise<void> {
    if (!roomList) {
      return;
    }

    try {
      const response = await fetch(
        `${API_BASE}/wizard/lobby`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        },
      );

      if (!response.ok) {
        throw new Error("Could not load rooms");
      }

      const data =
        (await response.json()) as LobbyData;

      if (!data.rooms || data.rooms.length === 0) {
        roomList.innerHTML = `
          <div class="rooms-empty">
            <h3>${t("lobby.empty")}</h3>
            <p>
              ${t("lobby.emptyHint")}
            </p>
          </div>
        `;

        return;
      }

      roomList.innerHTML = data.rooms
        .map((room) => {
          const isMember = room.players.some(
            (player) =>
              player.username === currentUser.username,
          );

          const playerCount =
            `${room.players.length}/${room.maxPlayers}`;

          return `
            <article class="room-row">
              <strong class="room-name">
                ${escapeHtml(room.name)}
              </strong>

              <div class="room-created">
                <span class="room-created-at">
                  ${formatDateTime(room.createdAt)}
                </span>

                <span class="room-creator">
                  ${t("lobby.createdBy", { name: playerLabel(room.createdByUsername) })}
                </span>
              </div>

              <div class="player-count">
                <span class="player-count-number">
                  ${playerCount}
                </span>
                <ul class="player-count-names">
                  ${room.players
                    .map((player) => `<li>${playerLabel(player.username)}</li>`)
                    .join("")}
                </ul>
              </div>

              <div class="room-actions">
                ${
                  room.status === "playing"
                    ? isMember
                      ? `
                        <button
                          type="button"
                          class="room-action-button"
                          data-room-id="${room.id}"
                          data-room-action="open-game"
                        >
                          ${t("lobby.returnToGame")}
                        </button>
                      `
                      : `
                        <button
                          type="button"
                          class="room-action-button"
                          disabled
                        >
                          ${t("lobby.inProgress")}
                        </button>
                      `
                    : isMember
                      ? `
                        <button
                          type="button"
                          class="room-action-button"
                          data-room-id="${room.id}"
                          data-room-action="open"
                        >
                          ${t("lobby.openRoom")}
                        </button>
                        ${
                          room.createdBy !== currentUser.id
                            ? `
                              <button
                                type="button"
                                class="room-action-button"
                                data-room-id="${room.id}"
                                data-room-action="unjoin"
                              >
                                ${t("lobby.leave")}
                              </button>
                            `
                            : ""
                        }
                      `
                      : `
                        <button
                          type="button"
                          class="room-action-button"
                          data-room-id="${room.id}"
                          data-room-action="join"
                        >
                          ${t("lobby.join")}
                        </button>
                      `
                }

                <span class="room-delete-slot">
                  ${
                    room.status === "waiting" &&
                    room.createdBy === currentUser.id
                      ? `
                        <button
                          type="button"
                          class="room-delete-button"
                          data-delete-room-id="${room.id}"
                          aria-label="${t("lobby.deleteRoom", { name: escapeHtml(room.name) })}"
                        >
                          ${t("common.delete")}
                        </button>
                      `
                      : ""
                  }
                </span>
              </div>              
            </article>
          `;
        })
        .join("");

      attachRoomEvents();
    } catch (error) {
      console.error(
        "Could not load rooms:",
        error,
      );

      roomList.innerHTML = `
        <div class="rooms-error">
          <h3>${t("lobby.loadFailed")}</h3>
          <p>
            ${t("lobby.loadFailedHint")}
          </p>

          <button
            type="button"
            class="rooms-empty-button"
            id="retry-load-rooms"
          >
            ${t("common.tryAgain")}
          </button>
        </div>
      `;

      document
        .querySelector<HTMLButtonElement>(
          "#retry-load-rooms",
        )
        ?.addEventListener(
          "click",
          () => {
            void loadRooms();
          },
        );
    }
  }

  function attachRoomEvents(): void {
    roomList
      ?.querySelectorAll<HTMLButtonElement>(
        "[data-room-id]",
      )
      .forEach((button) => {
        button.addEventListener(
          "click",
          async () => {
            const roomIdValue =
              button.dataset.roomId;

            if (!roomIdValue) {
              return;
            }

            const roomId =
              Number(roomIdValue);

            if (
              !Number.isInteger(roomId) ||
              roomId <= 0
            ) {
              return;
            }

            // Room.ts handles joining/opening the room.
            const action = button.dataset.roomAction;

            if (action === "unjoin") {
              const confirmed = window.confirm(
                t("lobby.confirmLeave"),
              );

              if (!confirmed) {
                return;
              }

              button.disabled = true;

              try {
                const response = await fetch(
                  `${API_BASE}/wizard/lobby/${roomId}/leave`,
                  {
                    method: "DELETE",
                    headers: {
                      Authorization: `Bearer ${token}`,
                    },
                  },
                );

                const data = (await response.json()) as ServerError;

                if (!response.ok) {
                  throw new Error(
                    serverError(data, "lobby.leaveFailed"),
                  );
                }

                await loadRooms();
              } catch (error) {
                console.error("Could not leave room:", error);

                alert(
                  error instanceof Error
                    ? error.message
                    : t("lobby.leaveFailed"),
                );

                button.disabled = false;
              }

              return;
            }

            if (action === "unavailable") {
              return;
            }

            if (action === "open-game") {
              window.location.hash = `#/game/${roomId}/visualizer`;
              return;
            }

            if (action === "unjoin") {
              // Keep your existing unjoin logic here.
              // It should send the DELETE request and reload the room list.
              // Do not replace that existing logic.
              // ...
              return;
            }

            window.location.hash = `#/room/${roomId}`;
          },
        );
      });

    roomList
      ?.querySelectorAll<HTMLButtonElement>(
        "[data-delete-room-id]",
      )
      .forEach((button) => {
        button.addEventListener(
          "click",
          async () => {
            const roomIdValue =
              button.dataset.deleteRoomId;

            if (!roomIdValue) {
              return;
            }

            const roomId =
              Number(roomIdValue);

            if (
              !Number.isInteger(roomId) ||
              roomId <= 0
            ) {
              return;
            }

            const confirmed =
              window.confirm(
                t("lobby.confirmDelete"),
              );

            if (!confirmed) {
              return;
            }

            button.disabled = true;

            try {
              const response =
                await fetch(
                  `${API_BASE}/wizard/lobby/${roomId}`,
                  {
                    method: "DELETE",
                    headers: {
                      Authorization:
                        `Bearer ${token}`,
                    },
                  },
                );

              const data =
                (await response.json()) as ServerError;

              if (!response.ok) {
                throw new Error(
                  serverError(data, "lobby.deleteFailed"),
                );
              }

              await loadRooms();
            } catch (error) {
              console.error(
                "Could not delete room:",
                error,
              );

              alert(
                error instanceof Error
                  ? error.message
                  : t("lobby.deleteFailed"),
              );

              button.disabled = false;
            }
          },
        );
      });
  }

  createRoomForm?.addEventListener(
    "submit",
    async (event) => {
      event.preventDefault();

      const formData =
        new FormData(createRoomForm);

      const name =
        String(
          formData.get("roomName") ?? "",
        ).trim();

      const maxPlayers =
        Number(
          formData.get("maxPlayers"),
        );

      const isPublic = formData.get("isPublic") !== "false";

      if (!name) {
        return;
      }

      const submitButton =
        createRoomForm.querySelector<HTMLButtonElement>(
          ".create-room-submit",
        );

      if (submitButton) {
        submitButton.disabled = true;
      }

      try {
        const response =
          await fetch(
            `${API_BASE}/wizard/lobby/create`,
            {
              method: "POST",
              headers: {
                "Content-Type":
                  "application/json",
                Authorization:
                  `Bearer ${token}`,
              },
              body: JSON.stringify({
                name,
                maxPlayers,
                isPublic,
              }),
            },
          );

        const data =
          (await response.json()) as ServerError;

        if (!response.ok) {
          throw new Error(
            serverError(data, "lobby.createFailed"),
          );
        }

        createRoomForm.reset();
        closeCreateRoomModal();

        await loadRooms();
      } catch (error) {
        console.error(
          "Could not create room:",
          error,
        );

        alert(
          error instanceof Error
            ? error.message
            : t("lobby.createFailed"),
        );
      } finally {
        if (submitButton) {
          submitButton.disabled = false;
        }
      }
    },
  );

  void loadRooms();
}
