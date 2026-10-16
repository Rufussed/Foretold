import { describe, expect, it } from "vitest";

import type { Card } from "../models/card.js";
import type { WizardGameState } from "../models/wizardGame.js";
import { WizardGameService } from "../services/wizardGameService.js";
import { adept } from "./adept.js";
import { assignBotPersonalities, strategyFor } from "./index.js";
import { apprentice } from "./apprentice.js";

const card = (suit: Card["suit"], value: Card["value"]): Card => ({ suit, value });

// A trick in progress, with Merlin NPC (the middle seat) to play next.
function trickInProgress(
  hand: Card[],
  played: Card[],
  { prediction, tricksWon }: { prediction: number; tricksWon: number },
): WizardGameState {
  const game = new WizardGameService().createGame(1, [
    "alice",
    "Merlin NPC",
    "Morgana NPC",
  ]);
  const seats = ["alice", "Morgana NPC"];

  game.phase = "playing";
  game.currentRound = hand.length;
  game.trumpSuit = "Red";
  game.currentPlayerIndex = 1;
  game.currentTrick.playedCards = played.map((card, index) => ({
    username: seats[index]!,
    card,
  }));

  const merlin = game.players[1]!;
  merlin.hand = hand;
  merlin.prediction = prediction;
  merlin.tricksWon = tricksWon;

  return game;
}

const chosenCard = (game: WizardGameState): Card =>
  game.players[1]!.hand[adept.chooseCardIndex(game)]!;

describe("Adept", () => {
  it("plays last with the cheapest card that takes a trick it needs", () => {
    const game = trickInProgress(
      [card("Blue", 13), card("Blue", 9), card("Blue", 3)],
      [card("Blue", 7), card("Green", 12)],
      { prediction: 1, tricksWon: 0 },
    );

    expect(chosenCard(game)).toEqual(card("Blue", 9));
  });

  it("loses a trick it doesn't need with its highest losing card", () => {
    const game = trickInProgress(
      [card("Blue", 13), card("Blue", 10), card("Blue", 3)],
      [card("Blue", 11), card("Green", 12)],
      { prediction: 0, tricksWon: 0 },
    );

    expect(chosenCard(game)).toEqual(card("Blue", 10));
  });

  it("trumps in when it can't follow suit and needs the trick", () => {
    const game = trickInProgress(
      [card("Red", 4), card("Yellow", 13), card("Green", 2)],
      [card("Blue", 13), card("Blue", 12)],
      { prediction: 1, tricksWon: 0 },
    );

    expect(chosenCard(game)).toEqual(card("Red", 4));
  });

  it("keeps its Wizard back while another card can win", () => {
    const game = trickInProgress(
      [{ suit: "Blue", value: 14 }, card("Blue", 12), card("Blue", 2)],
      [card("Blue", 5)],
      { prediction: 1, tricksWon: 0 },
    );

    expect(chosenCard(game)).toEqual(card("Blue", 12));
  });

  it("leads low, keeping its Jester, when it wants no more tricks", () => {
    const game = trickInProgress(
      [{ suit: "Blue", value: 0 }, card("Yellow", 6), card("Green", 2)],
      [],
      { prediction: 1, tricksWon: 1 },
    );

    expect(chosenCard(game)).toEqual(card("Green", 2));
  });

  it("counts trumps when it predicts", () => {
    const game = trickInProgress(
      [card("Red", 13), card("Red", 10), card("Blue", 3)],
      [],
      { prediction: 0, tricksWon: 0 },
    );
    game.phase = "predictions";
    game.currentTrick.playedCards = [];

    expect(adept.estimatePrediction(game)).toBe(2);
    expect(apprentice.estimatePrediction(game)).toBe(1);
  });
});

describe("assignBotPersonalities", () => {
  const players = () =>
    new WizardGameService().createGame(1, ["alice", "Merlin NPC", "Morgana NPC"]).players;

  it("gives every bot the chosen personality and leaves humans alone", () => {
    const table = players();
    assignBotPersonalities(table, "adept");

    expect(table.map((player) => player.botPersonality)).toEqual([
      undefined,
      "adept",
      "adept",
    ]);
  });

  it("draws a personality per bot for a mixed table", () => {
    const table = players();
    const draws = [0.1, 0.9];
    assignBotPersonalities(table, "mixed", () => draws.shift() ?? 0);

    expect(table.map((player) => player.botPersonality)).toEqual([
      undefined,
      "apprentice",
      "adept",
    ]);
  });

  it("plays a human or an older saved bot as the Apprentice", () => {
    const [human, bot] = players();

    expect(strategyFor(human!)).toBe(apprentice);
    expect(strategyFor(bot!)).toBe(apprentice);
  });
});
