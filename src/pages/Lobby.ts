import { getCurrentUser } from "../services/auth";

const API_BASE = "http://127.0.0.1:3000";

export async function renderLobbyPage(container: HTMLElement): Promise<void> {
  const token = localStorage.getItem("wizardToken");

  if (!token) {
    window.location.hash = "#/home";
    return;
  }

  const currentUser = await getCurrentUser();

  container.innerHTML = `
    <div class="page">
      <nav class="navbar">
        <a href="#/home">Home</a>
        <a href="#/profile">Profile</a>
      </nav>

      <main class="panel">
        <h1>Lobby</h1>

        <form id="create-room-form">
          <label>
            Room name
            <input name="roomName" type="text" required />
          </label>

          <label>
            Max players (3-6)
            <select name="maxPlayers">
              <option value="3">3</option>
              <option value="4" selected>4</option>
              <option value="5">5</option>
              <option value="6">6</option>
            </select>
          </label>

          <button type="submit">Create room</button>
        </form>

        <div id="room-list"></div>
      </main>
    </div>
  `;

  const createRoomForm =
    document.querySelector<HTMLFormElement>("#create-room-form");

  const roomList =
    document.querySelector<HTMLDivElement>("#room-list");

  async function loadRooms(): Promise<void> {
    const response = await fetch(`${API_BASE}/wizard/lobby`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    const data = await response.json();

    if (!roomList) {
      return;
    }

    if (!data.rooms || data.rooms.length === 0) {
      roomList.innerHTML = "<p>No rooms available.</p>";
      return;
    }

    roomList.innerHTML = data.rooms
      .map(
        (room: {
          id: number;
          name: string;
          createdBy: number;
          players: string[];
          maxPlayers: number;
          status: "waiting" | "playing";
        }) => {
          const minimumBots = Math.max(
            0,
            3 - room.players.length,
          );

          const maximumBots =
            room.maxPlayers - room.players.length;

          if (minimumBots > maximumBots) {
            return "";
          }

          const botOptions = Array.from(
            {
              length: maximumBots - minimumBots + 1,
            },
            (_, index) => {
              const botCount = minimumBots + index;

              return `
                <option
                  value="${botCount}"
                  ${botCount === minimumBots ? "selected" : ""}
                >
                  ${botCount}
                </option>
              `;
            },
          ).join("");

          return `
            <div class="panel">
              <h3>${room.name}</h3>

              <p>Room ID: ${room.id}</p>

              <p>
                ${room.players.length}/${room.maxPlayers} players
              </p>

              <button
                type="button"
                data-room-id="${room.id}"
              >
                Join
              </button>

              <label>
                Bots
                <select data-bot-count-room-id="${room.id}">
                  ${botOptions}
                </select>
              </label>

              <button
                type="button"
                data-start-room-id="${room.id}"
              >
                Start Game
              </button>
              ${
                room.createdBy === currentUser.id && room.status === "waiting"
                  ? `
                    <button
                      type="button"
                      data-delete-room-id="${room.id}"
                    >
                      Delete Room
                    </button>
                  `
                  : ""
              }
            </div>
          `;
        },
      )
      .join("");

    /*
     * JOIN ROOM
     */
    roomList
      .querySelectorAll<HTMLButtonElement>("[data-room-id]")
      .forEach((button) => {
        button.addEventListener("click", async () => {
          const roomIdValue = button.dataset.roomId;

          if (!roomIdValue) {
            return;
          }

          const roomId = Number(roomIdValue);

          if (!Number.isInteger(roomId) || roomId <= 0) {
            return;
          }

          button.disabled = true;

          try {
            const response = await fetch(
              `${API_BASE}/wizard/lobby/join`,
              {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                  Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify({ roomId }),
              },
            );

            const data = (await response.json()) as {
              error?: string;
            };

            if (!response.ok) {
              throw new Error(
                data.error ?? "Could not join room",
              );
            }

            await loadRooms();
          } catch (error) {
            console.error("Could not join room:", error);

            alert(
              error instanceof Error
                ? error.message
                : "Could not join room",
            );

            button.disabled = false;
          }
        });
      });

    /*
     * START GAME
     */
    roomList
      .querySelectorAll<HTMLButtonElement>("[data-start-room-id]")
      .forEach((button) => {
        button.addEventListener("click", async () => {
          const roomIdValue = button.dataset.startRoomId;

          if (!roomIdValue) {
            return;
          }

          const roomId = Number(roomIdValue);

          if (!Number.isInteger(roomId) || roomId <= 0) {
            return;
          }

          const botCountSelect =
            roomList.querySelector<HTMLSelectElement>(
              `[data-bot-count-room-id="${roomId}"]`,
            );

          const botCount = Number(
            botCountSelect?.value ?? 0,
          );

          if (!Number.isInteger(botCount) || botCount < 0) {
            return;
          }

          button.disabled = true;

          try {
            const response = await fetch(
              `${API_BASE}/wizard/games`,
              {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                  Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify({
                  roomId,
                  botCount,
                }),
              },
            );

            const data = (await response.json()) as {
              error?: string;
            };

            if (!response.ok && response.status !== 409) {
              throw new Error(
                data.error ?? "Could not start game",
              );
            }

            window.location.hash = `#/game/${roomId}`;
          } catch (error) {
            console.error("Could not start game:", error);

            button.disabled = false;

            alert(
              error instanceof Error
                ? error.message
                : "Could not start game",
            );
          }
        });
      });
      /*
 * DELETE ROOM
 */

    roomList
      .querySelectorAll<HTMLButtonElement>("[data-delete-room-id]")
      .forEach((button) => {
        button.addEventListener("click", async () => {
          const roomIdValue = button.dataset.deleteRoomId;

          if (!roomIdValue) {
            return;
          }

          const roomId = Number(roomIdValue);

          if (!Number.isInteger(roomId) || roomId <= 0) {
            return;
          }

          const confirmed = window.confirm(
            "Are you sure you want to delete this room?",
          );

          if (!confirmed) {
            return;
          }

          button.disabled = true;

          try {
            const response = await fetch(
              `${API_BASE}/wizard/lobby/${roomId}`,
              {
                method: "DELETE",
                headers: {
                  Authorization: `Bearer ${token}`,
                },
              },
            );

            const data = (await response.json()) as {
              error?: string;
            };

            if (!response.ok) {
              throw new Error(
                data.error ?? "Could not delete room",
              );
            }

            await loadRooms();
          } catch (error) {
            console.error("Could not delete room:", error);

            alert(
              error instanceof Error
                ? error.message
                : "Could not delete room",
            );

            button.disabled = false;
          }
        });
      });
  }

  /*
   * CREATE ROOM
   */
  createRoomForm?.addEventListener(
    "submit",
    async (event) => {
      event.preventDefault();

      const formData = new FormData(createRoomForm);

      const name = String(
        formData.get("roomName") ?? "",
      );

      const maxPlayers = Number(
        formData.get("maxPlayers"),
      );

      const response = await fetch(
        `${API_BASE}/wizard/lobby/create`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            name,
            maxPlayers,
          }),
        },
      );

      if (response.ok) {
        createRoomForm.reset();
        await loadRooms();
      }
    },
  );

  
  void loadRooms();
}