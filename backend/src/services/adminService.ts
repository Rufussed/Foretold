import db, { transaction } from "../db/database.js";
import { wizardLobbyManager } from "../game/wizard/services/wizardLobbyManager.js";
import { deleteGuestUser } from "../game/wizard/services/guestCleanup.js";

export interface AdminRoom {
  id: number;
  name: string;
  status: string;
  createdAt: string;
  creatorUsername: string;
  creatorIsGuest: boolean;
  playerCount: number;
  gameStatus: string | null;
}

export interface AdminUser {
  id: number;
  username: string;
  email: string;
  createdAt: string;
  isGuest: boolean;
  roomsCreated: number;
}

// Who may use the admin page: the usernames in ADMIN_USERNAMES (comma
// separated), spelled exactly as the account is, capitals included, so a
// "rufus" made beside "Rufus" is not an admin. Unset, nobody is an admin.
export function isAdminUsername(username: string): boolean {
  const admins = (process.env.ADMIN_USERNAMES ?? "")
    .split(",")
    .map((name) => name.trim())
    .filter(Boolean);

  return admins.includes(username);
}

export const adminService = {
  listRooms(): AdminRoom[] {
    const rows = db
      .prepare(`
        SELECT
          rooms.id,
          rooms.name,
          rooms.status,
          rooms.created_at AS createdAt,
          users.username AS creatorUsername,
          users.is_guest AS creatorIsGuest,
          (
            SELECT COUNT(*)
            FROM room_players
            WHERE room_players.room_id = rooms.id
          ) AS playerCount,
          games.status AS gameStatus
        FROM rooms
          JOIN users ON users.id = rooms.created_by
          LEFT JOIN games ON games.room_id = rooms.id
        ORDER BY rooms.created_at DESC
      `)
      .all() as (Omit<AdminRoom, "creatorIsGuest"> & {
        creatorIsGuest: number;
      })[];

    return rows.map((row) => ({
      ...row,
      creatorIsGuest: row.creatorIsGuest === 1,
    }));
  },

  listUsers(): AdminUser[] {
    const rows = db
      .prepare(`
        SELECT
          users.id,
          users.username,
          users.email,
          users.created_at AS createdAt,
          users.is_guest AS isGuest,
          (
            SELECT COUNT(*)
            FROM rooms
            WHERE rooms.created_by = users.id
          ) AS roomsCreated
        FROM users
        ORDER BY users.created_at DESC
      `)
      .all() as (Omit<AdminUser, "isGuest"> & { isGuest: number })[];

    return rows.map((row) => ({ ...row, isGuest: row.isGuest === 1 }));
  },

  // The room, its players and its game, including a game held in memory. A
  // guest's table is all a guest has, so the guest goes with it.
  deleteRoom(roomId: number): boolean {
    const creator = db
      .prepare(`
        SELECT rooms.created_by AS id, users.is_guest AS isGuest
        FROM rooms
          JOIN users ON users.id = rooms.created_by
        WHERE rooms.id = ?
      `)
      .get(roomId) as { id: number; isGuest: number } | undefined;

    if (!wizardLobbyManager.deleteRoom(roomId)) {
      return false;
    }

    if (creator?.isGuest === 1) {
      deleteGuestUser(creator.id);
    }

    return true;
  },

  // A user goes with everything that cannot stand without them: the rooms
  // they created, and any game in progress they are playing in. From other
  // waiting rooms they are only unseated. Other players keep their record of
  // having played them, which stores the name and needs no account.
  deleteUser(userId: number): boolean {
    const user = db
      .prepare("SELECT id FROM users WHERE id = ?")
      .get(userId);

    if (!user) {
      return false;
    }

    const roomIds = db
      .prepare(`
        SELECT id
        FROM rooms
        WHERE created_by = ?
        UNION
        SELECT rooms.id
        FROM rooms
          JOIN room_players ON room_players.room_id = rooms.id
        WHERE room_players.user_id = ?
          AND rooms.status = 'playing'
      `)
      .all(userId, userId) as { id: number }[];

    for (const room of roomIds) {
      wizardLobbyManager.deleteRoom(room.id);
    }

    transaction(() => {
      db.prepare("DELETE FROM room_players WHERE user_id = ?").run(userId);
      db.prepare("DELETE FROM player_opponents WHERE player_id = ?").run(userId);
      db.prepare(`
        DELETE FROM friend_requests
        WHERE sender_id = ? OR receiver_id = ?
      `).run(userId, userId);
      db.prepare("DELETE FROM player_stats WHERE user_id = ?").run(userId);
      db.prepare("DELETE FROM users WHERE id = ?").run(userId);
    });

    return true;
  },
};
