import db from "../../../db/database.js";

const MAX_REMEMBERED_OPPONENTS = 100;

export interface PlayerOpponent {
  playerId: number;
  opponentType: "user" | "bot";
  opponentId: number | null;
  opponentName: string;
  gamesPlayed: number;
}

class PlayerOpponentRepository {
  recordGameAgainstUser(
    playerId: number,
    opponentId: number,
    opponentName: string,
  ): void {
    db.prepare(`
      INSERT INTO player_opponents (
        player_id,
        opponent_type,
        opponent_id,
        opponent_name,
        games_played,
        last_played_at
      )
      VALUES (?, 'user', ?, ?, 1, ?)
      ON CONFLICT (
        player_id,
        opponent_type,
        opponent_id,
        opponent_name
      )
      DO UPDATE SET
        games_played = games_played + 1,
        last_played_at = excluded.last_played_at
    `).run(playerId, opponentId, opponentName, new Date().toISOString());
    this.trimOpponents(playerId);
  }

  recordGameAgainstBot(
    playerId: number,
    opponentName: string,
  ): void {
    db.prepare(`
      INSERT INTO player_opponents (
        player_id,
        opponent_type,
        opponent_id,
        opponent_name,
        games_played,
        last_played_at
      )
      VALUES (?, 'bot', NULL, ?, 1, ?)
      ON CONFLICT (
        player_id,
        opponent_type,
        opponent_id,
        opponent_name
      )
      DO UPDATE SET
        games_played = games_played + 1,
        last_played_at = excluded.last_played_at
    `).run(playerId, opponentName, new Date().toISOString());
    this.trimOpponents(playerId);
  }

  private trimOpponents(playerId: number): void {
    db.prepare(`
      DELETE FROM player_opponents
      WHERE player_id = ?
        AND rowid NOT IN (
          SELECT rowid
          FROM player_opponents
          WHERE player_id = ?
          ORDER BY last_played_at DESC, rowid DESC
          LIMIT ?
        )
    `).run(playerId, playerId, MAX_REMEMBERED_OPPONENTS);
  }

  getOpponents(playerId: number): PlayerOpponent[] {
    const rows = db.prepare(`
      SELECT
        player_id AS playerId,
        opponent_type AS opponentType,
        opponent_id AS opponentId,
        opponent_name AS opponentName,
        games_played AS gamesPlayed
      FROM player_opponents
      WHERE player_id = ?
      ORDER BY games_played DESC
    `).all(playerId) as PlayerOpponent[];

    return rows;
  }
}

export const playerOpponentRepository =
  new PlayerOpponentRepository();