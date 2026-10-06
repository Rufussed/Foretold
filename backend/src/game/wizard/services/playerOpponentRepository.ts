import db from "../../../db/database.js";

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
        games_played
      )
      VALUES (?, 'user', ?, ?, 1)
      ON CONFLICT (
        player_id,
        opponent_type,
        opponent_id,
        opponent_name
      )
      DO UPDATE SET
        games_played = games_played + 1
    `).run(
      playerId,
      opponentId,
      opponentName,
    );
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
        games_played
      )
      VALUES (?, 'bot', NULL, ?, 1)
      ON CONFLICT (
        player_id,
        opponent_type,
        opponent_id,
        opponent_name
      )
      DO UPDATE SET
        games_played = games_played + 1
    `).run(
      playerId,
      opponentName,
    );
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