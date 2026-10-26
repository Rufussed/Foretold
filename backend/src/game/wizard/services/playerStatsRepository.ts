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
  // Null until the player finishes a game.
  bestGameScore: number | null;
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
        best_game_score = MAX(COALESCE(best_game_score, ?), ?),
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
        best_game_score AS bestGameScore,
        tricks_won AS tricksWon,
        predictions_made AS predictionsMade,
        exact_predictions AS exactPredictions,
        games_created AS gamesCreated,
        games_created_finished AS gamesCreatedFinished
      FROM player_stats
      WHERE user_id = ?
    `).get(userId) as PlayerStats | undefined;

    if (!row) {
      return null;
    }

    // A game counts as played from its start, but one still running is not
    // yet unfinished: leave it out until it ends, so it does not lower the
    // player's reliability meanwhile. A running game they quit stays in, as
    // it is unfinished for them already.
    row.gamesPlayed = Math.max(
      row.gamesFinished,
      row.gamesPlayed - this.countRunningGames(userId),
    );

    return row;
  }

  // Games under way in which the player still has their seat.
  private countRunningGames(userId: number): number {
    const row = db.prepare(`
      SELECT COUNT(*) AS count
      FROM games
      JOIN room_players ON room_players.room_id = games.room_id
      WHERE room_players.user_id = ?
        AND games.status NOT IN ('finished', 'expired')
        AND NOT EXISTS (
          SELECT 1
          FROM json_each(games.state_json, '$.players') AS player
          WHERE json_extract(player.value, '$.username') = room_players.username
            AND json_extract(player.value, '$.quit') = 1
        )
    `).get(userId) as { count: number };

    return row.count;
  }
}

export const playerStatsRepository = new PlayerStatsRepository();