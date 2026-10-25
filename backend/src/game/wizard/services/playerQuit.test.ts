import assert from "node:assert/strict";
import { describe, it } from "vitest";

import { WizardGameService } from "./wizardGameService.js";
import { DEFAULT_GAME_OPTIONS, type MissedTurnsToQuit } from "../gameOptions.js";
import {
  activeHumans,
  hasQuit,
  isPlayedByServer,
  quitPlayer,
  recordMissedTurn,
  recordOwnMove,
} from "./playerQuit.js";

// Three missed turns unless a test says otherwise.
const gameWith = (usernames: string[], missedTurnsToQuit: MissedTurnsToQuit = 3) =>
  new WizardGameService().createGame(1, usernames, new Map(), undefined, 1, {
    ...DEFAULT_GAME_OPTIONS,
    missedTurnsToQuit,
  });

const missTimes = (game: ReturnType<typeof gameWith>, username: string, times: number) =>
  Array.from({ length: times }, () => recordMissedTurn(game, username));

const playerOf = (game: ReturnType<typeof gameWith>, username: string) => {
  const player = game.players.find((candidate) => candidate.username === username);
  assert.ok(player);
  return player;
};

describe("playerQuit", () => {
  it("plays a seat for the server once its player quits", () => {
    const game = gameWith(["alice", "bob", "Merlin NPC"]);

    assert.equal(isPlayedByServer(playerOf(game, "Merlin NPC")), true);
    assert.equal(isPlayedByServer(playerOf(game, "alice")), false);

    quitPlayer(game, "alice");

    assert.equal(hasQuit(game, "alice"), true);
    assert.equal(isPlayedByServer(playerOf(game, "alice")), true);
    assert.deepEqual(
      activeHumans(game).map((player) => player.username),
      ["bob"],
    );
  });

  it("puts a player out after three missed turns in a row", () => {
    const game = gameWith(["alice", "bob", "carol"]);

    assert.deepEqual(missTimes(game, "alice", 3), [false, false, true]);
    assert.equal(hasQuit(game, "alice"), true);
  });

  it("waits as many missed turns as the room chose", () => {
    const game = gameWith(["alice", "bob", "carol"], 7);

    assert.deepEqual(missTimes(game, "alice", 6), [false, false, false, false, false, false]);
    assert.equal(recordMissedTurn(game, "alice"), true);
  });

  it("never puts anyone out when the room turned it off", () => {
    const game = gameWith(["alice", "bob", "carol"], null);

    missTimes(game, "alice", 12);
    assert.equal(hasQuit(game, "alice"), false);
  });

  it("starts counting again after a move of their own", () => {
    const game = gameWith(["alice", "bob", "carol"]);

    recordMissedTurn(game, "alice");
    recordMissedTurn(game, "alice");
    recordOwnMove(game, "alice");

    assert.equal(recordMissedTurn(game, "alice"), false);
    assert.equal(recordMissedTurn(game, "alice"), false);
    assert.equal(hasQuit(game, "alice"), false);
  });

  it("never puts out the last human at the table", () => {
    const game = gameWith(["alice", "Merlin NPC", "Morgana NPC"]);

    assert.ok(missTimes(game, "alice", 5).every((quit) => !quit));

    assert.equal(hasQuit(game, "alice"), false);
  });

  it("tells the table who quit", () => {
    const service = new WizardGameService();
    const game = service.createGame(1, ["alice", "bob", "carol"]);

    quitPlayer(game, "bob");

    const seen = service.getPublicGameState(game, "alice").players;
    assert.deepEqual(
      Object.fromEntries(seen.map((player) => [player.username, player.quit])),
      { alice: false, bob: true, carol: false },
    );
  });
});
