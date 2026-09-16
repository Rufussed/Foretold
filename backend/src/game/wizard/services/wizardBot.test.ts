import assert from "node:assert/strict";
import { WizardGameService } from "./wizardGameService.js";
import { WizardBotService } from "./wizardBotService.js";
import { isJester } from "../models/card.js";
import { WizardRules } from "./wizardRules.js";

const gameService = new WizardGameService();
const botService = new WizardBotService(gameService);
const rules = new WizardRules();

const game = gameService.createGame(
  1,
  ["alice", "Merlin NPC", "Morgana NPC", "Esmeralda NPC"],
);

game.status = "playing";

gameService.submitPrediction(game, "alice", 0);
// botService.playAvailableTurns(game);

while (game.phase !== "finished") {
  const player = game.players[game.currentPlayerIndex];

  assert.ok(player);

  if (player.username === "alice") {
    if (game.phase === "predictions") {
      gameService.submitPrediction(game, "alice", 0);
    } else {
      	const leadSuit =
		game.currentTrick.playedCards.find(
			({ card }) => !isJester(card),
		)?.card.suit ?? null;

		const cardIndex = player.hand.findIndex((card) =>
		rules.isValidCardPlay(card, player.hand, leadSuit),
		);

		assert.notEqual(cardIndex, -1);
		gameService.playCard(game, cardIndex);
    }
  }

  // botService.playAvailableTurns(game);
}

assert.equal(game.status, "finished");
assert.equal(game.phase, "finished");

console.log("Wizard bot behavior test passed");