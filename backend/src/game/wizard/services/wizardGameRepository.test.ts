import { describe, it, expect } from "vitest";

import db from "../../../db/database.js";
import { WizardSessionManager } from "./wizardSessionManager.js";
import type { WizardGameState } from "../models/wizardGame.js";

describe("WizardSessionManager", () => {
  it("only saves the first game for a room", () => {
    const manager = new WizardSessionManager();

    const user = db.prepare(`
      INSERT INTO users (
        username,
        password_hash,
        display_name,
        email
      )
      VALUES (?, ?, ?, ?)
    `).run(
      "session-test-user-1",
      "test",
      "Session Test User 1",
      "session-test-1@example.com",
    );

    const room = db.prepare(`
      INSERT INTO rooms (
        name,
        created_by,
        max_players,
        status
      )
      VALUES (?, ?, ?, ?)
    `).run(
      "Session Test Room 1",
      user.lastInsertRowid,
      3,
      "waiting",
    );

    const roomId = Number(room.lastInsertRowid);

    try {
      const game1 = {
        roomId,
        status: "waiting",
      } as WizardGameState;

      const game2 = {
        roomId,
        status: "waiting",
      } as WizardGameState;

      const firstResult = manager.saveGameIfAbsent(game1);
      const secondResult = manager.saveGameIfAbsent(game2);

      expect(firstResult).toBe(true);
      expect(secondResult).toBe(false);
      expect(manager.getGame(roomId)).toBe(game1);
    } finally {
      manager.deleteGame(roomId);
      db.prepare("DELETE FROM games WHERE room_id = ?").run(roomId);
      db.prepare("DELETE FROM rooms WHERE id = ?").run(roomId);
      db.prepare("DELETE FROM users WHERE id = ?").run(user.lastInsertRowid);
    }
  });

  it("loads an active game from the repository when it is not in memory", () => {
    const manager = new WizardSessionManager();

    const user = db.prepare(`
      INSERT INTO users (
        username,
        password_hash,
        display_name,
        email
      )
      VALUES (?, ?, ?, ?)
    `).run(
      "session-test-user-2",
      "test",
      "Session Test User 2",
      "session-test-2@example.com",
    );

    const room = db.prepare(`
      INSERT INTO rooms (
        name,
        created_by,
        max_players,
        status
      )
      VALUES (?, ?, ?, ?)
    `).run(
      "Session Test Room 2",
      user.lastInsertRowid,
      3,
      "waiting",
    );

    const roomId = Number(room.lastInsertRowid);

    try {
      const game = {
        roomId,
        status: "waiting",
      } as WizardGameState;

      manager.saveGame(game);
      manager.deleteGame(roomId);

      const loadedGame = manager.getGame(roomId);

      expect(loadedGame).not.toBeNull();
      expect(loadedGame?.roomId).toBe(roomId);
      expect(loadedGame?.status).toBe("waiting");
    } finally {
      manager.deleteGame(roomId);
      db.prepare("DELETE FROM games WHERE room_id = ?").run(roomId);
      db.prepare("DELETE FROM rooms WHERE id = ?").run(roomId);
      db.prepare("DELETE FROM users WHERE id = ?").run(user.lastInsertRowid);
    }
  });

  it("does not reload a finished game into memory", () => {
    const manager = new WizardSessionManager();

    const user = db.prepare(`
      INSERT INTO users (
        username,
        password_hash,
        display_name,
        email
      )
      VALUES (?, ?, ?, ?)
    `).run(
      "session-test-user-3",
      "test",
      "Session Test User 3",
      "session-test-3@example.com",
    );

    const room = db.prepare(`
      INSERT INTO rooms (
        name,
        created_by,
        max_players,
        status
      )
      VALUES (?, ?, ?, ?)
    `).run(
      "Session Test Room 3",
      user.lastInsertRowid,
      3,
      "waiting",
    );

    const roomId = Number(room.lastInsertRowid);

    try {
      const game = {
        roomId,
        status: "finished",
      } as WizardGameState;

      manager.saveGame(game);
      manager.deleteGame(roomId);

      expect(manager.getGame(roomId)).toBeNull();
    } finally {
      manager.deleteGame(roomId);
      db.prepare("DELETE FROM games WHERE room_id = ?").run(roomId);
      db.prepare("DELETE FROM rooms WHERE id = ?").run(roomId);
      db.prepare("DELETE FROM users WHERE id = ?").run(user.lastInsertRowid);
    }
  });
});

