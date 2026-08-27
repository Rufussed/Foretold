import db from "../../../db/database.js";
import type { Room } from "../models/wizardGame.js";

interface RoomRow {
  id: number;
  name: string;
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
      maxPlayers: row.max_players,
      players: this.getRoomPlayers(row.id),
      status: row.status as "waiting" | "playing",
    };
  }

  getRooms(): Room[] {
    const rows = db
      .prepare(
        `
          SELECT id, name, max_players, status
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
          SELECT id, name, max_players, status
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
  ): Room {
    const result = db
      .prepare(
        `
          INSERT INTO rooms (name, created_by, max_players, status)
          VALUES (?, ?, 4, 'waiting')
        `,
      )
      .run(name, createdBy);

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
}

export const wizardLobbyManager = new WizardLobbyManager();