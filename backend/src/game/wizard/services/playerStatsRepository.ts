import db from "../../../db/database.js";

export interface PlayerStats {
  userId: number;
  gamesPlayed: number;
  gamesFinished: number;
  gamesWon: number;
  fullGamesFinished: number;
  fullGamesWon: number;
  totalPoints: number;
  peakTotalPoints: number;
  tricksWon: number;
  predictionsMade: number;
  exactPredictions: number;
  gamesCreated: number;
  gamesCreatedFinished: number;
}

class PlayerStatsRepository {
  initializeForUser(userId: number): void {
    db.prepare(`
      INSERT OR IGNORE INTO player_stats (user_id)
      VALUES (?)
    `).run(userId);
  }

  initializeForAllUsers(): void {
    db.prepare(`
      INSERT OR IGNORE INTO player_stats (user_id)
      SELECT id
      FROM users
    `).run();
  }

  incrementGamesPlayed(userId: number): void {
    db.prepare(`
      UPDATE player_stats
      SET games_played = games_played + 1
      WHERE user_id = ?
    `).run(userId);
  }

  incrementGamesCreated(userId: number): void {
    db.prepare(`
      UPDATE player_stats
      SET games_created = games_created + 1
      WHERE user_id = ?
    `).run(userId);
  }

  recordFinishedGame(
    userId: number,
    gamesWon: number,
    totalPoints: number,
    tricksWon: number,
    predictionsMade: number,
    exactPredictions: number,
    gamesCreatedFinished: number,
    fullGame: boolean,
  ): void {
    const fullGamesFinished = fullGame ? 1 : 0;
    const fullGamesWon = fullGame ? gamesWon : 0;

    db.prepare(`
      UPDATE player_stats
      SET
        games_finished = games_finished + 1,
        games_won = games_won + ?,
        full_games_finished = full_games_finished + ?,
        full_games_won = full_games_won + ?,
        total_points = total_points + ?,
        peak_total_points = MAX(peak_total_points, total_points + ?),
        tricks_won = tricks_won + ?,
        predictions_made = predictions_made + ?,
        exact_predictions = exact_predictions + ?,
        games_created_finished = games_created_finished + ?
      WHERE user_id = ?
    `).run(
      gamesWon,
      fullGamesFinished,
      fullGamesWon,
      totalPoints,
      totalPoints,
      tricksWon,
      predictionsMade,
      exactPredictions,
      gamesCreatedFinished,
      userId,
    );
  }

  getStats(userId: number): PlayerStats | null {
    const row = db.prepare(`
      SELECT
        user_id AS userId,
        games_played AS gamesPlayed,
        games_finished AS gamesFinished,
        games_won AS gamesWon,
        full_games_finished AS fullGamesFinished,
        full_games_won AS fullGamesWon,
        total_points AS totalPoints,
        peak_total_points AS peakTotalPoints,
        tricks_won AS tricksWon,
        predictions_made AS predictionsMade,
        exact_predictions AS exactPredictions,
        games_created AS gamesCreated,
        games_created_finished AS gamesCreatedFinished
      FROM player_stats
      WHERE user_id = ?
    `).get(userId) as PlayerStats | undefined;

    return row ?? null;
  }
}

export const playerStatsRepository = new PlayerStatsRepository();