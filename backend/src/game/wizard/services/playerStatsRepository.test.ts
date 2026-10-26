import { describe, it, expect } from "vitest";

import db from "../../../db/database.js";

import { playerStatsRepository } from "./playerStatsRepository.js";

describe("PlayerStatsRepository", () => {
  it("initializes statistics for a user with zero values", () => {
    const user = db.prepare(`
      INSERT INTO users (
        username,
        password_hash,
        display_name,
        email
      )
      VALUES (?, ?, ?, ?)
    `).run(
      "stats-test-user-1",
      "test",
      "Stats Test User 1",
      "stats-test-1@example.com",
    );

    const userId = Number(user.lastInsertRowid);

    try {
      playerStatsRepository.initializeForUser(userId);

      const stats = playerStatsRepository.getStats(userId);

      expect(stats).not.toBeNull();
      expect(stats?.userId).toBe(userId);
      expect(stats?.gamesPlayed).toBe(0);
      expect(stats?.gamesFinished).toBe(0);
      expect(stats?.gamesWon).toBe(0);
      expect(stats?.fullGamesFinished).toBe(0);
      expect(stats?.fullGamesWon).toBe(0);
      expect(stats?.totalPoints).toBe(0);
      expect(stats?.peakTotalPoints).toBe(0);
      expect(stats?.bestGameScore).toBeNull();
      expect(stats?.tricksWon).toBe(0);
      expect(stats?.predictionsMade).toBe(0);
      expect(stats?.exactPredictions).toBe(0);
      expect(stats?.gamesCreated).toBe(0);
      expect(stats?.gamesCreatedFinished).toBe(0);
    } finally {
      db.prepare("DELETE FROM player_stats WHERE user_id = ?").run(userId);
      db.prepare("DELETE FROM users WHERE id = ?").run(userId);
    }
  });

  it("increments games played", () => {
    const user = db.prepare(`
      INSERT INTO users (
        username,
        password_hash,
        display_name,
        email
      )
      VALUES (?, ?, ?, ?)
    `).run(
      "stats-test-user-2",
      "test",
      "Stats Test User 2",
      "stats-test-2@example.com",
    );

    const userId = Number(user.lastInsertRowid);

    try {
      playerStatsRepository.initializeForUser(userId);

      playerStatsRepository.incrementGamesPlayed(userId);
      playerStatsRepository.incrementGamesPlayed(userId);

      const stats = playerStatsRepository.getStats(userId);

      expect(stats?.gamesPlayed).toBe(2);
    } finally {
      db.prepare("DELETE FROM player_stats WHERE user_id = ?").run(userId);
      db.prepare("DELETE FROM users WHERE id = ?").run(userId);
    }
  });

  it("increments games created", () => {
    const user = db.prepare(`
      INSERT INTO users (
        username,
        password_hash,
        display_name,
        email
      )
      VALUES (?, ?, ?, ?)
    `).run(
      "stats-test-user-3",
      "test",
      "Stats Test User 3",
      "stats-test-3@example.com",
    );

    const userId = Number(user.lastInsertRowid);

    try {
      playerStatsRepository.initializeForUser(userId);

      playerStatsRepository.incrementGamesCreated(userId);
      playerStatsRepository.incrementGamesCreated(userId);
      playerStatsRepository.incrementGamesCreated(userId);

      const stats = playerStatsRepository.getStats(userId);

      expect(stats?.gamesCreated).toBe(3);
    } finally {
      db.prepare("DELETE FROM player_stats WHERE user_id = ?").run(userId);
      db.prepare("DELETE FROM users WHERE id = ?").run(userId);
    }
  });

  it("records a finished game", () => {
    const user = db.prepare(`
      INSERT INTO users (
        username,
        password_hash,
        display_name,
        email
      )
      VALUES (?, ?, ?, ?)
    `).run(
      "stats-test-user-4",
      "test",
      "Stats Test User 4",
      "stats-test-4@example.com",
    );

    const userId = Number(user.lastInsertRowid);

    try {
      playerStatsRepository.initializeForUser(userId);

      playerStatsRepository.recordFinishedGame(
        userId,
        1,
        120,
        8,
        10,
        6,
        1,
        true,
      );

      const stats = playerStatsRepository.getStats(userId);

      expect(stats?.gamesFinished).toBe(1);
      expect(stats?.gamesWon).toBe(1);
      expect(stats?.fullGamesFinished).toBe(1);
      expect(stats?.fullGamesWon).toBe(1);
      expect(stats?.totalPoints).toBe(120);
      expect(stats?.tricksWon).toBe(8);
      expect(stats?.predictionsMade).toBe(10);
      expect(stats?.exactPredictions).toBe(6);
      expect(stats?.gamesCreatedFinished).toBe(1);
    } finally {
      db.prepare("DELETE FROM player_stats WHERE user_id = ?").run(userId);
      db.prepare("DELETE FROM users WHERE id = ?").run(userId);
    }
  });

  it("accumulates statistics across multiple finished games", () => {
    const user = db.prepare(`
      INSERT INTO users (
        username,
        password_hash,
        display_name,
        email
      )
      VALUES (?, ?, ?, ?)
    `).run(
      "stats-test-user-5",
      "test",
      "Stats Test User 5",
      "stats-test-5@example.com",
    );

    const userId = Number(user.lastInsertRowid);

    try {
      playerStatsRepository.initializeForUser(userId);

      playerStatsRepository.incrementGamesPlayed(userId);
      playerStatsRepository.incrementGamesPlayed(userId);
      playerStatsRepository.incrementGamesPlayed(userId);

      playerStatsRepository.recordFinishedGame(
        userId,
        1,
        100,
        7,
        10,
        5,
        1,
        true,
      );

      playerStatsRepository.recordFinishedGame(
        userId,
        0,
        60,
        6,
        10,
        4,
        0,
        false,
      );

      const stats = playerStatsRepository.getStats(userId);

      expect(stats?.gamesPlayed).toBe(3);
      expect(stats?.gamesFinished).toBe(2);
      expect(stats?.gamesWon).toBe(1);
      expect(stats?.fullGamesFinished).toBe(1);
      expect(stats?.fullGamesWon).toBe(1);
      expect(stats?.totalPoints).toBe(160);
      expect(stats?.tricksWon).toBe(13);
      expect(stats?.predictionsMade).toBe(20);
      expect(stats?.exactPredictions).toBe(9);
      expect(stats?.gamesCreatedFinished).toBe(1);

      const gamesUnfinished =
        (stats?.gamesPlayed ?? 0) - (stats?.gamesFinished ?? 0);

      expect(gamesUnfinished).toBe(1);
    } finally {
      db.prepare("DELETE FROM player_stats WHERE user_id = ?").run(userId);
      db.prepare("DELETE FROM users WHERE id = ?").run(userId);
    }
  });

  it("counts a win in a short game only towards all games", () => {
    const user = db.prepare(`
      INSERT INTO users (
        username,
        password_hash,
        display_name,
        email
      )
      VALUES (?, ?, ?, ?)
    `).run(
      "stats-test-user-6",
      "test",
      "Stats Test User 6",
      "stats-test-6@example.com",
    );

    const userId = Number(user.lastInsertRowid);

    try {
      playerStatsRepository.initializeForUser(userId);

      playerStatsRepository.recordFinishedGame(
        userId,
        1,
        40,
        1,
        1,
        1,
        0,
        false,
      );

      const stats = playerStatsRepository.getStats(userId);

      expect(stats?.gamesFinished).toBe(1);
      expect(stats?.gamesWon).toBe(1);
      expect(stats?.fullGamesFinished).toBe(0);
      expect(stats?.fullGamesWon).toBe(0);
    } finally {
      db.prepare("DELETE FROM player_stats WHERE user_id = ?").run(userId);
      db.prepare("DELETE FROM users WHERE id = ?").run(userId);
    }
  });

  it("keeps the highest total points when a game loses points", () => {
    const user = db.prepare(`
      INSERT INTO users (
        username,
        password_hash,
        display_name,
        email
      )
      VALUES (?, ?, ?, ?)
    `).run(
      "stats-test-user-7",
      "test",
      "Stats Test User 7",
      "stats-test-7@example.com",
    );

    const userId = Number(user.lastInsertRowid);

    try {
      playerStatsRepository.initializeForUser(userId);

      playerStatsRepository.recordFinishedGame(
        userId,
        1,
        150,
        10,
        15,
        9,
        0,
        true,
      );

      playerStatsRepository.recordFinishedGame(
        userId,
        0,
        -60,
        4,
        15,
        3,
        0,
        true,
      );

      const stats = playerStatsRepository.getStats(userId);

      expect(stats?.totalPoints).toBe(90);
      expect(stats?.peakTotalPoints).toBe(150);
      expect(stats?.bestGameScore).toBe(150);
    } finally {
      db.prepare("DELETE FROM player_stats WHERE user_id = ?").run(userId);
      db.prepare("DELETE FROM users WHERE id = ?").run(userId);
    }
  });

  it("leaves a running game out of games played until the player quits it", () => {
    const user = db.prepare(`
      INSERT INTO users (
        username,
        password_hash,
        display_name,
        email
      )
      VALUES (?, ?, ?, ?)
    `).run(
      "stats-test-user-running",
      "test",
      "Stats Test User Running",
      "stats-test-running@example.com",
    );

    const userId = Number(user.lastInsertRowid);

    const room = db.prepare(`
      INSERT INTO rooms (
        name,
        created_by,
        max_players,
        status
      )
      VALUES (?, ?, ?, ?)
    `).run("Stats Running Room", userId, 3, "playing");

    const roomId = Number(room.lastInsertRowid);

    const saveState = (quit: boolean): void => {
      db.prepare(`
        INSERT INTO games (room_id, status, state_json)
        VALUES (?, 'waiting', ?)
        ON CONFLICT(room_id) DO UPDATE SET state_json = excluded.state_json
      `).run(
        roomId,
        JSON.stringify({
          players: [{ username: "stats-test-user-running", quit }],
        }),
      );
    };

    try {
      db.prepare(`
        INSERT INTO room_players (room_id, user_id, username)
        VALUES (?, ?, ?)
      `).run(roomId, userId, "stats-test-user-running");

      playerStatsRepository.initializeForUser(userId);
      playerStatsRepository.incrementGamesPlayed(userId);
      playerStatsRepository.incrementGamesPlayed(userId);

      saveState(false);
      expect(playerStatsRepository.getStats(userId)?.gamesPlayed).toBe(1);

      saveState(true);
      expect(playerStatsRepository.getStats(userId)?.gamesPlayed).toBe(2);
    } finally {
      db.prepare("DELETE FROM games WHERE room_id = ?").run(roomId);
      db.prepare("DELETE FROM room_players WHERE room_id = ?").run(roomId);
      db.prepare("DELETE FROM rooms WHERE id = ?").run(roomId);
      db.prepare("DELETE FROM player_stats WHERE user_id = ?").run(userId);
      db.prepare("DELETE FROM users WHERE id = ?").run(userId);
    }
  });
});
