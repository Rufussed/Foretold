import assert from "node:assert/strict";
import { WizardGameService } from "./wizardGameService.js";

const service = new WizardGameService();
const game = service.createGame(
  1,
  ["alice", "bob", "mike", "ana"],
);
const publicState = service.getPublicGameState(game, "alice");

const alice = publicState.players.find(
  (player) => player.username === "alice",
);

const bob = publicState.players.find(
  (player) => player.username === "bob",
);

if (!alice || !bob) {
  throw new Error("Test players are missing");
}

assert.equal(alice.hand.length, 1);
assert.equal(bob.hand.length, 0);
assert.equal(bob.handCount, 1);
assert.equal("deck" in publicState, false);
assert.equal(publicState.deckCount, 55);


assert.equal(game.currentRound, 1);
assert.equal(game.phase, "predictions");
assert.equal(game.totalRounds, 15);
assert.equal(game.deck.length, 55);
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

assert.equal(game.currentRound, 2);
assert.equal(game.phase, "predictions");
assert.equal(game.currentTrick.playedCards.length, 0);
assert.equal(game.currentTrick.winnerUsername, null);
assert.equal(
  game.players.filter((player) => player.score !== 0).length,
  4,
);

assert.equal(game.currentTrick.playedCards.length, 0);
assert.equal(game.currentTrick.winnerUsername, null);

console.log("WizardGameService behavior test passed");

// const normalCardGame = service.createGame(
//   2,
//   ["alice", "bob", "mike"],
// );

// normalCardGame.currentRound = 1;
// normalCardGame.totalRounds = 20;
// normalCardGame.phase = "predictions";

// normalCardGame.deck = [
//   {
//     value: 7,
//     suit: "Red",
//   },
// ];

// service.drawTrumpCard(normalCardGame);

// assert.equal(normalCardGame.trumpCard?.value, 7);
// assert.equal(normalCardGame.trumpCard?.suit, "Red");
// assert.equal(normalCardGame.trumpSuit, "Red");
// assert.equal(normalCardGame.phase, "predictions");


// const wizardGame = service.createGame(
//   3,
//   ["alice", "bob", "mike"],
// );

// wizardGame.currentRound = 1;
// wizardGame.totalRounds = 20;
// wizardGame.phase = "predictions";

// wizardGame.deck = [
//   {
//     value: 14,
//     suit: "Green",
//   },
// ];

// service.drawTrumpCard(wizardGame);

// assert.equal(wizardGame.trumpCard?.value, 14);
// assert.equal(wizardGame.trumpSuit, null);
// assert.equal(wizardGame.phase, "predictions");


// const jesterGame = service.createGame(
//   4,
//   ["alice", "bob", "mike"],
// );

// jesterGame.currentRound = 1;
// jesterGame.totalRounds = 20;
// jesterGame.currentPlayerIndex = 0;
// jesterGame.phase = "predictions";

// jesterGame.deck = [
//   {
//     value: 0,
//     suit: "Yellow",
//   },
// ];

// service.drawTrumpCard(jesterGame);

// assert.equal(jesterGame.trumpCard?.value, 0);
// assert.equal(jesterGame.trumpSuit, null);
// assert.equal(jesterGame.phase, "trump-selection");