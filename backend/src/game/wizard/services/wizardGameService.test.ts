import { describe, it } from "vitest";
import assert from "node:assert/strict";
import { shuffledSeating, WizardGameService } from "./wizardGameService.js";
import { LEGACY_GAME_OPTIONS } from "../gameOptions.js";
import type { PlayedCard, WizardGameState } from "../models/wizardGame.js";


describe("WizardGameService", () => {
  it("shows a blind first round's cards to everyone but their holder", () => {
    const service = new WizardGameService();
    const game = service.createGame(1, ["alice", "bob", "mike"], new Map(), 3, 1, {
      wizardWins: "first",
      blindFirstRound: true,
      missedTurnsToQuit: 3,
    });

    const blind = service.getPublicGameState(game, "alice");
    const hands = new Map(blind.players.map((player) => [player.username, player]));
    assert.equal(blind.blindRound, true);
    assert.equal(hands.get("alice")?.hand.length, 0);
    assert.equal(hands.get("alice")?.handCount, 1);
    assert.equal(hands.get("bob")?.hand.length, 1);
    assert.equal(hands.get("mike")?.hand.length, 1);

    // From the second round, hands are private again.
    game.currentRound = 2;
    const sighted = service.getPublicGameState(game, "alice");
    assert.equal(sighted.blindRound, false);
    assert.equal(sighted.players.find((player) => player.username === "bob")?.hand.length, 0);
  });

  it("treats a game saved before options existed as the official rules", () => {
    const service = new WizardGameService();
    const game = service.createGame(1, ["alice", "bob", "mike"]);
    delete game.options;

    const state = service.getPublicGameState(game, "alice");
    assert.deepEqual(state.options, { wizardWins: "first", blindFirstRound: false, missedTurnsToQuit: null });
    assert.equal(state.blindRound, false);
  });

  it("handles game creation and the first round", () => {
    // your existing test code here
    const service = new WizardGameService();
    // The official, sighted first round: the default is now blind.
    const game = service.createGame(
      1,
      ["alice", "bob", "mike", "ana"],
      new Map(),
      undefined,
      undefined,
      LEGACY_GAME_OPTIONS,
    );

    const publicState = service.getPublicGameState(game, "alice");
    const alice = publicState.players.find(player => player.username === "alice");
    const bob = publicState.players.find(player => player.username === "bob");
    if (!alice || !bob) throw new Error("Test players are missing");
    assert.equal(alice.hand.length, 1);
    assert.equal(bob.hand.length, 0);
    assert.equal(bob.handCount, 1);
    assert.equal("deck" in publicState, false);
    assert.equal(publicState.deckCount, 55);
    assert.equal(game.currentRound, 1);
    assert.equal(game.totalRounds, 15);

    // Wizard/Jester requires the current player to choose the trump suit.
    if (game.phase === "trump-selection") {
      const currentPlayer = game.players[game.currentPlayerIndex];
      if (!currentPlayer) throw new Error("Current player is missing");
      service.chooseTrumpSuit(game, currentPlayer.username, "Red");
    }

    assert.equal(game.phase, "predictions");

    assert.equal(game.trumpCard !== null, true);
    assert.equal(game.currentTrick.playedCards.length, 0);
    assert.equal(game.currentTrick.winnerUsername, null);
    
    for (const player of game.players) {
      assert.equal(player.hand.length, 1);
      assert.equal(player.prediction, null);
      assert.equal(player.tricksWon, 0);
    }
    
    const firstPlayer = game.players[0];
    
    if (!firstPlayer) {
      throw new Error("First player does not exist");
    }
    
    
    service.submitPrediction(game, "alice", 0);
    service.submitPrediction(game, "bob", 0);
    service.submitPrediction(game, "mike", 0);
    service.submitPrediction(game, "ana", 0);
    
    assert.equal(game.phase, "playing");
    
    service.playCard(game, 0);
    service.playCard(game, 0);
    service.playCard(game, 0);
    service.playCard(game, 0);
    
    service.advanceAfterTrick(game);
    
    assert.equal(game.currentRound, 2);

    // A Wizard trump card requires the starting player to choose a suit.
    if (game.phase === "trump-selection") {
      const currentPlayer = game.players[game.currentPlayerIndex];
      if (!currentPlayer) throw new Error("Current player is missing");
      service.chooseTrumpSuit(game, currentPlayer.username, "Red");
    }

    assert.equal(game.phase, "predictions");
    assert.equal(game.currentTrick.playedCards.length, 0);
    assert.equal(game.currentTrick.winnerUsername, null);

    for (const player of game.players) {
      assert.equal(player.hand.length, 2);
      assert.equal(player.prediction, null);
    }

    assert.equal(game.phase, "predictions");
  
    assert.equal(
      game.players.filter((player) => player.score !== 0).length,
      4,
    );
    
    assert.equal(game.currentTrick.playedCards.length, 0);
    assert.equal(game.currentTrick.winnerUsername, null);
    
  });

  it("does not allow predictions out of turn", () => {
    const service = new WizardGameService();
    const game = service.createGame(
      2,
      ["alice", "bob", "mike"],
    );

    if (game.phase === "trump-selection") {
      const currentPlayer = game.players[game.currentPlayerIndex];
      if (!currentPlayer) throw new Error("Current player is missing");
      service.chooseTrumpSuit(game, currentPlayer.username, "Red");
    }

    assert.equal(game.phase, "predictions");

    assert.throws(
      () => service.submitPrediction(game, "bob", 0),
      {
        message: "It is not this player's turn",
      },
    );
  });
});

describe("colour tricks", () => {
  // A complete trick laid out by hand; the first card is led.
  const trick = (cards: PlayedCard[]): WizardGameState => {
    const game = new WizardGameService().createGame(1, ["alice", "bob", "Mia NPC"]);
    game.trumpSuit = null;
    game.currentTrick = { playedCards: cards, winnerUsername: null };
    return game;
  };
  const colorTricks = (game: WizardGameState, username: string) =>
    game.players.find((player) => player.username === username)?.colorTricks;

  it("counts a trick won with a card of a colour", () => {
    const game = trick([
      { username: "alice", card: { suit: "Blue", value: 9 } },
      { username: "bob", card: { suit: "Blue", value: 3 } },
      { username: "Mia NPC", card: { suit: "Red", value: 12 } },
    ]);
    new WizardGameService().resolveTrick(game);
    assert.deepEqual(colorTricks(game, "alice"), { Blue: 1 });
  });

  it("does not count a Wizard, a card the server played, or a bot", () => {
    const service = new WizardGameService();

    const wizard = trick([
      { username: "alice", card: { suit: "Blue", value: 14 } },
      { username: "bob", card: { suit: "Blue", value: 3 } },
      { username: "Mia NPC", card: { suit: "Blue", value: 5 } },
    ]);
    service.resolveTrick(wizard);
    assert.equal(colorTricks(wizard, "alice"), undefined);

    const byServer = trick([
      { username: "bob", card: { suit: "Green", value: 13 }, byServer: true },
      { username: "alice", card: { suit: "Green", value: 2 } },
      { username: "Mia NPC", card: { suit: "Green", value: 5 } },
    ]);
    service.resolveTrick(byServer);
    assert.equal(byServer.currentTrick.winnerUsername, "bob");
    assert.equal(colorTricks(byServer, "bob"), undefined);

    const bot = trick([
      { username: "Mia NPC", card: { suit: "Red", value: 13 } },
      { username: "alice", card: { suit: "Red", value: 2 } },
      { username: "bob", card: { suit: "Red", value: 5 } },
    ]);
    service.resolveTrick(bot);
    assert.equal(colorTricks(bot, "Mia NPC"), undefined);
  });
});

describe("shuffledSeating", () => {
  const players = ["host", "joiner", "Merlin NPC", "Morgana NPC"];

  it("seats every player exactly once", () => {
    for (let run = 0; run < 20; run++) {
      const seating = shuffledSeating(players);
      assert.deepEqual([...seating].sort(), [...players].sort());
    }
  });

  it("does not always put the room's creator first", () => {
    // random() = 0 swaps each position with the first, rotating the order.
    assert.notEqual(shuffledSeating(players, () => 0)[0], "host");
  });

  it("leaves the given list untouched", () => {
    const before = [...players];
    shuffledSeating(players);
    assert.deepEqual(players, before);
  });
});
