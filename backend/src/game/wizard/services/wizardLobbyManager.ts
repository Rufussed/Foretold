import db, { transaction } from "../../../db/database.js";
import { isAvatarId, type AvatarId } from "../models/avatar.js";
import type { Room, RoomPlayer } from "../models/wizardGame.js";

interface RoomRow {
  id: number;
  name: string;
  created_by: number;
  max_players: number;
  status: string;
}

interface PlayerRow {
  username: string;
  avatar: string | null;
}

type JoinRoomResult =
  | { success: true; room: Room; alreadyMember: boolean }
  | { success: false; reason: "not-found" | "playing" | "full" | "user-not-found" };


class WizardLobbyManager {
  private getRoomPlayers(roomId: number): RoomPlayer[] {
    const rows = db
      .prepare(
        `
          SELECT username, avatar
          FROM room_players
          WHERE room_id = ?
          ORDER BY joined_at ASC
        `,
      )
      .all(roomId) as PlayerRow[];

    return rows.map((row) => ({
      username: row.username,
      avatar: isAvatarId(row.avatar) ? row.avatar : null,
    }));
  }

  private mapRoom(row: {
    id: number;
    name: string;
    created_by: number;
    created_by_username: string;
    max_players: number;
    status: string;
  }): Room {
    return {
      id: row.id,
      name: row.name,
      createdBy: row.created_by,
      createdByUsername: row.created_by_username,
      maxPlayers: row.max_players,
      players: this.getRoomPlayers(row.id),
      status: row.status as "waiting" | "playing",
    };
  }

  getRooms(): Room[] {
    const rows = db
      .prepare(
        `
          SELECT
            rooms.id,
            rooms.name,
            rooms.created_by,
            users.username AS created_by_username,
            rooms.max_players,
            rooms.status
          FROM rooms
          JOIN users
            ON users.id = rooms.created_by
          ORDER BY rooms.created_at DESC
        `,
      )
      .all() as {
        id: number;
        name: string;
        created_by: number;
        created_by_username: string;
        max_players: number;
        status: string;
      }[];

    return rows.map((row) => this.mapRoom(row));
  }

  getRoomById(roomId: number): Room | null {
    const row = db
      .prepare(
        `
          SELECT
            rooms.id,
            rooms.name,
            rooms.created_by,
            users.username AS created_by_username,
            rooms.max_players,
            rooms.status
          FROM rooms
          JOIN users
            ON users.id = rooms.created_by
          WHERE rooms.id = ?
        `,
      )
      .get(roomId) as {
        id: number;
        name: string;
        created_by: number;
        created_by_username: string;
        max_players: number;
        status: string;
      } | undefined;

    if (!row) {
      return null;
    }

    return this.mapRoom(row);
  }

  createRoom(
    name: string,
    createdBy: number,
    username: string,
    maxPlayers: number = 4,
  ): Room {
     // Validate: ensure 3-6 range
    const validMax = Math.max(3, Math.min(6, maxPlayers));

    const result = db
      .prepare(
        `
          INSERT INTO rooms (name, created_by, max_players, status)
          VALUES (?, ?, ?, 'waiting')
        `,
      )
      .run(name, createdBy, validMax);

    const roomId = Number(result.lastInsertRowid);

    db.prepare(
      `
        INSERT INTO room_players (room_id, user_id, username)
        VALUES (?, ?, ?)
      `,
    ).run(roomId, createdBy, username);

    return this.getRoomById(roomId) as Room;
  }

  joinRoom(roomId: number, username: string): JoinRoomResult {
    const join = transaction((): JoinRoomResult => {
      const room = this.getRoomById(roomId);

      if (!room) {
        return { success: false, reason: "not-found" };
      }

      if (room.players.some((player) => player.username === username)) {
        return {
          success: true,
          room,
          alreadyMember: true,
        };
      }

      if (room.status !== "waiting") {
        return { success: false, reason: "playing" };
      }

      if (room.players.length >= room.maxPlayers) {
        return { success: false, reason: "full" };
      }

      const userRow = db
        .prepare(`
          SELECT id
          FROM users
          WHERE username = ?
        `)
        .get(username) as { id: number } | undefined;

      if (!userRow) {
        return { success: false, reason: "user-not-found" };
      }

      db.prepare(`
        INSERT INTO room_players (room_id, user_id, username)
        VALUES (?, ?, ?)
      `).run(roomId, userRow.id, username);

      return {
        success: true,
        room: this.getRoomById(roomId) as Room,
        alreadyMember: false,
      };
    });

    return join;
  }

  // DEVELOPMENT ONLY - REMOVE/RESTRICT BEFORE PRODUCTION
  deleteRoom(roomId: number): boolean {
    const room = db
      .prepare(`
        SELECT id
        FROM rooms
        WHERE id = ?
      `)
      .get(roomId) as { id: number } | undefined;

    if (!room) {
      return false;
    }

  /*
   * DEVELOPMENT ONLY:
   * Any authenticated user can currently delete any room.
   *
   * This is intentional while the game is being developed/tested,
   * so abandoned or active rooms can be removed easily.
   *
   * BEFORE PRODUCTION:
   * Restore authorization so that only the room creator
   * (or another explicitly authorized role) can delete the room.
   *
   * See also the DELETE /lobby/:roomId route in wizardRoutes.ts.
   */
  transaction(() => {
    db.prepare(`
      DELETE FROM games
      WHERE room_id = ?
    `).run(roomId);

    db.prepare(`
      DELETE FROM room_players
      WHERE room_id = ?
    `).run(roomId);

    db.prepare(`
      DELETE FROM rooms
      WHERE id = ?
    `).run(roomId);
  });

  return true;
}

  //most likely useless, but the idea is to restart games from where they left off
  resetStalePlayingRooms(activeRoomIds: Set<number>): void {
    const rooms = db.prepare(`
      SELECT id
      FROM rooms
      WHERE status = 'playing'
    `).all() as { id: number }[];

    const resetRoom = db.prepare(`
      UPDATE rooms
      SET status = 'waiting'
      WHERE id = ?
    `);

    for (const room of rooms) {
      if (!activeRoomIds.has(room.id)) {
        resetRoom.run(room.id);
      }
    }
  }

  resetPlayingRooms(): void {
    db.prepare(`
      UPDATE rooms
      SET status = 'waiting'
      WHERE status = 'playing'
        AND id NOT IN (
          SELECT room_id
          FROM games
          WHERE status != 'finished'
        )
    `).run();
  }

  deleteFinishedRoom(roomId: number): boolean {
    const room = db.prepare(`
      SELECT id, status
      FROM rooms
      WHERE id = ?
    `).get(roomId) as {
      id: number;
      status: string;
    } | undefined;

    if (!room) return false;
    if (room.status !== "playing") return false;

    transaction(() => {
      db.prepare(`
        DELETE FROM room_players
        WHERE room_id = ?
      `).run(roomId);

      db.prepare(`
        DELETE FROM rooms
        WHERE id = ?
      `).run(roomId);
    });

    return true;
  }

  // Returns false when someone else in the room already holds the avatar. The
  // unique index on (room_id, avatar) enforces this, so simultaneous claims
  // cannot both succeed. Passing null releases the player's current avatar.
  claimAvatar(
    roomId: number,
    username: string,
    avatar: AvatarId | null,
  ): boolean {
    try {
      db.prepare(`
        UPDATE room_players
        SET avatar = ?
        WHERE room_id = ? AND username = ?
      `).run(avatar, roomId, username);
    } catch (error) {
      if ((error as { code?: string }).code === "SQLITE_CONSTRAINT_UNIQUE") {
        return false;
      }

      throw error;
    }

    return true;
  }

  setRoomStatus(
    roomId: number,
    status: "waiting" | "playing",
  ): void {
    db.prepare(`
      UPDATE rooms
      SET status = ?
      WHERE id = ?
    `).run(status, roomId);
  }
}

export const wizardLobbyManager = new WizardLobbyManager();
