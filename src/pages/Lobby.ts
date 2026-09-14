import { getCurrentUser } from "../services/auth";
import { API_BASE } from "../services/api";


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
          players: { username: string; avatar: string | null }[];
          maxPlayers: number;
          status: "waiting" | "playing";
        }) => {
          const isMember = room.players.some(
            (player) => player.username === currentUser.username,
          );

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
                ${isMember ? "Open room" : "Join"}
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

          // The waiting room joins on arrival, so it doubles as a room link.
          window.location.hash = `#/room/${roomId}`;
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