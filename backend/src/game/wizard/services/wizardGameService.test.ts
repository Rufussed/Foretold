import { describe, it } from "vitest";
import assert from "node:assert/strict";
import { WizardGameService } from "./wizardGameService.js";


describe("WizardGameService", () => {
  it("handles game creation and the first round", () => {
    // your existing test code here
    const service = new WizardGameService();
    const game = service.createGame(
      1,
      ["alice", "bob", "mike", "ana"],
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
