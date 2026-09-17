import db from "../../../db/database.js";
import type { WizardGameState } from "../models/wizardGame.js";

interface GameRow {
  room_id: number;
  status: WizardGameState["status"];
  state_json: string;
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
      SELECT room_id, status, state_json
      FROM games
      WHERE room_id = ?
    `).get(roomId) as GameRow | undefined;

    if (!row) {
      return null;
    }

    return JSON.parse(row.state_json) as WizardGameState;
  }
}

export const wizardGameRepository = new WizardGameRepository();