import assert from "node:assert/strict";
import { describe, it } from "vitest";

import { WizardGameService } from "./wizardGameService.js";
import { WizardBotService } from "./wizardBotService.js";

describe("WizardBotService", () => {
  it("identifies bot players", () => {
    const gameService = new WizardGameService();
    const botService = new WizardBotService(gameService);

    assert.equal(botService.isBot("Merlin NPC"), true);
    assert.equal(botService.isBot("alice"), false);
  });

  it("chooses a valid trump suit", () => {
    const gameService = new WizardGameService();
    const botService = new WizardBotService(gameService);

    const game = gameService.createGame(
      1,
      ["alice", "Merlin NPC", "Morgana NPC"],
    );

    game.currentPlayerIndex = 1;

    const suit = botService.chooseTrumpSuit(game);

    assert.ok(
      ["Blue", "Red", "Yellow", "Green"].includes(suit),
    );
  });

  it("chooses a legal prediction", () => {
    const gameService = new WizardGameService();
    const botService = new WizardBotService(gameService);

    const game = gameService.createGame(
      1,
      ["alice", "Merlin NPC", "Morgana NPC"],
    );

    game.currentPlayerIndex = 1;

    const prediction = botService.choosePrediction(game);

    assert.equal(Number.isInteger(prediction), true);
    assert.ok(prediction >= 0);
    assert.ok(prediction <= game.currentRound);
  });

  it("chooses a legal card", () => {
    const gameService = new WizardGameService();
    const botService = new WizardBotService(gameService);

    const game = gameService.createGame(
      1,
      ["alice", "Merlin NPC", "Morgana NPC"],
    );

    game.currentPlayerIndex = 1;

    const cardIndex = botService.chooseCardIndex(game);

    assert.equal(Number.isInteger(cardIndex), true);
    assert.ok(cardIndex >= 0);
    assert.ok(cardIndex < game.players[1]!.hand.length);
  });
});