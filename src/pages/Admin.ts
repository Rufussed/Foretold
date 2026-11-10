import { renderNavbar } from "../components/Navbar";
import { getCurrentUser } from "../services/auth";
import type { User } from "../types/auth";
import {
  deleteAdminRoom,
  deleteAdminUser,
  listAdminRooms,
  listAdminUsers,
  setAdminRolesOpen,
  confirmAdminEmail,
  confirmAllAdminEmails,
  setAdminEmail,
  listServerEvents,
  setLogPlays,
  type AdminRoom,
  type AdminUser,
  type ServerEvent,
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
        <h2>Server log</h2>
        <p class="admin-note">
          What happened on the server, newest first: sign-ins, rooms, games
          started, each round, how each game ended and what it saved (or why
          not), and every error with its room. Kept for two weeks. Click a
          room number to see only that room.
        </p>
        <form class="admin-log-filter" id="admin-log-filter">
          <input name="room" inputmode="numeric" placeholder="Room #" size="7" />
          <input name="user" placeholder="Player" size="14" />
          <select name="kind">
            <option value="">Every event</option>
            ${EVENT_KINDS.map((kind) => `<option value="${kind}">${kind}</option>`).join("")}
          </select>
          <button type="submit">Show</button>
          <button type="button" id="admin-log-clear">Clear</button>
          <button type="button" id="admin-log-plays" class="admin-log-plays"></button>
        </form>
        <div id="admin-log" class="admin-table-wrap">Loading…</div>
      </section>

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
        <p class="admin-note">
          Roles: new accounts start with the first four basic roles and open
          the rest with their seals. "Open all" gives an account every role.
        </p>
        <p class="admin-note">
          Email: an account must confirm its email before it can sign in.
          "Confirm" does it for them, for an address that is wrong or never
          gets the mail; "Edit" gives them a new address, confirmed at once.
          <button type="button" class="admin-confirm-all" id="admin-confirm-all">Confirm all waiting</button>
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

  // An event's own fields, beyond when, what, the room and the players.
  function eventDetails(event: ServerEvent): string {
    const { at: _at, kind: _kind, room: _room, users: _users, ...fields } = event;
    return Object.entries(fields)
      .map(([key, value]) => `${key}: ${typeof value === "string" ? value : JSON.stringify(value)}`)
      .join("\n");
  }

  function renderEvents(events: ServerEvent[]): string {
    if (events.length === 0) return `<p class="admin-empty">No events.</p>`;

    return `
      <table class="admin-table admin-log-table">
        <thead>
          <tr><th>When</th><th>Event</th><th>Room</th><th>Players</th><th>Details</th></tr>
        </thead>
        <tbody>
          ${events
            .map(
              (event) => `
                <tr class="${event.kind === "error" ? "admin-log-error" : ""}">
                  <td>${formatDateTime(event.at)}</td>
                  <td>${escapeHtml(event.kind)}</td>
                  <td>${
                    event.room === undefined
                      ? ""
                      : `<button type="button" class="admin-log-room" data-room="${event.room}">#${event.room}</button>`
                  }</td>
                  <td>${escapeHtml((event.users ?? []).join(", "))}</td>
                  <td><pre>${escapeHtml(eventDetails(event))}</pre></td>
                </tr>
              `,
            )
            .join("")}
        </tbody>
      </table>
    `;
  }

  const logBox = container.querySelector<HTMLDivElement>("#admin-log");
  const logFilter = container.querySelector<HTMLFormElement>("#admin-log-filter");
  const playsButton = container.querySelector<HTMLButtonElement>("#admin-log-plays");

  function showPlays(on: boolean): void {
    if (!playsButton) return;
    playsButton.dataset.on = String(on);
    playsButton.textContent = on ? "Every card: logged · Stop" : "Every card: not logged · Start";
  }

  async function loadLog(): Promise<void> {
    if (!logBox || !logFilter) return;
    const data = new FormData(logFilter);
    try {
      const result = await listServerEvents({
        room: String(data.get("room") ?? "").replace("#", "").trim(),
        user: String(data.get("user") ?? "").trim(),
        kind: String(data.get("kind") ?? ""),
        limit: 300,
      });
      logBox.innerHTML = renderEvents(result.events);
      showPlays(result.logsPlays);
    } catch (error) {
      logBox.textContent = error instanceof Error ? error.message : "Could not load the log";
    }
  }

  logFilter?.addEventListener("submit", (event) => {
    event.preventDefault();
    void loadLog();
  });

  container.querySelector("#admin-log-clear")?.addEventListener("click", () => {
    logFilter?.reset();
    void loadLog();
  });

  // A room number in the log: that room's events only.
  logBox?.addEventListener("click", (event) => {
    const button = (event.target as HTMLElement).closest<HTMLButtonElement>(".admin-log-room");
    const input = logFilter?.querySelector<HTMLInputElement>("input[name=room]");
    if (!button || !input) return;
    input.value = button.dataset.room ?? "";
    void loadLog();
  });

  playsButton?.addEventListener("click", async () => {
    playsButton.disabled = true;
    try {
      showPlays(await setLogPlays(playsButton.dataset.on !== "true"));
    } catch (error) {
      showMessage(error instanceof Error ? error.message : "Could not change the card log");
    }
    playsButton.disabled = false;
  });

  function renderUsers(users: AdminUser[]): string {
    if (users.length === 0) return `<p class="admin-empty">No users.</p>`;

    return `
      <table class="admin-table">
        <thead>
          <tr>
            <th>Wizard name</th><th>Email</th>
            <th>Joined</th><th>Rooms</th><th>Roles</th><th></th>
          </tr>
        </thead>
        <tbody>
          ${users
            .map(
              (user) => `
                <tr>
                  <td>${escapeHtml(user.username)}${user.isGuest ? " <small>guest</small>" : ""}</td>
                  <td>
                    ${escapeHtml(user.email)}
                    ${
                      user.emailVerified
                        ? ""
                        : `<button type="button" class="admin-confirm" data-user-id="${user.id}">Confirm</button>`
                    }
                    ${
                      user.isGuest
                        ? ""
                        : `<button type="button" class="admin-email" data-user-id="${user.id}"
                            data-email="${escapeHtml(user.email)}" data-label="${escapeHtml(user.username)}">Edit</button>`
                    }
                  </td>
                  <td>${formatDateTime(user.createdAt)}</td>
                  <td>${user.roomsCreated}</td>
                  <td>
                    <button type="button" class="admin-roles"
                      data-user-id="${user.id}" data-open="${!user.rolesOpen}">
                      ${user.rolesOpen ? "All open · Lock" : "Locked · Open all"}
                    </button>
                  </td>
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

  // A new email for an account, confirmed at once.
  container.addEventListener("click", async (event) => {
    const button = (event.target as HTMLElement).closest<HTMLButtonElement>(".admin-email");
    if (!button) return;
    const email = window.prompt(`New email for ${button.dataset.label ?? ""}:`, button.dataset.email ?? "");
    if (email === null || email.trim() === "" || email.trim() === button.dataset.email) return;
    button.disabled = true;
    try {
      await setAdminEmail(Number(button.dataset.userId), email.trim());
      showMessage(`Email of ${button.dataset.label ?? ""} set to ${email.trim()}, confirmed.`);
      await load();
    } catch (error) {
      showMessage(error instanceof Error ? error.message : "Could not change the email");
      button.disabled = false;
    }
  });

  // Confirms an account's email by hand, or every one still waiting.
  container.addEventListener("click", async (event) => {
    const button = (event.target as HTMLElement).closest<HTMLButtonElement>(".admin-confirm, .admin-confirm-all");
    if (!button) return;
    button.disabled = true;
    try {
      if (button.classList.contains("admin-confirm-all")) {
        const confirmed = await confirmAllAdminEmails();
        showMessage(`Confirmed ${confirmed} account${confirmed === 1 ? "" : "s"}.`);
      } else {
        await confirmAdminEmail(Number(button.dataset.userId));
      }
      await load();
    } catch (error) {
      showMessage(error instanceof Error ? error.message : "Could not confirm");
    }
    button.disabled = false;
  });

  // Roles mode: every role open for an account, or the locks back on.
  container.addEventListener("click", async (event) => {
    const button = (event.target as HTMLElement).closest<HTMLButtonElement>(".admin-roles");
    if (!button) return;
    button.disabled = true;
    try {
      await setAdminRolesOpen(Number(button.dataset.userId), button.dataset.open === "true");
      await load();
    } catch (error) {
      showMessage(error instanceof Error ? error.message : "Could not change the roles");
      button.disabled = false;
    }
  });

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

  await Promise.all([load(), loadLog()]);
}

// The kinds of event in the server log (backend logging/eventLog.ts).
const EVENT_KINDS = [
  "error",
  "game-ended",
  "game-expired",
  "game-started",
  "round-ended",
  "trick-won",
  "card-played",
  "player-quit",
  "room-created",
  "login",
  "login-failed",
  "signup",
  "server-started",
];
