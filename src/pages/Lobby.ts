const API_BASE = "http://127.0.0.1:3000";
import { getCurrentUser } from "../services/auth";

export function renderLobbyPage(container: HTMLElement): void {
  const token = localStorage.getItem("wizardToken");

  if (!token) {
    window.location.hash = "#/home";
    return;
  }

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

    if (!roomList) return;

    if (!data.rooms || data.rooms.length === 0) {
      roomList.innerHTML = "<p>No rooms available.</p>";
      return;
    }

    roomList.innerHTML = data.rooms
      .map(
        (room: { id: string; name: string; players: string[]; maxPlayers: number }) =>
          `
            <div class="panel">
              <h3>${room.name}</h3>
              <p>${room.players.length}/${room.maxPlayers} players</p>
              <button type="button" data-room-id="${room.id}">Join</button>
            </div>
          `,
      )
      .join("");

    roomList.querySelectorAll<HTMLButtonElement>("[data-room-id]").forEach((button) => {
      button.addEventListener("click", async () => {
        const roomId = button.dataset.roomId;

        if (!roomId) return;

        try {
          const user = await getCurrentUser();

          const response = await fetch(`${API_BASE}/wizard/lobby/join`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({
              roomId,
            }),
          });

          if (response.ok) {
            await loadRooms();
          }
        } catch (error) {
          console.error("Could not join room:", error);
          window.location.hash = "#/home";
        }
      });
    });
  }

  createRoomForm?.addEventListener("submit", async (event) => {
    event.preventDefault();

    const formData = new FormData(createRoomForm);
    const name = String(formData.get("roomName") ?? "");

    const response = await fetch(`${API_BASE}/wizard/lobby/create`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ name }),
    });

    if (response.ok) {
      createRoomForm.reset();
      await loadRooms();
    }
  });

  void loadRooms();
}