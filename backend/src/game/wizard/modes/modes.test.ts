import { describe, it, expect } from "vitest";

import db from "../../../db/database.js";
import { DEFAULT_GAME_OPTIONS, normalizeGameOptions } from "../gameOptions.js";
import { wizardLobbyManager } from "../services/wizardLobbyManager.js";

describe("game modes in the options", () => {
  it("reads an older game or room with no mode as Classic", () => {
    expect(normalizeGameOptions(null).mode).toBe("classic");
    expect(normalizeGameOptions({ wizardWins: "last" }).mode).toBe("classic");
    expect(DEFAULT_GAME_OPTIONS.mode).toBe("classic");
  });

  it("keeps a known mode and turns an unknown one into the fallback's", () => {
    expect(normalizeGameOptions({ mode: "roles" }).mode).toBe("roles");
    expect(normalizeGameOptions({ mode: "chess" }).mode).toBe("classic");
    expect(
      normalizeGameOptions({}, { ...DEFAULT_GAME_OPTIONS, mode: "roles" }).mode,
    ).toBe("roles");
  });
});

describe("a room's mode", () => {
  it("is kept from Create Room, and Classic when none is chosen", () => {
    const name = `mode-test-host-${Date.now()}`;
    const host = db
      .prepare(`
        INSERT INTO users (username, password_hash, display_name, email)
        VALUES (?, ?, ?, ?)
      `)
      .run(name, "test", name, `${name}@test.local`);
    const hostId = Number(host.lastInsertRowid);

    const roles = wizardLobbyManager.createRoom(
      "Thieves' Guild", hostId, name, 4, true, 30_000, false,
      { ...DEFAULT_GAME_OPTIONS, mode: "roles" },
    );
    const classic = wizardLobbyManager.createRoom("Plain", hostId, name);

    try {
      expect(wizardLobbyManager.getRoomById(roles.id)?.options.mode).toBe("roles");
      expect(wizardLobbyManager.getRoomById(classic.id)?.options.mode).toBe("classic");
    } finally {
      for (const roomId of [roles.id, classic.id]) {
        db.prepare("DELETE FROM room_players WHERE room_id = ?").run(roomId);
        db.prepare("DELETE FROM rooms WHERE id = ?").run(roomId);
      }
      db.prepare("DELETE FROM users WHERE id = ?").run(hostId);
    }
  });
});
