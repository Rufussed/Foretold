import { randomBytes } from "node:crypto";
import db, { transaction } from "../../../db/database.js";
import { isAvatarId, type AvatarId } from "../models/avatar.js";
import type { Room, RoomPlayer } from "../models/wizardGame.js";
import { DEFAULT_GAME_OPTIONS, normalizeGameOptions, type WizardGameOptions } from "../gameOptions.js";
import { GAME_EXPIRATION_MS } from "./wizardGameRepository.js";
import { wizardSessionManager } from "./wizardSessionManager.js";
import {
  isTurnTimeoutMs,
  type TurnTimeoutMs,
} from "../turnTimeout.js";


interface RoomRow {
  id: number;
  name: string;
  created_by: number;
  max_players: number;
  status: string;
  is_public: number;
  options_json: string | null;
  turn_timeout_ms: number | null;
}

interface PlayerRow {
  username: string;
  avatar: string | null;
}

type JoinRoomResult =
  | { success: true; room: Room; alreadyMember: boolean }
  | { success: false; reason: "not-found" | "playing" | "full" | "user-not-found" };


// Ten URL-safe characters: short enough to type from a screen, far too many to
// guess (64^10).
function newInviteCode(): string {
  return randomBytes(8).toString("base64url").slice(0, 10);
}

class WizardLobbyManager {
  private parseOptions(json: string | null): WizardGameOptions {
    try {
      return normalizeGameOptions(json ? JSON.parse(json) : null, DEFAULT_GAME_OPTIONS);
    } catch {
      return normalizeGameOptions(null, DEFAULT_GAME_OPTIONS);
    }
  }

  // The host's rule variations, saved as they choose so the others can see
  // them. Only while the room waits for its game.
  setRoomOptions(roomId: number, options: WizardGameOptions): void {
    db.prepare(`
      UPDATE rooms
      SET options_json = ?
      WHERE id = ? AND status = 'waiting'
    `).run(JSON.stringify(normalizeGameOptions(options)), roomId);
  }

  // The host's turn timeout, chosen with the rule variations; null for no
  // limit. Like the options, only while the room is still waiting.
  setRoomTurnTimeout(roomId: number, turnTimeoutMs: TurnTimeoutMs): void {
    if (!isTurnTimeoutMs(turnTimeoutMs)) {
      throw new Error("Invalid turn timeout");
    }
    db.prepare(`
      UPDATE rooms
      SET turn_timeout_ms = ?
      WHERE id = ? AND status = 'waiting'
    `).run(turnTimeoutMs, roomId);
  }

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
    created_at: string;
    created_by: number;
    created_by_username: string;
    max_players: number;
    status: string;
    is_public: number;
    options_json: string | null;
    turn_timeout_ms: number | null;
    invite_code: string | null;
  }): Room {
    return {
      id: row.id,
      name: row.name,
      createdAt: row.created_at,
      createdBy: row.created_by,
      createdByUsername: row.created_by_username,
      maxPlayers: row.max_players,
      players: this.getRoomPlayers(row.id),
      status: row.status as "waiting" | "playing",
      isPublic: row.is_public === 1,
      options: this.parseOptions(row.options_json),
      turnTimeoutMs: row.turn_timeout_ms as TurnTimeoutMs,
      inviteCode: row.invite_code,
    };
  }

  getRooms(): Room[] {
    const rows = db
      .prepare(
        `
          SELECT
            rooms.id,
            rooms.name,
            rooms.created_at,
            rooms.created_by,
            users.username AS created_by_username,
            rooms.max_players,
            rooms.status,
            rooms.is_public,
            rooms.options_json,
            rooms.turn_timeout_ms,
            rooms.invite_code
          FROM rooms
          JOIN users
            ON users.id = rooms.created_by
          WHERE users.is_guest = 0
          ORDER BY rooms.created_at DESC
        `,
      )
      .all() as {
        id: number;
        name: string;
        created_at: string;
        created_by: number;
        created_by_username: string;
        max_players: number;
        status: string;
        is_public: number;
        options_json: string | null;
        turn_timeout_ms: number | null;
        invite_code: string | null;
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
            rooms.created_at,
            rooms.created_by,
            users.username AS created_by_username,
            rooms.max_players,
            rooms.status,
            rooms.is_public,
            rooms.options_json,
            rooms.turn_timeout_ms,
            rooms.invite_code
          FROM rooms
          JOIN users
            ON users.id = rooms.created_by
          WHERE rooms.id = ?
        `,
      )
      .get(roomId) as {
        id: number;
        name: string;
        created_at: string;
        created_by: number;
        created_by_username: string;
        max_players: number;
        status: string;
        is_public: number;
        options_json: string | null;
        turn_timeout_ms: number | null;
        invite_code: string | null;
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
    isPublic: boolean = true,
    turnTimeoutMs: TurnTimeoutMs = 30_000,
    isGuestRoom: boolean = false,
    options: WizardGameOptions = DEFAULT_GAME_OPTIONS,
  ): Room {
    if (!isTurnTimeoutMs(turnTimeoutMs)) {
      throw new Error("Invalid turn timeout");
    }
     // Validate: ensure 3-6 range
    const validMax = Math.max(3, Math.min(6, maxPlayers));

    const result = db
      .prepare(`
        INSERT INTO rooms (
          name,
          created_by,
          max_players,
          status,
          is_public,
          turn_timeout_ms,
          invite_code,
          options_json
        )
        VALUES (?, ?, ?, 'waiting', ?, ?, ?, ?)
      `)
      .run(
        name,
        createdBy,
        validMax,
        // A guest room is never listed: only its invite link leads in.
        isPublic && !isGuestRoom ? 1 : 0,
        turnTimeoutMs,
        isGuestRoom ? newInviteCode() : null,
        JSON.stringify(normalizeGameOptions(options)),
      );

    const roomId = Number(result.lastInsertRowid);

    db.prepare(
      `
        INSERT INTO room_players (room_id, user_id, username)
        VALUES (?, ?, ?)
      `,
    ).run(roomId, createdBy, username);

    return this.getRoomById(roomId) as Room;
  }

  // The guest room an invite link leads to, or null for a code no room has
  // (never had, or one whose room has gone or got a new link).
  getRoomIdByInviteCode(code: string): number | null {
    const row = db
      .prepare("SELECT id FROM rooms WHERE invite_code = ?")
      .get(code) as { id: number } | undefined;

    return row?.id ?? null;
  }

  // A fresh link for a guest room; the old one stops working.
  renewInviteCode(roomId: number): string {
    const code = newInviteCode();

    db.prepare(`
      UPDATE rooms
      SET invite_code = ?
      WHERE id = ? AND invite_code IS NOT NULL
    `).run(code, roomId);

    return code;
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

  leaveRoom(roomId: number, userId: number): boolean {
    const room = db
      .prepare(`
        SELECT
          id,
          created_by AS createdBy,
          status
        FROM rooms
        WHERE id = ?
      `)
      .get(roomId) as {
        id: number;
        createdBy: number;
        status: string;
      } | undefined;

    if (!room) {
      return false;
    }

    // The creator does not leave.
    // They delete the waiting room instead.
    if (room.createdBy === userId) {
      return false;
    }

    // Players can only leave before the game starts.
    if (room.status !== "waiting") {
      return false;
    }

    const result = db
      .prepare(`
        DELETE FROM room_players
        WHERE room_id = ?
          AND user_id = ?
      `)
      .run(roomId, userId);

    return result.changes > 0;
  }
  getExpiredRoomIds(): number[] {
    const rows = db
      .prepare(`
        SELECT id
        FROM rooms
        WHERE created_at <= datetime('now', ?)
      `)
      .all(`-${GAME_EXPIRATION_MS / 1000} seconds`) as {
        id: number;
      }[];

    return rows.map((row) => row.id);
  }
  
  deleteWaitingRoom(roomId: number, userId: number): boolean {
    const room = db
      .prepare(`
        SELECT
          id,
          created_by AS createdBy,
          status
        FROM rooms
        WHERE id = ?
      `)
      .get(roomId) as {
        id: number;
        createdBy: number;
        status: string;
      } | undefined;

    if (!room) {
      return false;
    }

    // Only the creator can delete a room.
    if (room.createdBy !== userId) {
      return false;
    }

    // A room can only be deleted before the game starts.
    if (room.status !== "waiting") {
      return false;
    }

    return this.deleteRoom(roomId);
  }

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

  // The rows are gone, but a game already in memory is not, and the bot runner
  // may be mid-wait on a turn. Left in place it wakes, plays a move and saves a
  // game whose room no longer exists, which foreign keys refuse - and that
  // throw reaches no caller, so it takes the server down. Dropping it here is
  // what makes the runner's own "has this game gone?" check see the truth.
  wizardSessionManager.deleteGame(roomId);

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
