import { describe, it, expect } from "vitest";

import type { Card, Suit } from "../../models/card.js";
import type { GamePlayer } from "../../models/wizardGame.js";
import { DEFAULT_GAME_OPTIONS } from "../../gameOptions.js";
import { WizardGameService } from "../../services/wizardGameService.js";
import type { RoleId } from "./roles.js";
import { card } from "./roleTestHelpers.js";

// One trick at a table of three, played in seat order with one card each.
function playTrick(
  mode: "classic" | "roles",
  seats: { name: string; card: Card; role?: RoleId }[],
  setUp?: (players: GamePlayer[]) => void,
  trumpSuit: Suit | null = null,
) {
  const service = new WizardGameService();
  const game = service.createGame(1, seats.map((seat) => seat.name), new Map(), 1, 1, {
    ...DEFAULT_GAME_OPTIONS,
    mode,
  });

  game.players = seats.map((seat) => {
    const player = game.players.find((p) => p.username === seat.name);
    if (!player) throw new Error(`no seat for ${seat.name}`);
    player.hand = [seat.card];
    if (seat.role) player.role = seat.role;
    return player;
  });
  setUp?.(game.players);
  game.trumpSuit = trumpSuit;
  game.phase = "playing";
  game.currentPlayerIndex = 0;
  game.currentTrick = { playedCards: [], winnerUsername: null };

  for (const _seat of seats) {
    service.playCard(game, 0);
  }

  const score = (name: string) => game.players.find((p) => p.username === name)?.score;

  return { trick: game.currentTrick, score, game, service };
}

describe("the Thief in a game", () => {
  const seats = [
    { name: "ana", card: card(8) },
    { name: "ben", card: card(13) },
    { name: "thief", card: card(1), role: "thief" as const },
  ];

  it("wins the trick with the stolen 13 in a Roles game", () => {
    const { trick } = playTrick("roles", seats);

    expect(trick.winnerUsername).toBe("thief");
    expect(trick.roleActions?.[0]).toMatchObject({ role: "thief", on: "ben" });
  });

  it("is an ordinary 1 in a Classic game", () => {
    const { trick } = playTrick("classic", seats);

    expect(trick.winnerUsername).toBe("ben");
    expect(trick.roleActions).toBeUndefined();
  });
});

describe("the Servant in a game", () => {
  it("receives the 13, wins the trick and gets 20 points at once", () => {
    const { trick, score } = playTrick("roles", [
      { name: "ana", card: card(8) },
      { name: "serv", card: card(2), role: "servant" },
      { name: "ben", card: card(13) },
    ]);

    expect(trick.winnerUsername).toBe("serv");
    expect(score("serv")).toBe(20);
  });

  it("gets no bonus for a trick someone else wins", () => {
    const { trick, score } = playTrick("roles", [
      { name: "ana", card: card(13) },
      { name: "serv", card: card(2), role: "servant" },
      { name: "ben", card: card(5) },
    ]);

    expect(trick.winnerUsername).toBe("ana");
    expect(score("serv")).toBe(0);
  });

  it("meets the Thief and nothing happens", () => {
    const { trick } = playTrick("roles", [
      { name: "ana", card: card(8) },
      { name: "serv", card: card(2), role: "servant" },
      { name: "thief", card: card(1), role: "thief" },
    ]);

    expect(trick.roleActions).toBeUndefined();
    expect(trick.playedCards.map((played) => played.username)).toEqual(["ana", "serv", "thief"]);
    expect(trick.winnerUsername).toBe("ana");
  });
});

describe("the Fisher in a game", () => {
  const seats = [
    { name: "ana", card: card(8) },
    { name: "fisher", card: card(3), role: "fisher" as const },
    { name: "ben", card: card(13) },
  ];

  it("waits for the Fisher before the trick is won", () => {
    const { game } = playTrick("roles", seats);

    expect(game.phase).toBe("fishing");
    expect(game.players[game.currentPlayerIndex]?.username).toBe("fisher");
    expect(game.currentTrick.winnerUsername).toBeNull();
  });

  it("wins the trick with the fished 13", () => {
    const { game, service } = playTrick("roles", seats);

    service.fishCard(game, "fisher", 2);

    expect(game.phase).toBe("playing");
    expect(game.currentTrick.winnerUsername).toBe("fisher");
    expect(game.currentTrick.roleActions?.[0]).toMatchObject({ role: "fisher", on: "ben" });
  });

  it("refuses a card that cannot be fished, and anyone else's choice", () => {
    const { game, service } = playTrick("roles", seats);

    expect(() => service.fishCard(game, "fisher", 0)).toThrow();
    expect(() => service.fishCard(game, "ben", 2)).toThrow();
  });

  it("is an ordinary 3 in a Classic game", () => {
    const { game } = playTrick("classic", seats);

    expect(game.phase).toBe("playing");
    expect(game.currentTrick.winnerUsername).toBe("ben");
  });

  it("keeps the power when a Thief steals the 3, and fishes with the 1", () => {
    const { game, service } = playTrick("roles", [
      { name: "ana", card: card(8) },
      { name: "fisher", card: card(3), role: "fisher" },
      { name: "thief", card: card(1), role: "thief" },
      { name: "ben", card: card(13) },
    ]);

    expect(game.currentTrick.roleActions?.[0]).toMatchObject({ role: "thief", on: "fisher" });
    expect(game.players[game.currentPlayerIndex]?.username).toBe("fisher");

    service.fishCard(game, "fisher", 3);

    expect(game.currentTrick.winnerUsername).toBe("fisher");
    expect(game.currentTrick.playedCards[3]?.username).toBe("fisher");
    expect(game.currentTrick.playedCards[2]?.username).toBe("ben");
  });
});

describe("the Farmer in a game", () => {
  it("plants a seed for the trick's winner", () => {
    const { game, trick } = playTrick("roles", [
      { name: "ana", card: card(8) },
      { name: "farmer", card: card(4), role: "farmer" },
      { name: "ben", card: card(13) },
    ]);

    expect(game.players.find((p) => p.username === "ben")?.seeds).toEqual({ farmer: 1 });
    expect(trick.roleActions?.[0]).toMatchObject({ role: "farmer", by: "farmer", on: "ben" });
  });

  it("is an ordinary 4 in a Classic game", () => {
    const { game } = playTrick("classic", [
      { name: "ana", card: card(8) },
      { name: "farmer", card: card(4), role: "farmer" },
      { name: "ben", card: card(13) },
    ]);

    expect(game.players.find((p) => p.username === "ben")?.seeds).toBeUndefined();
  });

  it("harvests when the Farmer wins a trick, own 4 or not, and plants nothing", () => {
    const { game, trick, score } = playTrick(
      "roles",
      [
        { name: "ana", card: card(8) },
        { name: "farmer", card: card(4, "Blue"), role: "farmer" },
        { name: "ben", card: card(13) },
      ],
      (players) => {
        players.find((p) => p.username === "ana")!.seeds = { farmer: 2 };
        players.find((p) => p.username === "ana")!.score = 50;
        players.find((p) => p.username === "ben")!.seeds = { farmer: 1 };
        players.find((p) => p.username === "ben")!.score = 10;
      },
      "Blue",
    );

    expect(trick.winnerUsername).toBe("farmer");
    expect(score("farmer")).toBe(30);
    expect(score("ana")).toBe(30);
    expect(score("ben")).toBe(0);
    expect(game.players.every((p) => !p.seeds?.farmer)).toBe(true);
    expect(trick.roleActions?.map((a) => a.points)).toEqual([20, 10]);
  });

  it("farms nothing from a holder at 0 points, but the seeds are gone", () => {
    const { game, trick, score } = playTrick(
      "roles",
      [
        { name: "farmer", card: card(13), role: "farmer" },
        { name: "ana", card: card(8) },
        { name: "ben", card: card(5) },
      ],
      (players) => {
        players.find((p) => p.username === "ana")!.seeds = { farmer: 2 };
      },
    );

    expect(score("farmer")).toBe(0);
    expect(score("ana")).toBe(0);
    expect(game.players.find((p) => p.username === "ana")?.seeds).toEqual({});
    expect(trick.roleActions?.[0]).toMatchObject({ role: "farmer", on: "ana", points: 0 });
  });

  it("a Farmer winning another Farmer's 4 harvests first, then takes the seed", () => {
    const { game, score } = playTrick(
      "roles",
      [
        { name: "farmer2", card: card(4), role: "farmer" },
        { name: "farmer", card: card(13), role: "farmer" },
        { name: "ben", card: card(5) },
      ],
      (players) => {
        players.find((p) => p.username === "ben")!.seeds = { farmer: 1 };
        players.find((p) => p.username === "ben")!.score = 40;
      },
    );

    expect(score("farmer")).toBe(10);
    expect(game.players.find((p) => p.username === "farmer")?.seeds).toEqual({ farmer2: 1 });
  });
});
