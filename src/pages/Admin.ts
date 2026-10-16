import { renderNavbar } from "../components/Navbar";
import { getCurrentUser } from "../services/auth";
import type { User } from "../types/auth";
import {
  deleteAdminRoom,
  deleteAdminUser,
  listAdminRooms,
  listAdminUsers,
  type AdminRoom,
  type AdminUser,
} from "../services/admin";
import { formatDateTime } from "../utils/format-date-time";
import { escapeHtml } from "../utils/escape-html";

// Rooms and users in the live database, each with a Delete button. Only
// accounts in the server's ADMIN_USERNAMES get the lists.
export async function renderAdminPage(container: HTMLElement): Promise<void> {
  let currentUser: User;

  try {
    currentUser = await getCurrentUser();
  } catch {
    window.location.hash = "#/home";
    return;
  }

  container.innerHTML = `
    <div id="navbar-container"></div>

    <section class="admin-content">
      <h1>Admin</h1>
      <p class="admin-message" id="admin-message"></p>

      <section class="admin-panel">
        <h2>Rooms <span id="admin-room-count"></span></h2>
        <p class="admin-note">Deleting a room also deletes its game.</p>
        <div id="admin-rooms" class="admin-table-wrap">Loading…</div>
      </section>

      <section class="admin-panel">
        <h2>Users <span id="admin-user-count"></span></h2>
        <p class="admin-note">
          Deleting a user also deletes the rooms they created and any game in
          progress they are playing in. Seeded test accounts come back when
          the server restarts.
        </p>
        <div id="admin-users" class="admin-table-wrap">Loading…</div>
      </section>
    </section>
  `;

  const navbarContainer =
    container.querySelector<HTMLDivElement>("#navbar-container");

  if (navbarContainer) {
    renderNavbar(navbarContainer, currentUser);
  }

  const message = container.querySelector<HTMLParagraphElement>("#admin-message");
  const roomsBox = container.querySelector<HTMLDivElement>("#admin-rooms");
  const usersBox = container.querySelector<HTMLDivElement>("#admin-users");
  const roomCount = container.querySelector<HTMLSpanElement>("#admin-room-count");
  const userCount = container.querySelector<HTMLSpanElement>("#admin-user-count");

  function showMessage(text: string): void {
    if (message) message.textContent = text;
  }

  function renderRooms(rooms: AdminRoom[]): string {
    if (rooms.length === 0) return `<p class="admin-empty">No rooms.</p>`;

    return `
      <table class="admin-table">
        <thead>
          <tr>
            <th>Room</th><th>Created</th><th>Creator</th>
            <th>Players</th><th>Status</th><th></th>
          </tr>
        </thead>
        <tbody>
          ${rooms
            .map(
              (room) => `
                <tr>
                  <td>${escapeHtml(room.name)} <small>#${room.id}</small></td>
                  <td>${formatDateTime(room.createdAt)}</td>
                  <td>${escapeHtml(room.creatorUsername)}${room.creatorIsGuest ? " <small>guest</small>" : ""}</td>
                  <td>${room.playerCount}</td>
                  <td>${escapeHtml(room.gameStatus ?? room.status)}</td>
                  <td>
                    <button type="button" class="admin-delete"
                      data-room-id="${room.id}" data-label="${escapeHtml(room.name)}">
                      Delete
                    </button>
                  </td>
                </tr>
              `,
            )
            .join("")}
        </tbody>
      </table>
    `;
  }

  function renderUsers(users: AdminUser[]): string {
    if (users.length === 0) return `<p class="admin-empty">No users.</p>`;

    return `
      <table class="admin-table">
        <thead>
          <tr>
            <th>Username</th><th>Name</th><th>Email</th>
            <th>Joined</th><th>Rooms</th><th></th>
          </tr>
        </thead>
        <tbody>
          ${users
            .map(
              (user) => `
                <tr>
                  <td>${escapeHtml(user.username)}${user.isGuest ? " <small>guest</small>" : ""}</td>
                  <td>${escapeHtml(user.displayName)}</td>
                  <td>${escapeHtml(user.email)}</td>
                  <td>${formatDateTime(user.createdAt)}</td>
                  <td>${user.roomsCreated}</td>
                  <td>
                    ${
                      user.id === currentUser.id
                        ? "<small>you</small>"
                        : `<button type="button" class="admin-delete"
                            data-user-id="${user.id}" data-label="${escapeHtml(user.username)}">
                            Delete
                          </button>`
                    }
                  </td>
                </tr>
              `,
            )
            .join("")}
        </tbody>
      </table>
    `;
  }

  async function load(): Promise<void> {
    try {
      const [rooms, users] = await Promise.all([
        listAdminRooms(),
        listAdminUsers(),
      ]);

      if (roomsBox) roomsBox.innerHTML = renderRooms(rooms);
      if (usersBox) usersBox.innerHTML = renderUsers(users);
      if (roomCount) roomCount.textContent = `(${rooms.length})`;
      if (userCount) userCount.textContent = `(${users.length})`;
    } catch (error) {
      const text = error instanceof Error ? error.message : "Could not load";
      showMessage(text);
      if (roomsBox) roomsBox.innerHTML = "";
      if (usersBox) usersBox.innerHTML = "";
    }
  }

  container.addEventListener("click", async (event) => {
    const button = (event.target as HTMLElement).closest<HTMLButtonElement>(
      ".admin-delete",
    );

    if (!button) return;

    const roomId = Number(button.dataset.roomId);
    const userId = Number(button.dataset.userId);
    const label = button.dataset.label ?? "";
    const what = roomId ? `room "${label}"` : `user "${label}"`;

    if (!window.confirm(`Delete ${what}? This cannot be undone.`)) return;

    button.disabled = true;

    try {
      if (roomId) {
        await deleteAdminRoom(roomId);
      } else {
        await deleteAdminUser(userId);
      }

      showMessage(`Deleted ${what}.`);
      await load();
    } catch (error) {
      showMessage(error instanceof Error ? error.message : "Delete failed");
      button.disabled = false;
    }
  });

  await load();
}
