import { describe, it, expect } from "vitest";

import db from "../../../db/database.js";
import { WizardGameRunner } from "./wizardGameRunner.js";
import { wizardSessionManager } from "./wizardSessionManager.js";
import type { WizardGameState } from "../models/wizardGame.js";

describe("WizardGameRunner", () => {
  it("completes and cleans up a finished game", async () => {
    const user = db.prepare(`
      INSERT INTO users (
        username,
        password_hash,
        display_name,
        email
      )
      VALUES (?, ?, ?, ?)
    `).run(
      `runner-test-${Date.now()}`,
      "test-password",
      "Runner Test User",
      `runner-test-${Date.now()}@test.local`,
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
    `).run(
      "Runner Test Room",
      userId,
      3,
      "playing",
    );

    const roomId = Number(room.lastInsertRowid);

    db.prepare(`
      INSERT INTO room_players (
        room_id,
        user_id,
        username
      )
      VALUES (?, ?, ?)
    `).run(
      roomId,
      userId,
      `runner-test-${userId}`,
    );

    db.prepare(`
      INSERT INTO player_stats (user_id)
      VALUES (?)
    `).run(userId);

    const game = {
      roomId,
      players: [
        {
          username: `runner-test-${userId}`,
          avatar: "forest-elf",
          hand: [],
          prediction: 0,
          tricksWon: 0,
          score: 20,
          roundScores: [
            {
              prediction: 0,
              tricksWon: 0,
              score: 20,
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
    } as WizardGameState;

    wizardSessionManager.saveGame(game);

    const broadcasts: number[] = [];

    const runner = new WizardGameRunner(
      {} as never,
      (broadcastRoomId) => {
        broadcasts.push(broadcastRoomId);
      },
    );

    await runner.run(roomId);

    expect(broadcasts).toEqual([roomId]);
    expect(wizardSessionManager.getGame(roomId)).toBeNull();

    const remainingRoom = db.prepare(`
      SELECT id
      FROM rooms
      WHERE id = ?
    `).get(roomId);

    const remainingGame = db.prepare(`
      SELECT room_id
      FROM games
      WHERE room_id = ?
    `).get(roomId);

    const remainingRoomPlayer = db.prepare(`
      SELECT room_id
      FROM room_players
      WHERE room_id = ?
    `).get(roomId);

    expect(remainingRoom).toBeUndefined();
    expect(remainingGame).toBeUndefined();
    expect(remainingRoomPlayer).toBeUndefined();

    const stats = db.prepare(`
      SELECT
        games_finished,
        games_won,
        total_points,
        tricks_won,
        predictions_made,
        exact_predictions,
        games_created_finished
      FROM player_stats
      WHERE user_id = ?
    `).get(userId) as {
      games_finished: number;
      games_won: number;
      total_points: number;
      tricks_won: number;
      predictions_made: number;
      exact_predictions: number;
      games_created_finished: number;
    };

    expect(stats.games_finished).toBe(1);
    expect(stats.games_won).toBe(1);
    expect(stats.total_points).toBe(20);
    expect(stats.tricks_won).toBe(0);
    expect(stats.predictions_made).toBe(1);
    expect(stats.exact_predictions).toBe(1);
    expect(stats.games_created_finished).toBe(1);

    db.prepare(`
      DELETE FROM player_opponents
      WHERE player_id = ?
    `).run(userId);

    db.prepare(`
      DELETE FROM player_stats
      WHERE user_id = ?
    `).run(userId);

    db.prepare(`
      DELETE FROM users
      WHERE id = ?
    `).run(userId);
  });
});