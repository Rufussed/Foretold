import db from "../../../db/database.js";
import type { Room } from "../models/wizardGame.js";

interface RoomRow {
  id: number;
  name: string;
  created_by: number;
  max_players: number;
  status: string;
}

interface PlayerRow {
  room_id: number;
  username: string;
}

class WizardLobbyManager {
  private getRoomPlayers(roomId: number): string[] {
    const rows = db
      .prepare(
        `
          SELECT username
          FROM room_players
          WHERE room_id = ?
          ORDER BY joined_at ASC
        `,
      )
      .all(roomId) as PlayerRow[];

    return rows.map((row) => row.username);
  }

  private mapRoom(row: RoomRow): Room {
    return {
      id: row.id,
      name: row.name,
      createdBy: row.created_by,
      maxPlayers: row.max_players,
      players: this.getRoomPlayers(row.id),
      status: row.status as "waiting" | "playing",
    };
  }

  getRooms(): Room[] {
    const rows = db
      .prepare(
        `
          SELECT id, name, created_by, max_players, status
          FROM rooms
          ORDER BY created_at DESC
        `,
      )
      .all() as RoomRow[];

    return rows.map((row) => this.mapRoom(row));
  }

  getRoomById(roomId: number): Room | null {
    const row = db
      .prepare(
        `
          SELECT id, name, created_by, max_players, status
          FROM rooms
          WHERE id = ?
        `,
      )
      .get(roomId) as RoomRow | undefined;

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

  joinRoom(roomId: number, username: string): Room | null {
    const room = this.getRoomById(roomId);

    if (!room) {
      return null;
    }

    if (room.players.includes(username)) {
      return room;
    }

    if (room.players.length >= room.maxPlayers) {
      return null;
    }

    const userRow = db
      .prepare(
        `
          SELECT id
          FROM users
          WHERE username = ?
        `,
      )
      .get(username) as { id: number } | undefined;

    if (!userRow) {
      return null;
    }

    db.prepare(
      `
        INSERT OR IGNORE INTO room_players (room_id, user_id, username)
        VALUES (?, ?, ?)
      `,
    ).run(roomId, userRow.id, username);

    return this.getRoomById(roomId);
  }

  deleteRoom(
    roomId: number,
    userId: number,
  ): boolean {
    const room = db
      .prepare(`
        SELECT id, created_by, status
        FROM rooms
        WHERE id = ?
      `)
      .get(roomId) as {
        id: number;
        created_by: number;
        status: string;
      } | undefined;
  
    if (!room) {
      return false;
    }
  
    if (room.created_by !== userId) {
      return false;
    }
  
    // if (room.status !== "waiting") {
    //   return false;
    // }
  
    const deleteRoom = db.transaction(() => {
      db.prepare(`
        DELETE FROM room_players
        WHERE room_id = ?
      `).run(roomId);
  
      db.prepare(`
        DELETE FROM rooms
        WHERE id = ?
      `).run(roomId);
    });
  
    deleteRoom();
  
    return true;
  }

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

    const deleteRoom = db.transaction(() => {
      db.prepare(`
        DELETE FROM room_players
        WHERE room_id = ?
      `).run(roomId);

      db.prepare(`
        DELETE FROM rooms
        WHERE id = ?
      `).run(roomId);
    });

    deleteRoom();
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
