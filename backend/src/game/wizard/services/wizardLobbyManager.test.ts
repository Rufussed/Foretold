import { describe, it, expect } from "vitest";

import db from "../../../db/database.js";
import { wizardLobbyManager } from "./wizardLobbyManager.js";

describe("WizardLobbyManager", () => {
  it("does not allow new players to join a playing room", () => {
    const testSuffix = Date.now();

    const creatorUsername = `lobby-test-creator-${testSuffix}`;
    const playerUsername = `lobby-test-player-${testSuffix}`;
    const newPlayerUsername = `lobby-test-new-player-${testSuffix}`;

    const newPlayer = db
      .prepare(
        `
          INSERT INTO users (
            username,
            password_hash,
            display_name,
            email
          )
          VALUES (?, ?, ?, ?)
        `,
      )
      .run(
        newPlayerUsername,
        "test-password-hash",
        newPlayerUsername,
        `${newPlayerUsername}@test.local`,
      );

    const newPlayerId = Number(newPlayer.lastInsertRowid);

    const creator = db
      .prepare(
        `
          INSERT INTO users (
            username,
            password_hash,
            display_name,
            email
          )
          VALUES (?, ?, ?, ?)
        `,
      )
      .run(
        creatorUsername,
        "test-password-hash",
        creatorUsername,
        `${creatorUsername}@test.local`,
      );

    const player = db
      .prepare(
        `
          INSERT INTO users (
            username,
            password_hash,
            display_name,
            email
          )
          VALUES (?, ?, ?, ?)
        `,
      )
      .run(
        playerUsername,
        "test-password-hash",
        playerUsername,
        `${playerUsername}@test.local`,
      );

    const creatorId = Number(creator.lastInsertRowid);
    const playerId = Number(player.lastInsertRowid);

    const room = wizardLobbyManager.createRoom(
      `Lobby test ${testSuffix}`,
      creatorId,
      creatorUsername,
      3,
    );

    expect(room).toBeTruthy();

    const joinedRoom = wizardLobbyManager.joinRoom(
      room.id,
      playerUsername,
    );

    expect(joinedRoom.success).toBe(true);

    if (joinedRoom.success) {
      expect(joinedRoom.room.players.length).toBe(2);
      expect(joinedRoom.alreadyMember).toBe(false);
    }

    wizardLobbyManager.setRoomStatus(room.id, "playing");

    const rejectedRoom = wizardLobbyManager.joinRoom(
      room.id,
      newPlayerUsername,
    );

    expect(rejectedRoom.success).toBe(false);

    if (!rejectedRoom.success) {
      expect(rejectedRoom.reason).toBe("playing");
    }

    const existingPlayerResult = wizardLobbyManager.joinRoom(
      room.id,
      playerUsername,
    );

    expect(existingPlayerResult.success).toBe(true);

    if (existingPlayerResult.success) {
      expect(existingPlayerResult.room.id).toBe(room.id);
      expect(existingPlayerResult.alreadyMember).toBe(true);
    }

    db.prepare(
      "DELETE FROM room_players WHERE room_id = ?",
    ).run(room.id);

    db.prepare(
      "DELETE FROM rooms WHERE id = ?",
    ).run(room.id);

    db.prepare(
      "DELETE FROM users WHERE id IN (?, ?, ?)",
    ).run(
      creatorId,
      playerId,
      newPlayerId,
    );
  });
  it("does not allow new players to join a full room", () => {
    const testSuffix = Date.now();
  
    const usernames = [
      `lobby-full-creator-${testSuffix}`,
      `lobby-full-player-1-${testSuffix}`,
      `lobby-full-player-2-${testSuffix}`,
      `lobby-full-new-player-${testSuffix}`,
    ];
  
    const userIds = usernames.map((username) => {
      const result = db
        .prepare(`
          INSERT INTO users (
            username,
            password_hash,
            display_name,
            email
          )
          VALUES (?, ?, ?, ?)
        `)
        .run(
          username,
          "test-password-hash",
          username,
          `${username}@test.local`,
        );
  
      return Number(result.lastInsertRowid);
    });
  
    const room = wizardLobbyManager.createRoom(
      `Full lobby test ${testSuffix}`,
      userIds[0],
      usernames[0],
      3,
    );
  
    const firstJoin = wizardLobbyManager.joinRoom(
      room.id,
      usernames[1],
    );
  
    const secondJoin = wizardLobbyManager.joinRoom(
      room.id,
      usernames[2],
    );
  
    expect(firstJoin.success).toBe(true);
    expect(secondJoin.success).toBe(true);
  
    const rejectedJoin = wizardLobbyManager.joinRoom(
      room.id,
      usernames[3],
    );
  
    expect(rejectedJoin.success).toBe(false);
  
    if (!rejectedJoin.success) {
      expect(rejectedJoin.reason).toBe("full");
    }
  
    db.prepare(
      "DELETE FROM room_players WHERE room_id = ?",
    ).run(room.id);
  
    db.prepare(
      "DELETE FROM rooms WHERE id = ?",
    ).run(room.id);
  
    db.prepare(
      "DELETE FROM users WHERE id IN (?, ?, ?, ?)",
    ).run(...userIds);
  });
});

