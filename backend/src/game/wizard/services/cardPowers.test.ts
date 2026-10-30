import { describe, expect, it } from "vitest";

import type { Card } from "../models/card.js";
import type { WizardGameState } from "../models/wizardGame.js";
import { adept } from "../bots/adept.js";
import { apprentice } from "../bots/apprentice.js";
import { WizardGameService } from "./wizardGameService.js";

const service = new WizardGameService();
const card = (suit: Card["suit"], value: Card["value"]): Card => ({ suit, value });

// Round 3 of a three-player game, everyone has predicted, one trick left to
// play and alice to lead. `plays` are alice, bob and carol's cards in order.
function lastTrick(plays: [Card, Card, Card]): WizardGameState {
  const game = service.createGame(1, ["alice", "bob", "carol"]);

  game.phase = "playing";
  game.currentRound = 3;
  game.trumpSuit = null;
  game.currentPlayerIndex = 0;
  game.currentTrick = {
    playedCards: plays.map((played, index) => ({
      username: ["alice", "bob", "carol"][index]!,
      card: played,
    })),
    winnerUsername: null,
  };
  const predictions = [1, 2, 0];
  game.players.forEach((player, index) => {
    player.hand = [];
    player.prediction = predictions[index]!;
    player.tricksWon = 0;
  });

  return game;
}

describe("Seer and Trickster powers", () => {
  it("starts a power when a trick is won with a Seer, and not with other cards", () => {
    const seer = lastTrick([card("Red", 10), card("Red", 3), card("Red", 2)]);
    service.resolveTrick(seer);
    expect(seer.currentTrick.power).toMatchObject({ kind: "seer", username: "alice", resolved: false });

    const trickster = lastTrick([card("Blue", 2), card("Blue", 9), card("Blue", 1)]);
    service.resolveTrick(trickster);
    expect(trickster.currentTrick.power).toMatchObject({ kind: "trickster", username: "bob" });

    const plain = lastTrick([card("Red", 7), card("Red", 3), card("Red", 2)]);
    service.resolveTrick(plain);
    expect(plain.currentTrick.power).toBeUndefined();
  });

  it("gives no power when the Seer loses the trick", () => {
    const game = lastTrick([card("Red", 10), card("Red", 12), card("Red", 2)]);
    service.resolveTrick(game);
    expect(game.currentTrick.winnerUsername).toBe("bob");
    expect(game.currentTrick.power).toBeUndefined();
  });

  it("holds the trick until the power is used", () => {
    const game = lastTrick([card("Red", 10), card("Red", 3), card("Red", 2)]);
    service.resolveTrick(game);

    expect(service.hasPendingPower(game)).toBe(true);
    expect(() => service.advanceAfterTrick(game)).toThrow();

    service.beginPower(game);
    expect(game.phase).toBe("power");
  });

  it("lets a Seer change its owner's prediction by one", () => {
    const game = lastTrick([card("Red", 10), card("Red", 3), card("Red", 2)]);
    service.resolveTrick(game);
    service.beginPower(game);

    service.usePower(game, "alice", { prediction: 2 });

    expect(game.players[0]!.prediction).toBe(2);
    expect(game.currentTrick.power).toMatchObject({ resolved: true, target: "alice", from: 1, to: 2 });
    expect(game.phase).toBe("playing");
    expect(service.hasPendingPower(game)).toBe(false);
  });

  it("changes nothing, and names no target, when the number stays", () => {
    const game = lastTrick([card("Red", 10), card("Red", 3), card("Red", 2)]);
    service.resolveTrick(game);
    service.beginPower(game);

    service.usePower(game, "alice", { prediction: 1 });

    expect(game.players[0]!.prediction).toBe(1);
    expect(game.currentTrick.power).toMatchObject({ resolved: true, target: null, from: null, to: null });
  });

  it("lets a Trickster change an opponent's prediction, never its owner's", () => {
    const game = lastTrick([card("Blue", 2), card("Blue", 9), card("Blue", 1)]);
    service.resolveTrick(game);
    service.beginPower(game);

    expect(() => service.usePower(game, "bob", { target: "bob", prediction: 1 })).toThrow();
    expect(() => service.usePower(game, "bob", { prediction: 1 })).toThrow();

    service.usePower(game, "bob", { target: "carol", prediction: 1 });

    expect(game.players[2]!.prediction).toBe(1);
    expect(game.currentTrick.power).toMatchObject({ target: "carol", from: 0, to: 1 });
  });

  it("keeps the new prediction within one step and within the round", () => {
    const game = lastTrick([card("Blue", 2), card("Blue", 9), card("Blue", 1)]);
    service.resolveTrick(game);
    service.beginPower(game);

    // carol predicted 0: -1 is out of range, +2 is too far.
    expect(() => service.usePower(game, "bob", { target: "carol", prediction: -1 })).toThrow();
    expect(() => service.usePower(game, "bob", { target: "carol", prediction: 2 })).toThrow();

    // alice predicted 1 of 3 tricks: 4 is above the round.
    game.players[0]!.prediction = 3;
    expect(() => service.usePower(game, "bob", { target: "alice", prediction: 4 })).toThrow();
  });

  it("only lets the winner use the power, and only while it is waiting", () => {
    const game = lastTrick([card("Red", 10), card("Red", 3), card("Red", 2)]);
    service.resolveTrick(game);

    // Not yet begun.
    expect(() => service.usePower(game, "alice", { prediction: 2 })).toThrow();

    service.beginPower(game);
    expect(() => service.usePower(game, "bob", { prediction: 2 })).toThrow();

    service.skipPower(game, "alice");
    expect(game.players[0]!.prediction).toBe(1);
    expect(() => service.usePower(game, "alice", { prediction: 2 })).toThrow();
  });

  it("scores the round on the changed prediction", () => {
    const game = lastTrick([card("Red", 10), card("Red", 3), card("Red", 2)]);
    game.players[0]!.tricksWon = 1;
    service.resolveTrick(game); // alice now has 2 tricks, predicted 1
    service.beginPower(game);
    service.usePower(game, "alice", { prediction: 2 });
    service.advanceAfterTrick(game);

    // alice predicted 2 and won 2 in round 3: exact, 2 + 2.
    expect(game.players[0]!.roundScores[0]).toMatchObject({ prediction: 2, tricksWon: 2, score: 4 });
  });
});

describe("bots using the powers", () => {
  const seerGame = () => {
    const game = lastTrick([card("Red", 10), card("Red", 3), card("Red", 2)]);
    service.resolveTrick(game);
    return game;
  };

  it("has a Seer move a prediction that can no longer come true", () => {
    const game = seerGame();
    const alice = game.players[0]!;
    alice.hand = [card("Red", 1)]; // one trick left
    alice.tricksWon = 3; // already past a prediction of 1
    alice.prediction = 1;

    expect(adept.choosePower(game)).toEqual({ target: null, prediction: 2 });
    expect(apprentice.choosePower(game)).toEqual({ target: null, prediction: 2 });
  });

  it("has an adept Seer leave a prediction its cards are sure to make", () => {
    const game = seerGame();
    const alice = game.players[0]!;
    alice.hand = [card("Red", 14)]; // a Wizard: one more trick for certain
    alice.tricksWon = 1;
    alice.prediction = 2;

    expect(adept.choosePower(game).prediction).toBe(2);
  });

  it("has an adept Trickster push a player off a number they could still reach", () => {
    const game = lastTrick([card("Blue", 2), card("Blue", 9), card("Blue", 1)]);
    service.resolveTrick(game);
    // carol has won her 2 and predicted 2 with no tricks left: +1 or -1 both miss.
    game.players[2]!.prediction = 2;
    game.players[2]!.tricksWon = 2;
    game.players[2]!.score = 10; // the leader, so the one to catch
    game.players[1]!.hand = [];
    game.players[0]!.prediction = 0;
    game.players[0]!.tricksWon = 0;

    const choice = adept.choosePower(game);
    expect(choice.target).toBe("carol");
    expect([1, 3]).toContain(choice.prediction);
  });

  it("has an apprentice leave the Trickster alone", () => {
    const game = lastTrick([card("Blue", 2), card("Blue", 9), card("Blue", 1)]);
    service.resolveTrick(game);

    expect(apprentice.choosePower(game).target).toBeNull();
  });
});

describe("the Adept's reasoning about powers", () => {
  const seerGame = () => {
    const game = lastTrick([card("Red", 10), card("Red", 3), card("Red", 2)]);
    service.resolveTrick(game);
    return game;
  };

  it("has a Seer set its prediction to its tricks on the last trick, if within one", () => {
    for (const [prediction, tricksWon, expected] of [
      [1, 2, 2],
      [3, 2, 2],
      [2, 2, 2],
    ] as const) {
      const game = seerGame();
      const alice = game.players[0]!;
      alice.hand = [];
      alice.tricksWon = tricksWon;
      alice.prediction = prediction;

      expect(adept.choosePower(game).prediction).toBe(expected);
    }
  });

  it("has a Seer lower a prediction its hand cannot reach", () => {
    const game = seerGame();
    const alice = game.players[0]!;
    alice.hand = [card("Red", 1)]; // a card that wins nothing
    alice.tricksWon = 1;
    alice.prediction = 2; // would need the last trick as well

    expect(adept.choosePower(game).prediction).toBe(1);
  });

  it("has a Seer raise a prediction its hand will exceed", () => {
    const game = seerGame();
    const alice = game.players[0]!;
    alice.hand = [card("Red", 14), card("Blue", 14)]; // two Wizards: two more tricks
    alice.tricksWon = 1;
    alice.prediction = 2; // 1 + 2 = 3 is where it will end

    expect(adept.choosePower(game).prediction).toBe(3);
  });

  it("has a Trickster knock a hit off its number, the leader first", () => {
    const game = lastTrick([card("Blue", 2), card("Blue", 9), card("Blue", 1)]);
    service.resolveTrick(game); // bob wins with the Trickster
    const [alice, , carol] = game.players;
    for (const player of game.players) player.hand = [];
    alice!.prediction = 1; alice!.tricksWon = 1; alice!.score = 20; // hit, and leading
    carol!.prediction = 2; carol!.tricksWon = 2; carol!.score = 5; // hit too

    const choice = adept.choosePower(game);
    expect(choice.target).toBe("alice");
    expect(Math.abs(choice.prediction - 1)).toBe(1);
  });

  it("has a Trickster pick whoever stands to lose most when nobody leads", () => {
    const game = lastTrick([card("Blue", 2), card("Blue", 9), card("Blue", 1)]);
    service.resolveTrick(game);
    const [alice, , carol] = game.players;
    for (const player of game.players) player.hand = [];
    alice!.prediction = 0; alice!.tricksWon = 0; alice!.score = 0; // hit for 2
    carol!.prediction = 3; carol!.tricksWon = 3; carol!.score = 0; // hit for 5

    expect(adept.choosePower(game).target).toBe("carol");
  });

  it("never helps a player: the nudge always lowers their expected score", () => {
    const game = lastTrick([card("Blue", 2), card("Blue", 9), card("Blue", 1)]);
    service.resolveTrick(game);
    for (const player of game.players) player.hand = [];
    game.players[0]!.prediction = 1; game.players[0]!.tricksWon = 3; // already off
    game.players[2]!.prediction = 2; game.players[2]!.tricksWon = 0; // already off

    const choice = adept.choosePower(game);
    // Moving either one closer to their tricks would help them: it must go away.
    if (choice.target === "alice") expect(choice.prediction).toBe(0);
    if (choice.target === "carol") expect(choice.prediction).toBe(3);
  });

  it("plays a Seer when every card wins and it can raise its bid to match", () => {
    const game = service.createGame(1, ["alice", "Merlin NPC", "Morgana NPC"]);
    game.phase = "playing";
    game.currentRound = 3;
    game.trumpSuit = null;
    game.currentPlayerIndex = 1;
    game.currentTrick.playedCards = [
      { username: "alice", card: card("Red", 3) },
      { username: "Morgana NPC", card: card("Red", 2) },
    ];
    const merlin = game.players[1]!;
    merlin.hand = [card("Red", 5), card("Red", 10)]; // both would win; 10 is the Seer
    merlin.prediction = 1;
    merlin.tricksWon = 1; // already has what it asked for

    const index = adept.chooseCardIndex(game);
    expect(merlin.hand[index]).toEqual(card("Red", 10));
  });
});

describe("Thief", () => {
  // alice wins with the Thief while every player still holds cards.
  function thiefGame(): WizardGameState {
    const game = lastTrick([card("Red", 8), card("Red", 3), card("Red", 2)]);
    game.players[0]!.hand = [card("Blue", 1), card("Blue", 2)];
    game.players[1]!.hand = [card("Green", 5), card("Green", 6)];
    game.players[2]!.hand = [card("Yellow", 7), card("Yellow", 9)];
    service.resolveTrick(game);
    service.beginPower(game);
    return game;
  }

  it("does nothing on the last trick of a round", () => {
    const game = lastTrick([card("Red", 8), card("Red", 3), card("Red", 2)]);
    service.resolveTrick(game);
    expect(game.currentTrick.power).toBeUndefined();
  });

  it("swaps one card of the winner's for one of the target's, where they stand", () => {
    const game = thiefGame();
    service.chooseThiefTarget(game, "alice", "bob");
    expect(game.currentTrick.power?.target).toBe("bob");

    service.stealCard(game, "alice", { ownIndex: 0, targetIndex: 1 });
    expect(game.players[0]!.hand).toEqual([card("Green", 6), card("Blue", 2)]);
    expect(game.players[1]!.hand).toEqual([card("Green", 5), card("Blue", 1)]);
    expect(game.currentTrick.power).toMatchObject({ resolved: true, ownIndex: 0, targetIndex: 1 });
    expect(game.phase).toBe("playing");
  });

  it("refuses yourself, a bad index, and anyone else's turn", () => {
    const game = thiefGame();
    expect(() => service.chooseThiefTarget(game, "alice", "alice")).toThrow();
    expect(() => service.chooseThiefTarget(game, "bob", "carol")).toThrow();
    service.chooseThiefTarget(game, "alice", "carol");
    expect(() => service.stealCard(game, "alice", { ownIndex: 5, targetIndex: 0 })).toThrow();
    expect(() => service.usePower(game, "alice", { prediction: 1 })).toThrow();
  });

  it("can be declined, forgetting the target", () => {
    const game = thiefGame();
    service.chooseThiefTarget(game, "alice", "bob");
    service.skipPower(game, "alice");
    expect(game.currentTrick.power).toMatchObject({ resolved: true, target: null });
    expect(game.players[0]!.hand).toEqual([card("Blue", 1), card("Blue", 2)]);
  });
});
