import { API_BASE } from "../services/api";
import { renderNavbar } from "../components/Navbar";
import { getCurrentUser } from "../services/auth";

interface LobbyRoom {
  id: number;
  name: string;
  createdBy: number;
  createdByUsername: string;
  players: {
    username: string;
    avatar: string | null;
  }[];
  maxPlayers: number;
  status: "waiting" | "playing";
}

type LobbyData = {
  rooms: LobbyRoom[];
};

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

            <h1>Lobby</h1>

          </div>

          <button
            type="button"
            class="create-room-button"
            id="create-room-button"
          >
            <span>+</span>
            Create Room
          </button>
        </div>

        <section class="rooms-panel">
          <div class="rooms-heading">
            <span>Room</span>
            <span>Host</span>
            <span>Players</span>
            <span>Access</span>
            <span>Action</span>
          </div>

          <div id="room-list">
            <div class="rooms-loading">
              Loading rooms...
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
            aria-label="Close"
          >
            ×
          </button>

          <p class="lobby-kicker">NEW TABLE</p>

          <h2 id="create-room-title">
            Create Room
          </h2>

          <p class="room-modal-description">
            Prepare a table for your next Wizard game.
          </p>

          <form id="create-room-form">
            <label class="room-form-field">
              <span>Room name</span>

              <input
                name="roomName"
                type="text"
                maxlength="40"
                autocomplete="off"
                placeholder="Enter a room name"
                required
              />
            </label>

            <fieldset class="room-form-field">
              <legend>Maximum players</legend>

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

            <div class="room-access-preview">
              <div>
                <span class="room-access-label">
                  Access
                </span>

                <strong>PUBLIC</strong>
              </div>

              <small>
                Private rooms will be available in a future update.
              </small>
            </div>

            <div class="room-form-actions">
              <button
                type="button"
                class="secondary-action"
                id="cancel-create-room"
              >
                Cancel
              </button>

              <button
                type="submit"
                class="create-room-submit"
              >
                Create Room
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
            <h3>No rooms available</h3>
            <p>
              Create the first table and start a game.
            </p>

            <button
              type="button"
              class="rooms-empty-button"
              id="empty-create-room"
            >
              Create Room
            </button>
          </div>
        `;

        document
          .querySelector<HTMLButtonElement>(
            "#empty-create-room",
          )
          ?.addEventListener(
            "click",
            openCreateRoomModal,
          );

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

          const statusLabel =
            room.status === "playing"
              ? "IN GAME"
              : "WAITING";

          return `
            <article class="room-row">
              <div class="room-main-info">
                <strong class="room-name">
                  ${room.name}
                </strong>

                <span class="room-status">
                  ${statusLabel}
                </span>
              </div>

              <div class="room-creator">
                ${room.createdByUsername}
              </div>

              <div class="player-count">
                <span class="player-count-number">
                  ${playerCount}
                </span>
                <span>players</span>
              </div>

              <div>
                <span class="access-badge">
                  PUBLIC
                </span>
              </div>

              <div class="room-actions">
                <button
                  type="button"
                  class="room-action-button"
                  data-room-id="${room.id}"
                >
                  ${isMember ? "Open Room" : "Join"}
                </button>

                <button
                  type="button"
                  class="room-delete-button"
                  data-delete-room-id="${room.id}"
                  aria-label="Delete ${room.name}"
                >
                  Delete
                </button>
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
          <h3>Could not load rooms</h3>
          <p>
            Please try again.
          </p>

          <button
            type="button"
            class="rooms-empty-button"
            id="retry-load-rooms"
          >
            Try Again
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
          () => {
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
            window.location.hash =
              `#/room/${roomId}`;
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
                "Are you sure you want to delete this room?",
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
                (await response.json()) as {
                  error?: string;
                };

              if (!response.ok) {
                throw new Error(
                  data.error ??
                    "Could not delete room",
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
                  : "Could not delete room",
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
              }),
            },
          );

        const data =
          (await response.json()) as {
            error?: string;
          };

        if (!response.ok) {
          throw new Error(
            data.error ??
              "Could not create room",
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
            : "Could not create room",
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

// import { getCurrentUser } from "../services/auth";
// import { API_BASE } from "../services/api";


// export async function renderLobbyPage(container: HTMLElement): Promise<void> {
//   const token = localStorage.getItem("wizardToken");

//   if (!token) {
//     window.location.hash = "#/home";
//     return;
//   }

//   const currentUser = await getCurrentUser();

//   container.innerHTML = `
//     <div class="page">
//       <nav class="navbar">
//         <a href="#/home">Home</a>
//         <a href="#/profile">Profile</a>
//       </nav>

//       <main class="panel">
//         <h1>Lobby</h1>

//         <form id="create-room-form">
//           <label>
//             Room name
//             <input name="roomName" type="text" required />
//           </label>

//           <label>
//             Max players (3-6)
//             <select name="maxPlayers">
//               <option value="3">3</option>
//               <option value="4" selected>4</option>
//               <option value="5">5</option>
//               <option value="6">6</option>
//             </select>
//           </label>

//           <button type="submit">Create room</button>
//         </form>

//         <div id="room-list"></div>
//       </main>
//     </div>
//   `;

//   const createRoomForm =
//     document.querySelector<HTMLFormElement>("#create-room-form");

//   const roomList =
//     document.querySelector<HTMLDivElement>("#room-list");

//   async function loadRooms(): Promise<void> {
//     const response = await fetch(`${API_BASE}/wizard/lobby`, {
//       headers: {
//         Authorization: `Bearer ${token}`,
//       },
//     });

//     const data = await response.json();

//     if (!roomList) {
//       return;
//     }

//     if (!data.rooms || data.rooms.length === 0) {
//       roomList.innerHTML = "<p>No rooms available.</p>";
//       return;
//     }

//     roomList.innerHTML = data.rooms
//       .map(
//         (room: {
//           id: number;
//           name: string;
//           createdBy: number;
//           createdByUsername: string;
//           players: { username: string; avatar: string | null }[];
//           maxPlayers: number;
//           status: "waiting" | "playing";
//         }) => {
//           const isMember = room.players.some(
//             (player) => player.username === currentUser.username,
//           );

//           return `
//             <div class="panel">
//               <h3>${room.name}</h3>
              
//               <p>Room ID: ${room.id}</p>
//               <p>Created by: ${room.createdByUsername}</p>
//               <p>
//                 ${room.players.length}/${room.maxPlayers} players
//               </p>

//               <button
//                 type="button"
//                 data-room-id="${room.id}"
//               >
//                 ${isMember ? "Open room" : "Join"}
//               </button>

//               ${
//                 //to delete room only by creator
//                 // room.createdBy === currentUser.id && room.status === "waiting"
//                 true
//                   ? `
//                     <button
//                       type="button"
//                       data-delete-room-id="${room.id}"
//                     >
//                       Delete Room
//                     </button>
//                   `
//                   : ""
//               }
//             </div>
//           `;
//         },
//       )
//       .join("");

//     /*
//      * JOIN ROOM
//      */
//     roomList
//       .querySelectorAll<HTMLButtonElement>("[data-room-id]")
//       .forEach((button) => {
//         button.addEventListener("click", async () => {
//           const roomIdValue = button.dataset.roomId;

//           if (!roomIdValue) {
//             return;
//           }

//           const roomId = Number(roomIdValue);

//           if (!Number.isInteger(roomId) || roomId <= 0) {
//             return;
//           }

//           // The waiting room joins on arrival, so it doubles as a room link.
//           window.location.hash = `#/room/${roomId}`;
//         });
//       });

//       /*
//  * DELETE ROOM
//  */

//     roomList
//       .querySelectorAll<HTMLButtonElement>("[data-delete-room-id]")
//       .forEach((button) => {
//         button.addEventListener("click", async () => {
//           const roomIdValue = button.dataset.deleteRoomId;

//           if (!roomIdValue) {
//             return;
//           }

//           const roomId = Number(roomIdValue);

//           if (!Number.isInteger(roomId) || roomId <= 0) {
//             return;
//           }

//           const confirmed = window.confirm(
//             "Are you sure you want to delete this room?",
//           );

//           if (!confirmed) {
//             return;
//           }

//           button.disabled = true;

//           try {
//             const response = await fetch(
//               `${API_BASE}/wizard/lobby/${roomId}`,
//               {
//                 method: "DELETE",
//                 headers: {
//                   Authorization: `Bearer ${token}`,
//                 },
//               },
//             );

//             const data = (await response.json()) as {
//               error?: string;
//             };

//             if (!response.ok) {
//               throw new Error(
//                 data.error ?? "Could not delete room",
//               );
//             }

//             await loadRooms();
//           } catch (error) {
//             console.error("Could not delete room:", error);

//             alert(
//               error instanceof Error
//                 ? error.message
//                 : "Could not delete room",
//             );

//             button.disabled = false;
//           }
//         });
//       });
//   }

//   /*
//    * CREATE ROOM
//    */
//   createRoomForm?.addEventListener(
//     "submit",
//     async (event) => {
//       event.preventDefault();

//       const formData = new FormData(createRoomForm);

//       const name = String(
//         formData.get("roomName") ?? "",
//       );

//       const maxPlayers = Number(
//         formData.get("maxPlayers"),
//       );

//       const response = await fetch(
//         `${API_BASE}/wizard/lobby/create`,
//         {
//           method: "POST",
//           headers: {
//             "Content-Type": "application/json",
//             Authorization: `Bearer ${token}`,
//           },
//           body: JSON.stringify({
//             name,
//             maxPlayers,
//           }),
//         },
//       );

//       if (response.ok) {
//         createRoomForm.reset();
//         await loadRooms();
//       }
//     },
//   );

  
//   void loadRooms();
// }