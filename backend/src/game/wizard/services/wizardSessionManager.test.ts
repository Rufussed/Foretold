import { describe, it, expect, afterEach } from "vitest";

import db from "../../../db/database.js";
import { WizardSessionManager } from "./wizardSessionManager.js";
import type { WizardGameState } from "../models/wizardGame.js";

describe("WizardSessionManager", () => {
  it("only saves the first game for a room", () => {
    const manager = new WizardSessionManager();
    function createTestUser(): number {
      const user = db.prepare(`
        INSERT INTO users (
          username,
          password_hash,
          display_name,
          email
        )
        VALUES (?, ?, ?, ?)
      `).run(
        `session-test-${Date.now()}-${Math.random()}`,
        "test-password",
        "Session Test User",
        `session-test-${Date.now()}-${Math.random()}@test.local`,
      );

      return Number(user.lastInsertRowid);
    }
    const userId = createTestUser();

    const room = db.prepare(`
      INSERT INTO rooms (name, created_by, max_players, status)
      VALUES (?, ?, ?, ?)
    `).run("Session Test Room", userId, 3, "waiting");

    const roomId = Number(room.lastInsertRowid);

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

    db.prepare("DELETE FROM games WHERE room_id = ?").run(roomId);
    db.prepare("DELETE FROM rooms WHERE id = ?").run(roomId);
  });

  it("loads an active game from the repository when it is not in memory", () => {
    const manager = new WizardSessionManager();
    function createTestUser(): number {
      const user = db.prepare(`
        INSERT INTO users (
          username,
          password_hash,
          display_name,
          email
        )
        VALUES (?, ?, ?, ?)
      `).run(
        `session-test-${Date.now()}-${Math.random()}`,
        "test-password",
        "Session Test User",
        `session-test-${Date.now()}-${Math.random()}@test.local`,
      );

      return Number(user.lastInsertRowid);
    }
    const userId = createTestUser();
    const room = db.prepare(`
      INSERT INTO rooms (name, created_by, max_players, status)
      VALUES (?, ?, ?, ?)
    `).run("Persistence Test Room", userId, 3, "waiting");

    const roomId = Number(room.lastInsertRowid);

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

    db.prepare("DELETE FROM games WHERE room_id = ?").run(roomId);
    db.prepare("DELETE FROM rooms WHERE id = ?").run(roomId);
  });

  it("does not reload a finished game into memory", () => {
    const manager = new WizardSessionManager();
    function createTestUser(): number {
      const user = db.prepare(`
        INSERT INTO users (
          username,
          password_hash,
          display_name,
          email
        )
        VALUES (?, ?, ?, ?)
      `).run(
        `session-test-${Date.now()}-${Math.random()}`,
        "test-password",
        "Session Test User",
        `session-test-${Date.now()}-${Math.random()}@test.local`,
      );

      return Number(user.lastInsertRowid);
    }
    const userId = createTestUser();
    const room = db.prepare(`
      INSERT INTO rooms (name, created_by, max_players, status)
      VALUES (?, ?, ?, ?)
    `).run("Finished Game Test Room", userId, 3, "waiting");

    const roomId = Number(room.lastInsertRowid);

    const game = {
      roomId,
      status: "finished",
    } as WizardGameState;

    manager.saveGame(game);
    manager.deleteGame(roomId);

    expect(manager.getGame(roomId)).toBeNull();

    db.prepare("DELETE FROM games WHERE room_id = ?").run(roomId);
    db.prepare("DELETE FROM rooms WHERE id = ?").run(roomId);
  });
});