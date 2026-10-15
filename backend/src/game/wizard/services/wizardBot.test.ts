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
  it("bids on the other players' cards in a blind round", () => {
    const gameService = new WizardGameService();
    const botService = new WizardBotService(gameService);
    const game = gameService.createGame(1, ["alice", "Merlin NPC", "Morgana NPC"], new Map(), 3, 1, {
      wizardWins: "first",
      blindFirstRound: true,
    });
    const [alice, merlin, morgana] = game.players;
    if (!alice || !merlin || !morgana) throw new Error("Test players are missing");
    game.phase = "predictions";
    game.currentPlayerIndex = 1;

    // Its own Wizard is unseen; the others' low cards say it should win.
    merlin.hand = [{ suit: "Blue", value: 14 }];
    alice.hand = [{ suit: "Red", value: 2 }];
    morgana.hand = [{ suit: "Green", value: 3 }];
    assert.equal(botService.choosePrediction(game), 1);

    // Someone else holds a Wizard, so it expects to lose.
    merlin.hand = [{ suit: "Blue", value: 13 }];
    alice.hand = [{ suit: "Red", value: 14 }];
    assert.equal(botService.choosePrediction(game), 0);
  });
});