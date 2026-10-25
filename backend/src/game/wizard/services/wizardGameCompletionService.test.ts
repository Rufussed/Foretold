import { describe, it, expect } from "vitest";
import db from "../../../db/database.js";
import type { WizardGameState } from "../models/wizardGame.js";
import { wizardGameCompletionService } from "./wizardGameCompletionService.js";
import { randomUUID } from "node:crypto";


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
    `${username}-${randomUUID()}`,
    "test-password-hash",
    displayName,
    `${username}-${randomUUID()}@example.com`,
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
    pace: 1,
    turnDeadlineAt: null,
    turnTimeoutMs: 30_000,
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
        full_games_finished: number;
        full_games_won: number;
      };

      expect(creatorStats.games_finished).toBe(1);
      expect(creatorStats.games_won).toBe(1);
      // One round of a 20-round game for three players.
      expect(creatorStats.full_games_finished).toBe(0);
      expect(creatorStats.full_games_won).toBe(0);
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

  it("counts a game played to its full length as a full game", () => {
    const winnerId = createTestUser(
      "full-game-completion-winner",
      "Winner",
    );
    const loserId = createTestUser(
      "full-game-completion-loser",
      "Loser",
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
      "Full Game Completion Room",
      winnerId,
      3,
    );

    const roomId = Number(room.lastInsertRowid);

    for (const [userId, username] of [
      [winnerId, "full-game-completion-winner"],
      [loserId, "full-game-completion-loser"],
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

    // The bot fills the third seat, so a full game is 20 rounds.
    const game = {
      ...createTestGame(
        roomId,
        "full-game-completion-winner",
        "full-game-completion-loser",
        "Morgana NPC",
      ),
      totalRounds: 20,
    };

    const fullGameStats = (userId: number) => db.prepare(`
      SELECT
        games_finished,
        full_games_finished,
        full_games_won
      FROM player_stats
      WHERE user_id = ?
    `).get(userId);

    try {
      wizardGameCompletionService.completeGame(game);

      expect(fullGameStats(winnerId)).toEqual({
        games_finished: 1,
        full_games_finished: 1,
        full_games_won: 1,
      });
      expect(fullGameStats(loserId)).toEqual({
        games_finished: 1,
        full_games_finished: 1,
        full_games_won: 0,
      });
    } finally {
      db.prepare(`
        DELETE FROM player_opponents
        WHERE player_id IN (?, ?)
      `).run(winnerId, loserId);

      db.prepare(`
        DELETE FROM player_stats
        WHERE user_id IN (?, ?)
      `).run(winnerId, loserId);

      db.prepare(`
        DELETE FROM users
        WHERE id IN (?, ?)
      `).run(winnerId, loserId);
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

  // The room lookup joins users, so an unqualified "id" was ambiguous and
  // every expiry threw; the 24-hour cleanup then stalled on the first
  // playing room and nothing after it was ever removed.
  it("deletes the game, room players, and room when a game expires", () => {
    const creatorId = createTestUser(
      "cleanup-expiry-creator",
      "Creator",
    );
    const player2Id = createTestUser(
      "cleanup-expiry-player2",
      "Player 2",
    );
    const player3Id = createTestUser(
      "cleanup-expiry-player3",
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
      "Cleanup Expiry Room",
      creatorId,
      3,
    );

    const roomId = Number(room.lastInsertRowid);

    for (const [userId, username] of [
      [creatorId, "cleanup-expiry-creator"],
      [player2Id, "cleanup-expiry-player2"],
      [player3Id, "cleanup-expiry-player3"],
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
      VALUES (?, 'playing', ?)
    `).run(roomId, JSON.stringify({ roomId }));

    const game = createTestGame(
      roomId,
      "cleanup-expiry-creator",
      "cleanup-expiry-player2",
      "cleanup-expiry-player3",
    );

    try {
      wizardGameCompletionService.expireGame(game);

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
        DELETE FROM games
        WHERE room_id = ?
      `).run(roomId);

      db.prepare(`
        DELETE FROM room_players
        WHERE room_id = ?
      `).run(roomId);

      db.prepare(`
        DELETE FROM rooms
        WHERE id = ?
      `).run(roomId);

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

  it("does not count the game as finished for a player who quit", () => {
    const creatorId = createTestUser("completion-quit-creator", "Creator");
    const quitterId = createTestUser("completion-quit-quitter", "Quitter");
    const player3Id = createTestUser("completion-quit-player3", "Player 3");

    const room = db.prepare(`
      INSERT INTO rooms (
        name,
        created_by,
        max_players,
        status
      )
      VALUES (?, ?, ?, 'playing')
    `).run("Completion Quit Room", creatorId, 3);

    const roomId = Number(room.lastInsertRowid);

    const addPlayer = db.prepare(`
      INSERT INTO room_players (
        room_id,
        user_id,
        username
      )
      VALUES (?, ?, ?)
    `);
    addPlayer.run(roomId, creatorId, "completion-quit-creator");
    addPlayer.run(roomId, quitterId, "completion-quit-quitter");
    addPlayer.run(roomId, player3Id, "completion-quit-player3");

    const game = createTestGame(
      roomId,
      "completion-quit-creator",
      "completion-quit-quitter",
      "completion-quit-player3",
    );
    game.players[1]!.quit = true;

    try {
      wizardGameCompletionService.completeGame(game);

      const statsOf = (userId: number) =>
        db.prepare(`
          SELECT games_finished, total_points
          FROM player_stats
          WHERE user_id = ?
        `).get(userId) as { games_finished: number; total_points: number };

      expect(statsOf(quitterId)).toEqual({ games_finished: 0, total_points: 0 });
      expect(statsOf(creatorId).games_finished).toBe(1);
      expect(statsOf(player3Id).games_finished).toBe(1);

      // The quitter still remembers whom they played against.
      const opponents = db.prepare(`
        SELECT COUNT(*) AS count
        FROM player_opponents
        WHERE player_id = ?
      `).get(quitterId) as { count: number };

      expect(opponents.count).toBe(2);
    } finally {
      db.prepare(`
        DELETE FROM player_opponents
        WHERE player_id IN (?, ?, ?)
      `).run(creatorId, quitterId, player3Id);

      db.prepare(`
        DELETE FROM player_stats
        WHERE user_id IN (?, ?, ?)
      `).run(creatorId, quitterId, player3Id);

      db.prepare(`
        DELETE FROM users
        WHERE id IN (?, ?, ?)
      `).run(creatorId, quitterId, player3Id);
    }
  });
});
