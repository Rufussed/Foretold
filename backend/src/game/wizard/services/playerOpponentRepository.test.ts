import { describe, it, expect } from "vitest";

import db from "../../../db/database.js";

import { playerOpponentRepository } from "./playerOpponentRepository.js";

describe("PlayerOpponentRepository", () => {
  it("records a game against a human opponent", () => {
    const player = db.prepare(`
      INSERT INTO users (
        username,
        password_hash,
        display_name,
        email
      )
      VALUES (?, ?, ?, ?)
    `).run(
      "opponent-test-player-1",
      "test",
      "Opponent Test Player 1",
      "opponent-test-1@example.com",
    );

    const opponent = db.prepare(`
      INSERT INTO users (
        username,
        password_hash,
        display_name,
        email
      )
      VALUES (?, ?, ?, ?)
    `).run(
      "opponent-test-player-2",
      "test",
      "Opponent Test Player 2",
      "opponent-test-2@example.com",
    );

    const playerId = Number(player.lastInsertRowid);
    const opponentId = Number(opponent.lastInsertRowid);

    try {
      playerOpponentRepository.recordGameAgainstUser(
        playerId,
        opponentId,
        "opponent-test-player-2",
      );

      const opponents =
        playerOpponentRepository.getOpponents(playerId);

      expect(opponents).toHaveLength(1);
      expect(opponents[0]).toEqual({
        playerId,
        opponentType: "user",
        opponentId,
        opponentName: "opponent-test-player-2",
        gamesPlayed: 1,
      });
    } finally {
      db.prepare(`
        DELETE FROM player_opponents
        WHERE player_id = ?
      `).run(playerId);

      db.prepare(`
        DELETE FROM users
        WHERE id IN (?, ?)
      `).run(playerId, opponentId);
    }
  });

  it("increments games against the same human opponent", () => {
    const player = db.prepare(`
      INSERT INTO users (
        username,
        password_hash,
        display_name,
        email
      )
      VALUES (?, ?, ?, ?)
    `).run(
      "opponent-test-player-3",
      "test",
      "Opponent Test Player 3",
      "opponent-test-3@example.com",
    );

    const opponent = db.prepare(`
      INSERT INTO users (
        username,
        password_hash,
        display_name,
        email
      )
      VALUES (?, ?, ?, ?)
    `).run(
      "opponent-test-player-4",
      "test",
      "Opponent Test Player 4",
      "opponent-test-4@example.com",
    );

    const playerId = Number(player.lastInsertRowid);
    const opponentId = Number(opponent.lastInsertRowid);

    try {
      playerOpponentRepository.recordGameAgainstUser(
        playerId,
        opponentId,
        "opponent-test-player-4",
      );

      playerOpponentRepository.recordGameAgainstUser(
        playerId,
        opponentId,
        "opponent-test-player-4",
      );

      playerOpponentRepository.recordGameAgainstUser(
        playerId,
        opponentId,
        "opponent-test-player-4",
      );

      const opponents =
        playerOpponentRepository.getOpponents(playerId);

      expect(opponents).toHaveLength(1);
      expect(opponents[0]?.gamesPlayed).toBe(3);
    } finally {
      db.prepare(`
        DELETE FROM player_opponents
        WHERE player_id = ?
      `).run(playerId);

      db.prepare(`
        DELETE FROM users
        WHERE id IN (?, ?)
      `).run(playerId, opponentId);
    }
  });

  it("records a game against a bot", () => {
    const player = db.prepare(`
      INSERT INTO users (
        username,
        password_hash,
        display_name,
        email
      )
      VALUES (?, ?, ?, ?)
    `).run(
      "opponent-test-player-5",
      "test",
      "Opponent Test Player 5",
      "opponent-test-5@example.com",
    );

    const playerId = Number(player.lastInsertRowid);

    try {
      playerOpponentRepository.recordGameAgainstBot(
        playerId,
        "Morgana NPC",
      );

      const opponents =
        playerOpponentRepository.getOpponents(playerId);

      expect(opponents).toHaveLength(1);
      expect(opponents[0]).toEqual({
        playerId,
        opponentType: "bot",
        opponentId: null,
        opponentName: "Morgana NPC",
        gamesPlayed: 1,
      });
    } finally {
      db.prepare(`
        DELETE FROM player_opponents
        WHERE player_id = ?
      `).run(playerId);

      db.prepare(`
        DELETE FROM users
        WHERE id = ?
      `).run(playerId);
    }
  });

  it("keeps human and bot opponents separate", () => {
    const player = db.prepare(`
      INSERT INTO users (
        username,
        password_hash,
        display_name,
        email
      )
      VALUES (?, ?, ?, ?)
    `).run(
      "opponent-test-player-6",
      "test",
      "Opponent Test Player 6",
      "opponent-test-6@example.com",
    );

    const opponent = db.prepare(`
      INSERT INTO users (
        username,
        password_hash,
        display_name,
        email
      )
      VALUES (?, ?, ?, ?)
    `).run(
      "Morgana NPC",
      "test",
      "Morgana NPC",
      "opponent-test-bot-name@example.com",
    );

    const playerId = Number(player.lastInsertRowid);
    const opponentId = Number(opponent.lastInsertRowid);

    try {
      playerOpponentRepository.recordGameAgainstUser(
        playerId,
        opponentId,
        "Morgana NPC",
      );

      playerOpponentRepository.recordGameAgainstBot(
        playerId,
        "Morgana NPC",
      );

      const opponents =
        playerOpponentRepository.getOpponents(playerId);

      expect(opponents).toHaveLength(2);

      expect(
        opponents.some(
          (opponent) =>
            opponent.opponentType === "user" &&
            opponent.opponentId === opponentId,
        ),
      ).toBe(true);

      expect(
        opponents.some(
          (opponent) =>
            opponent.opponentType === "bot" &&
            opponent.opponentId === null,
        ),
      ).toBe(true);
    } finally {
      db.prepare(`
        DELETE FROM player_opponents
        WHERE player_id = ?
      `).run(playerId);

      db.prepare(`
        DELETE FROM users
        WHERE id IN (?, ?)
      `).run(playerId, opponentId);
    }
  });

  it("orders opponents by games played", () => {
    const player = db.prepare(`
      INSERT INTO users (
        username,
        password_hash,
        display_name,
        email
      )
      VALUES (?, ?, ?, ?)
    `).run(
      "opponent-test-player-7",
      "test",
      "Opponent Test Player 7",
      "opponent-test-7@example.com",
    );

    const opponent1 = db.prepare(`
      INSERT INTO users (
        username,
        password_hash,
        display_name,
        email
      )
      VALUES (?, ?, ?, ?)
    `).run(
      "opponent-test-player-8",
      "test",
      "Opponent Test Player 8",
      "opponent-test-8@example.com",
    );

    const opponent2 = db.prepare(`
      INSERT INTO users (
        username,
        password_hash,
        display_name,
        email
      )
      VALUES (?, ?, ?, ?)
    `).run(
      "opponent-test-player-9",
      "test",
      "Opponent Test Player 9",
      "opponent-test-9@example.com",
    );

    const playerId = Number(player.lastInsertRowid);
    const opponent1Id = Number(opponent1.lastInsertRowid);
    const opponent2Id = Number(opponent2.lastInsertRowid);

    try {
      playerOpponentRepository.recordGameAgainstUser(
        playerId,
        opponent1Id,
        "opponent-test-player-8",
      );

      playerOpponentRepository.recordGameAgainstUser(
        playerId,
        opponent2Id,
        "opponent-test-player-9",
      );

      playerOpponentRepository.recordGameAgainstUser(
        playerId,
        opponent2Id,
        "opponent-test-player-9",
      );

      const opponents =
        playerOpponentRepository.getOpponents(playerId);

      expect(opponents[0]?.opponentId).toBe(opponent2Id);
      expect(opponents[0]?.gamesPlayed).toBe(2);
      expect(opponents[1]?.opponentId).toBe(opponent1Id);
      expect(opponents[1]?.gamesPlayed).toBe(1);
    } finally {
      db.prepare(`
        DELETE FROM player_opponents
        WHERE player_id = ?
      `).run(playerId);

      db.prepare(`
        DELETE FROM users
        WHERE id IN (?, ?, ?)
      `).run(
        playerId,
        opponent1Id,
        opponent2Id,
      );
    }
  });
});