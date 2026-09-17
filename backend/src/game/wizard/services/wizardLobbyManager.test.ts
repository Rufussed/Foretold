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

    expect(joinedRoom).toBeTruthy();
    expect(joinedRoom?.players.length).toBe(2);

    wizardLobbyManager.setRoomStatus(room.id, "playing");

    const rejectedRoom = wizardLobbyManager.joinRoom(
      room.id,
      newPlayerUsername,
    );

    expect(rejectedRoom).toBeNull();

    const existingPlayerResult = wizardLobbyManager.joinRoom(
      room.id,
      playerUsername,
    );

    expect(existingPlayerResult).toBeTruthy();
    expect(existingPlayerResult?.id).toBe(room.id);

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
});