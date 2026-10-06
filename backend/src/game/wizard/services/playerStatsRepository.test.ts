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
      expect(stats?.totalPoints).toBe(0);
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
      );

      const stats = playerStatsRepository.getStats(userId);

      expect(stats?.gamesFinished).toBe(1);
      expect(stats?.gamesWon).toBe(1);
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
      );

      playerStatsRepository.recordFinishedGame(
        userId,
        0,
        60,
        6,
        10,
        4,
        0,
      );

      const stats = playerStatsRepository.getStats(userId);

      expect(stats?.gamesPlayed).toBe(3);
      expect(stats?.gamesFinished).toBe(2);
      expect(stats?.gamesWon).toBe(1);
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
});