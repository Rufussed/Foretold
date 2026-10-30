import { describe, expect, it } from "vitest";

import { DEFAULT_GAME_OPTIONS } from "../gameOptions.js";
import type { Card } from "../models/card.js";
import type { WizardGameState } from "../models/wizardGame.js";
import type { RoleId } from "../modes/roles/roles.js";
import { WizardGameService } from "../services/wizardGameService.js";
import { adept } from "./adept.js";
import { apprentice } from "./apprentice.js";

const card = (suit: Card["suit"], value: Card["value"]): Card => ({ suit, value });

// A Roles game at a table of four, with Merlin NPC (seat 2) to play next
// after the cards already played by the seats before him.
function rolesTrick(
  role: RoleId,
  hand: Card[],
  played: { card: Card; role?: RoleId }[],
  { prediction, tricksWon }: { prediction: number; tricksWon: number },
): WizardGameState {
  const game = new WizardGameService().createGame(1, ["alice", "bob", "Merlin NPC", "Morgana NPC"], new Map(), undefined, 1, {
    ...DEFAULT_GAME_OPTIONS,
    mode: "roles",
  });
  const seats = ["alice", "bob"];

  game.phase = "playing";
  game.currentRound = hand.length;
  game.trumpSuit = "Red";
  game.currentPlayerIndex = 2;
  game.currentTrick.playedCards = played.map((entry, index) => ({
    username: seats[index]!,
    playedBy: seats[index]!,
    card: entry.card,
  }));
  played.forEach((entry, index) => {
    if (entry.role) game.players[index]!.role = entry.role;
  });

  const merlin = game.players[2]!;
  merlin.role = role;
  merlin.hand = hand;
  merlin.prediction = prediction;
  merlin.tricksWon = tricksWon;

  return game;
}

const chosenBy = (bot: typeof adept, game: WizardGameState): Card =>
  game.players[2]!.hand[bot.chooseCardIndex(game)]!;

describe("Adept in a Roles game", () => {
  it("steals a trick it needs with its Thief's 1", () => {
    const game = rolesTrick(
      "thief",
      [card("Blue", 1), card("Blue", 5)],
      [{ card: card("Blue", 4) }, { card: card("Blue", 13) }],
      { prediction: 1, tricksWon: 0 },
    );

    expect(chosenBy(adept, game)).toEqual(card("Blue", 1));
  });

  it("fishes with its 3 while cards are still to come", () => {
    const game = rolesTrick(
      "fisher",
      [card("Blue", 3), card("Blue", 12)],
      [{ card: card("Blue", 4) }],
      { prediction: 1, tricksWon: 0 },
    );

    expect(chosenBy(adept, game)).toEqual(card("Blue", 3));
  });

  it("gambles its Servant's 2 when nothing else can win", () => {
    const game = rolesTrick(
      "servant",
      [card("Blue", 2), card("Blue", 5)],
      [{ card: card("Blue", 13) }],
      { prediction: 1, tricksWon: 0 },
    );

    expect(chosenBy(adept, game)).toEqual(card("Blue", 2));
  });

  it("keeps its Servant's 2 back when it wants to lose", () => {
    const game = rolesTrick(
      "servant",
      [card("Blue", 2), card("Blue", 5)],
      [{ card: card("Blue", 13) }],
      { prediction: 0, tricksWon: 0 },
    );

    expect(chosenBy(adept, game)).toEqual(card("Blue", 5));
  });

  it("drops its Farmer's 4 into a trick it wants to lose", () => {
    const game = rolesTrick(
      "farmer",
      [card("Green", 4), card("Green", 9)],
      [{ card: card("Blue", 13) }],
      { prediction: 0, tricksWon: 0 },
    );

    expect(chosenBy(adept, game)).toEqual(card("Green", 4));
  });

  // Merlin plays last once the fourth seat is gone.
  const lastToPlay = (game: WizardGameState): WizardGameState => {
    game.players.splice(3, 1);
    return game;
  };

  it("wins with its Shepherd's 5 as the last card while its sheep are out", () => {
    const game = lastToPlay(rolesTrick(
      "shepherd",
      [card("Blue", 4), card("Blue", 5)],
      [{ card: card("Blue", 2) }, { card: card("Blue", 3) }],
      { prediction: 1, tricksWon: 0 },
    ));
    game.players[0]!.sheep = { "Merlin NPC": 1 };

    expect(chosenBy(adept, game)).toEqual(card("Blue", 5));
  });

  it("risks its Shepherd's 5 one card before last with two sheep out", () => {
    const hand = [card("Blue", 4), card("Blue", 5), card("Blue", 9)];
    const played = [{ card: card("Blue", 2) }, { card: card("Blue", 3) }];
    const one = rolesTrick("shepherd", hand, played, { prediction: 1, tricksWon: 0 });
    const two = rolesTrick("shepherd", hand, played, { prediction: 1, tricksWon: 0 });
    one.players[0]!.sheep = { "Merlin NPC": 1 };
    two.players[0]!.sheep = { "Merlin NPC": 2 };

    expect(chosenBy(adept, one)).toEqual(card("Blue", 9));
    expect(chosenBy(adept, two)).toEqual(card("Blue", 5));
  });

  it("wins with the cheapest card when no sheep are out", () => {
    const game = lastToPlay(rolesTrick(
      "shepherd",
      [card("Blue", 4), card("Blue", 5)],
      [{ card: card("Blue", 2) }, { card: card("Blue", 3) }],
      { prediction: 1, tricksWon: 0 },
    ));

    expect(chosenBy(adept, game)).toEqual(card("Blue", 4));
  });

  it("counts its role's card in the bid", () => {
    const hand = [card("Blue", 3), card("Green", 6)];
    const fisher = rolesTrick("fisher", hand, [], { prediction: 0, tricksWon: 0 });
    const farmer = rolesTrick("farmer", hand, [], { prediction: 0, tricksWon: 0 });

    expect(adept.estimatePrediction(fisher)).toBeGreaterThan(adept.estimatePrediction(farmer));
  });
});

describe("Apprentice in a Roles game", () => {
  it("plays its role's card first, helpful or not", () => {
    const game = rolesTrick(
      "farmer",
      [card("Blue", 9), card("Blue", 4)],
      [{ card: card("Blue", 13) }],
      { prediction: 1, tricksWon: 0 },
    );

    expect(chosenBy(apprentice, game)).toEqual(card("Blue", 4));
  });

  it("bids a trick for its role's card", () => {
    const game = rolesTrick("thief", [card("Blue", 1), card("Green", 6)], [], { prediction: 0, tricksWon: 0 });

    expect(apprentice.estimatePrediction(game)).toBe(1);
  });
});
