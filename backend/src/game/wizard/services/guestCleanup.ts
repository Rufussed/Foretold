import db, { transaction } from "../../../db/database.js";
import { wizardLobbyManager } from "./wizardLobbyManager.js";

// A guest exists for one game: at their own private table (the lobby never
// lists it), or invited to someone's guest room (routes /invites). They go
// the moment they leave (see deleteGuest, called by the page), a short while
// after their connection drops for good (see guestTableEmptied), or when the
// game ends (wizardGameCompletionService).
// The sweep below is the backstop for anything those miss: once a table has
// gone quiet - the game stops on their turn when they leave, and a waiting
// table never starts - nothing about them is worth keeping.
const GUEST_IDLE_MINUTES = Number(process.env.GUEST_IDLE_MINUTES ?? 30);

function idleCutoff(): string {
  return `-${GUEST_IDLE_MINUTES} minutes`;
}

// The guest account and what hangs off it. Only ever touches guest rows.
export function deleteGuestUser(userId: number): void {
  transaction(() => {
    db.prepare("DELETE FROM room_players WHERE user_id = ?").run(userId);
    db.prepare("DELETE FROM player_opponents WHERE player_id = ?").run(userId);
    db.prepare("DELETE FROM player_stats WHERE user_id = ?").run(userId);
    db.prepare("DELETE FROM users WHERE id = ? AND is_guest = 1").run(userId);
  });
}

// Guest tables with no move saved (or, before the deal, no start) for
// GUEST_IDLE_MINUTES go, with their game and their guest.
function deleteIdleGuestTables(): void {
  const idleTables = db
    .prepare(`
      SELECT rooms.id AS roomId, rooms.created_by AS guestId
      FROM rooms
        JOIN users ON users.id = rooms.created_by
        LEFT JOIN games ON games.room_id = rooms.id
      WHERE users.is_guest = 1
        AND COALESCE(games.updated_at, rooms.created_at) <= datetime('now', ?)
    `)
    .all(idleCutoff()) as { roomId: number; guestId: number }[];

  for (const table of idleTables) {
    wizardLobbyManager.deleteRoom(table.roomId);
    deleteGuestUser(table.guestId);
  }
}

// Guests whose table went some other way and left them behind. A guest
// invited to someone's guest room has no table of their own but a seat there,
// and keeps it as long as the room lasts.
function deleteGuestsWithoutTables(): void {
  const strays = db
    .prepare(`
      SELECT id
      FROM users
      WHERE is_guest = 1
        AND created_at <= datetime('now', ?)
        AND NOT EXISTS (SELECT 1 FROM rooms WHERE rooms.created_by = users.id)
        AND NOT EXISTS (
          SELECT 1 FROM room_players WHERE room_players.user_id = users.id
        )
    `)
    .all(idleCutoff()) as { id: number }[];

  for (const stray of strays) {
    deleteGuestUser(stray.id);
  }
}

export function cleanUpGuests(): void {
  deleteIdleGuestTables();
  deleteGuestsWithoutTables();
}

// A guest and every table they made. False when the account is not a guest,
// so a signed-up player can never be removed this way.
export function deleteGuest(userId: number): boolean {
  const guest = db
    .prepare("SELECT id FROM users WHERE id = ? AND is_guest = 1")
    .get(userId);

  if (!guest) {
    return false;
  }

  const tables = db
    .prepare("SELECT id FROM rooms WHERE created_by = ?")
    .all(userId) as { id: number }[];

  for (const table of tables) {
    wizardLobbyManager.deleteRoom(table.id);
  }

  deleteGuestUser(userId);
  return true;
}

function guestAtTable(roomId: number): number | null {
  const row = db
    .prepare(`
      SELECT rooms.created_by AS guestId
      FROM rooms
        JOIN users ON users.id = rooms.created_by
      WHERE rooms.id = ? AND users.is_guest = 1
    `)
    .get(roomId) as { guestId: number } | undefined;

  return row?.guestId ?? null;
}

// When a guest's last connection to their game drops, they get a short while
// to come back: a reload, a locked phone or a moment out of signal all drop
// it too. Only if they stay away does the table go.
const GUEST_DISCONNECT_MS =
  Number(process.env.GUEST_DISCONNECT_SECONDS ?? 120) * 1000;

const departures = new Map<number, ReturnType<typeof setTimeout>>();

export function guestTableEmptied(roomId: number): void {
  if (guestAtTable(roomId) === null) {
    return;
  }

  guestTableJoined(roomId);

  const timer = setTimeout(() => {
    departures.delete(roomId);

    try {
      const guestId = guestAtTable(roomId);
      if (guestId !== null) deleteGuest(guestId);
    } catch (error) {
      console.error(`[guests] could not remove the table ${roomId}:`, error);
    }
  }, GUEST_DISCONNECT_MS);

  // A pending removal never keeps the process alive on its own.
  timer.unref?.();
  departures.set(roomId, timer);
}

export function guestTableJoined(roomId: number): void {
  const timer = departures.get(roomId);

  if (timer) {
    clearTimeout(timer);
    departures.delete(roomId);
  }
}
