import db from "../../../db/database.js";
import type { WizardGameState } from "../models/wizardGame.js";


const GAME_EXPIRATION_HOURS =
  Number(process.env.GAME_EXPIRATION_HOURS ?? 24);

export const GAME_EXPIRATION_MS =
  GAME_EXPIRATION_HOURS * 60 * 60 * 1000;

interface GameRow {
  room_id: number;
  status: WizardGameState["status"];
  state_json: string;
  created_at: string;
}

class WizardGameRepository {
  saveGame(game: WizardGameState): void {
    db.prepare(`
      INSERT INTO games (
        room_id,
        status,
        state_json
      )
      VALUES (?, ?, ?)
      ON CONFLICT(room_id) DO UPDATE SET
        status = excluded.status,
        state_json = excluded.state_json,
        updated_at = CURRENT_TIMESTAMP
    `).run(
      game.roomId,
      game.status,
      JSON.stringify(game),
    );
  }

  loadGame(roomId: number): WizardGameState | null {
    const row = db.prepare(`
      SELECT room_id, status, state_json, created_at
      FROM games
      WHERE room_id = ?
    `).get(roomId) as GameRow | undefined;

    if (!row) {
      return null;
    }


    return JSON.parse(row.state_json) as WizardGameState;
  }

  isGameExpired(roomId: number): boolean {
    const row = db
      .prepare(`
        SELECT created_at
        FROM games
        WHERE room_id = ?
      `)
      .get(roomId) as { created_at: string } | undefined;

    if (!row) {
      return false;
    }

    const createdAt = new Date(row.created_at).getTime();
    const now = Date.now();

    return now - createdAt >= GAME_EXPIRATION_MS;
  }

  getExpiredGameIds(): number[] {
    const rows = db
      .prepare(`
        SELECT room_id
        FROM games
        WHERE created_at <= datetime('now', ?)
      `)
      .all(`-${GAME_EXPIRATION_MS / 1000} seconds`) as {
        room_id: number;
      }[];

    return rows.map((row) => row.room_id);
  }

  deleteGame(roomId: number): void {
    db.prepare(`
      DELETE FROM games
      WHERE room_id = ?
    `).run(roomId);
  }
}

export const wizardGameRepository = new WizardGameRepository();