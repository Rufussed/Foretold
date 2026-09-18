import { describe, it, expect } from "vitest";
import db from "../../../db/database.js";
import type { WizardGameState } from "../models/wizardGame.js";
import { wizardGameCompletionService } from "./wizardGameCompletionService.js";

function createTestUser(
  username: string,
  displayName: string,
): number {
  const result = db.prepare(`
    INSERT INTO users (
      username,
      password_hash,
      display_name,
      email
    )
    VALUES (?, ?, ?, ?)
  `).run(
    username,
    "test-password-hash",
    displayName,
    `${username}@example.com`,
  );

  const userId = Number(result.lastInsertRowid);

  db.prepare(`
    INSERT INTO player_stats (user_id)
    VALUES (?)
  `).run(userId);

  return userId;
}

function createTestGame(
  roomId: number,
  player1: string,
  player2: string,
  player3: string,
): WizardGameState {
  return {
    roomId,
    players: [
      {
        username: player1,
        avatar: "forest-elf",
        hand: [],
        prediction: null,
        tricksWon: 3,
        score: 50,
        roundScores: [
          {
            prediction: 3,
            tricksWon: 3,
            score: 50,
          },
        ],
      },
      {
        username: player2,
        avatar: "blind-wizard",
        hand: [],
        prediction: null,
        tricksWon: 2,
        score: 30,
        roundScores: [
          {
            prediction: 1,
            tricksWon: 2,
            score: -10,
          },
        ],
      },
      {
        username: player3,
        avatar: "black-witch",
        hand: [],
        prediction: null,
        tricksWon: 1,
        score: 20,
        roundScores: [
          {
            prediction: 1,
            tricksWon: 1,
            score: 30,
          },
        ],
      },
    ],
    currentRound: 1,
    totalRounds: 1,
    startingPlayerIndex: 0,
    currentPlayerIndex: 0,
    trumpCard: null,
    trumpSuit: null,
    currentTrick: {
      playedCards: [],
      winnerUsername: null,
    },
    status: "finished",
    deck: [],
    phase: "finished",
  };
}

describe("WizardGameCompletionService", () => {
  it("records finished-game statistics for human players", () => {
    const creatorId = createTestUser(
      "completion-test-creator",
      "Creator",
    );
    const player2Id = createTestUser(
      "completion-test-player2",
      "Player 2",
    );
    const player3Id = createTestUser(
      "completion-test-player3",
      "Player 3",
    );

    const room = db.prepare(`
      INSERT INTO rooms (
        name,
        created_by,
        max_players,
        status
      )
      VALUES (?, ?, ?, 'playing')
    `).run(
      "Completion Test Room",
      creatorId,
      3,
    );

    const roomId = Number(room.lastInsertRowid);

    db.prepare(`
      INSERT INTO room_players (
        room_id,
        user_id,
        username
      )
      VALUES (?, ?, ?)
    `).run(roomId, creatorId, "completion-test-creator");

    db.prepare(`
      INSERT INTO room_players (
        room_id,
        user_id,
        username
      )
      VALUES (?, ?, ?)
    `).run(roomId, player2Id, "completion-test-player2");

    db.prepare(`
      INSERT INTO room_players (
        room_id,
        user_id,
        username
      )
      VALUES (?, ?, ?)
    `).run(roomId, player3Id, "completion-test-player3");

    const game = createTestGame(
      roomId,
      "completion-test-creator",
      "completion-test-player2",
      "completion-test-player3",
    );

    try {
      wizardGameCompletionService.completeGame(game);

      const creatorStats = db.prepare(`
        SELECT *
        FROM player_stats
        WHERE user_id = ?
      `).get(creatorId) as {
        games_finished: number;
        games_won: number;
        total_points: number;
        tricks_won: number;
        predictions_made: number;
        exact_predictions: number;
        games_created_finished: number;
      };

      expect(creatorStats.games_finished).toBe(1);
      expect(creatorStats.games_won).toBe(1);
      expect(creatorStats.total_points).toBe(50);
      expect(creatorStats.tricks_won).toBe(3);
      expect(creatorStats.predictions_made).toBe(1);
      expect(creatorStats.exact_predictions).toBe(1);
      expect(creatorStats.games_created_finished).toBe(1);

      const player2Stats = db.prepare(`
        SELECT *
        FROM player_stats
        WHERE user_id = ?
      `).get(player2Id) as {
        games_finished: number;
        games_won: number;
        total_points: number;
        tricks_won: number;
        predictions_made: number;
        exact_predictions: number;
        games_created_finished: number;
      };

      expect(player2Stats.games_finished).toBe(1);
      expect(player2Stats.games_won).toBe(0);
      expect(player2Stats.total_points).toBe(30);
      expect(player2Stats.tricks_won).toBe(2);
      expect(player2Stats.predictions_made).toBe(1);
      expect(player2Stats.exact_predictions).toBe(0);
      expect(player2Stats.games_created_finished).toBe(0);
    } finally {
	  db.prepare(`
		DELETE FROM player_opponents
		WHERE player_id IN (?, ?, ?)
		`).run(creatorId, player2Id, player3Id);

      db.prepare(`
        DELETE FROM player_stats
        WHERE user_id IN (?, ?, ?)
      `).run(creatorId, player2Id, player3Id);

      db.prepare(`
        DELETE FROM users
        WHERE id IN (?, ?, ?)
      `).run(creatorId, player2Id, player3Id);
    }
  });

  it("records human and bot opponents", () => {
    const player1Id = createTestUser(
      "opponent-completion-player1",
      "Player 1",
    );
    const player2Id = createTestUser(
      "opponent-completion-player2",
      "Player 2",
    );

    const room = db.prepare(`
      INSERT INTO rooms (
        name,
        created_by,
        max_players,
        status
      )
      VALUES (?, ?, ?, 'playing')
    `).run(
      "Opponent Completion Room",
      player1Id,
      3,
    );

    const roomId = Number(room.lastInsertRowid);

    db.prepare(`
      INSERT INTO room_players (
        room_id,
        user_id,
        username
      )
      VALUES (?, ?, ?)
    `).run(roomId, player1Id, "opponent-completion-player1");

    db.prepare(`
      INSERT INTO room_players (
        room_id,
        user_id,
        username
      )
      VALUES (?, ?, ?)
    `).run(roomId, player2Id, "opponent-completion-player2");

    const game = createTestGame(
      roomId,
      "opponent-completion-player1",
      "opponent-completion-player2",
      "Morgana NPC",
    );

    try {
      wizardGameCompletionService.completeGame(game);

      const opponents = db.prepare(`
        SELECT
          opponent_type,
          opponent_id,
          opponent_name,
          games_played
        FROM player_opponents
        WHERE player_id = ?
        ORDER BY opponent_type, opponent_name
      `).all(player1Id) as {
        opponent_type: string;
        opponent_id: number | null;
        opponent_name: string;
        games_played: number;
      }[];

      expect(opponents).toHaveLength(2);

      const humanOpponent = opponents.find(
        (opponent) => opponent.opponent_type === "user",
      );

      expect(humanOpponent).toEqual({
        opponent_type: "user",
        opponent_id: player2Id,
        opponent_name: "opponent-completion-player2",
        games_played: 1,
      });

      const botOpponent = opponents.find(
        (opponent) => opponent.opponent_type === "bot",
      );

      expect(botOpponent).toEqual({
        opponent_type: "bot",
        opponent_id: null,
        opponent_name: "Morgana NPC",
        games_played: 1,
      });
    } finally {
      db.prepare(`
        DELETE FROM player_opponents
        WHERE player_id IN (?, ?)
      `).run(player1Id, player2Id);

      db.prepare(`
        DELETE FROM player_stats
        WHERE user_id IN (?, ?)
      `).run(player1Id, player2Id);

      db.prepare(`
        DELETE FROM users
        WHERE id IN (?, ?)
      `).run(player1Id, player2Id);
    }
  });

  it("deletes the game, room players, and room after completion", () => {
    const creatorId = createTestUser(
      "cleanup-completion-creator",
      "Creator",
    );
    const player2Id = createTestUser(
      "cleanup-completion-player2",
      "Player 2",
    );
    const player3Id = createTestUser(
      "cleanup-completion-player3",
      "Player 3",
    );

    const room = db.prepare(`
      INSERT INTO rooms (
        name,
        created_by,
        max_players,
        status
      )
      VALUES (?, ?, ?, 'playing')
    `).run(
      "Cleanup Completion Room",
      creatorId,
      3,
    );

    const roomId = Number(room.lastInsertRowid);

    for (const [userId, username] of [
      [creatorId, "cleanup-completion-creator"],
      [player2Id, "cleanup-completion-player2"],
      [player3Id, "cleanup-completion-player3"],
    ] as const) {
      db.prepare(`
        INSERT INTO room_players (
          room_id,
          user_id,
          username
        )
        VALUES (?, ?, ?)
      `).run(roomId, userId, username);
    }

    db.prepare(`
      INSERT INTO games (
        room_id,
        status,
        state_json
      )
      VALUES (?, 'finished', ?)
    `).run(roomId, JSON.stringify({ roomId }));

    const game = createTestGame(
      roomId,
      "cleanup-completion-creator",
      "cleanup-completion-player2",
      "cleanup-completion-player3",
    );

    try {
      wizardGameCompletionService.completeGame(game);

      const gameRow = db.prepare(`
        SELECT id
        FROM games
        WHERE room_id = ?
      `).get(roomId);

      const roomPlayers = db.prepare(`
        SELECT id
        FROM room_players
        WHERE room_id = ?
      `).all(roomId);

      const roomRow = db.prepare(`
        SELECT id
        FROM rooms
        WHERE id = ?
      `).get(roomId);

      expect(gameRow).toBeUndefined();
      expect(roomPlayers).toHaveLength(0);
      expect(roomRow).toBeUndefined();
    } finally {
      db.prepare(`
        DELETE FROM player_opponents
        WHERE player_id IN (?, ?, ?)
      `).run(creatorId, player2Id, player3Id);

      db.prepare(`
        DELETE FROM player_stats
        WHERE user_id IN (?, ?, ?)
      `).run(creatorId, player2Id, player3Id);

      db.prepare(`
        DELETE FROM users
        WHERE id IN (?, ?, ?)
      `).run(creatorId, player2Id, player3Id);
    }
  });
});