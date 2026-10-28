import { describe, it, expect } from "vitest";

import type { Card, Suit } from "../../models/card.js";
import type { GamePlayer } from "../../models/wizardGame.js";
import { DEFAULT_GAME_OPTIONS } from "../../gameOptions.js";
import { WizardGameService } from "../../services/wizardGameService.js";
import type { RoleId } from "./roles.js";
import { SEED_POINTS } from "./farmer.js";
import { CATCH_POINTS } from "./fisher.js";
import { SERVANT_BONUS, SERVICE_POINTS } from "./servant.js";
import { SHEEP_POINTS } from "./shepherd.js";
import { BLOCK_POINTS } from "./smith.js";
import { card } from "./roleTestHelpers.js";
import { STEAL_POINTS } from "./thief.js";

// One trick at a table of three, played in seat order with one card each.
function playTrick(
  mode: "classic" | "roles",
  seats: { name: string; card: Card; role?: RoleId; stealSpot?: number }[],
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

  for (const seat of seats) {
    service.playCard(game, 0, false, seat.stealSpot);
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

  it("takes points from the player robbed", () => {
    const { trick, score } = playTrick("roles", seats, (players) => {
      players.find((p) => p.username === "ben")!.score = 50;
    });

    expect(score("thief")).toBe(STEAL_POINTS);
    expect(score("ben")).toBe(50 - STEAL_POINTS);
    expect(trick.roleActions?.[0]?.points).toBe(STEAL_POINTS);
  });

  it("never takes more than the player robbed has, but still steals the card", () => {
    const { trick, score } = playTrick("roles", seats, (players) => {
      players.find((p) => p.username === "ben")!.score = 4;
    });

    expect(trick.winnerUsername).toBe("thief");
    expect(score("thief")).toBe(4);
    expect(score("ben")).toBe(0);
  });

  it("takes the card of their choice with a trump 1", () => {
    const { trick, score } = playTrick(
      "roles",
      [
        { name: "ana", card: card(13) },
        { name: "ben", card: card(8) },
        { name: "thief", card: card(1, "Blue"), role: "thief", stealSpot: 0 },
      ],
      (players) => {
        players.find((p) => p.username === "ana")!.score = 50;
      },
      "Blue",
    );

    // The 13 is the Thief's, but the trump 1 now ana's wins the trick.
    expect(trick.roleActions?.[0]).toMatchObject({ role: "thief", on: "ana", card: card(13) });
    expect(trick.winnerUsername).toBe("ana");
    expect(score("thief")).toBe(STEAL_POINTS);
    expect(score("ana")).toBe(50 - STEAL_POINTS);
  });

  it("takes the points even when someone else wins the trick", () => {
    const { trick, score } = playTrick(
      "roles",
      [
        { name: "ana", card: card(8) },
        { name: "ben", card: card(7) },
        { name: "thief", card: card(1), role: "thief" },
        { name: "cara", card: card(13) },
      ],
      (players) => {
        players.find((p) => p.username === "ben")!.score = 50;
      },
    );

    expect(trick.roleActions?.[0]).toMatchObject({ role: "thief", on: "ben" });
    expect(trick.winnerUsername).toBe("cara");
    expect(score("thief")).toBe(STEAL_POINTS);
    expect(score("ben")).toBe(50 - STEAL_POINTS);
  });

  it("is an ordinary 1 in a Classic game", () => {
    const { trick } = playTrick("classic", seats);

    expect(trick.winnerUsername).toBe("ben");
    expect(trick.roleActions).toBeUndefined();
  });
});

describe("the Servant in a game", () => {
  it("receives the 13, wins the trick and is tipped by the player served", () => {
    const { trick, score } = playTrick(
      "roles",
      [
        { name: "ana", card: card(8) },
        { name: "serv", card: card(2), role: "servant" },
        { name: "ben", card: card(13) },
      ],
      (players) => {
        players.find((p) => p.username === "ben")!.score = 50;
      },
    );

    expect(trick.winnerUsername).toBe("serv");
    expect(score("serv")).toBe(SERVICE_POINTS + SERVANT_BONUS);
    expect(score("ben")).toBe(50 - SERVICE_POINTS - SERVANT_BONUS);
  });

  it("is tipped for the service even when someone else wins the trick", () => {
    const { trick, score } = playTrick(
      "roles",
      [
        { name: "ana", card: card(13) },
        { name: "serv", card: card(2), role: "servant" },
        { name: "ben", card: card(5) },
      ],
      (players) => {
        players.find((p) => p.username === "ben")!.score = 50;
      },
    );

    expect(trick.winnerUsername).toBe("ana");
    expect(score("serv")).toBe(SERVICE_POINTS);
    expect(score("ben")).toBe(50 - SERVICE_POINTS);
  });

  it("is tipped no more than the player served has", () => {
    const { score } = playTrick("roles", [
      { name: "ana", card: card(8) },
      { name: "serv", card: card(2), role: "servant" },
      { name: "ben", card: card(13) },
    ]);

    expect(score("serv")).toBe(0);
    expect(score("ben")).toBe(0);
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

  it("takes points from the player fished when the catch wins the trick", () => {
    const { game, service, score } = playTrick("roles", seats, (players) => {
      players.find((p) => p.username === "ben")!.score = 50;
    });

    service.fishCard(game, "fisher", 2);

    expect(score("fisher")).toBe(CATCH_POINTS);
    expect(score("ben")).toBe(50 - CATCH_POINTS);
  });

  it("takes nothing for a catch that does not win the trick", () => {
    const { game, service, score } = playTrick(
      "roles",
      [
        { name: "ana", card: card(8) },
        { name: "fisher", card: card(3), role: "fisher" },
        { name: "ben", card: card(5) },
        { name: "cara", card: card(13) },
      ],
      (players) => {
        players.find((p) => p.username === "ben")!.score = 50;
      },
    );

    service.fishCard(game, "fisher", 2);

    expect(game.currentTrick.winnerUsername).toBe("cara");
    expect(score("fisher")).toBe(0);
    expect(score("ben")).toBe(50);
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

  // The Farmer, seat 1, played their 4 into a trick ben won; then the round
  // is scored, with each player's prediction set beforehand.
  const farmRound = (predictions: Record<string, number>, scores: Record<string, number>, seeds: Record<string, number>) =>
    playTrick(
      "roles",
      [
        { name: "ana", card: card(8) },
        { name: "farmer", card: card(4), role: "farmer" },
        { name: "ben", card: card(13) },
      ],
      (players) => {
        for (const player of players) {
          player.prediction = predictions[player.username] ?? 0;
          player.score = scores[player.username] ?? 0;
          if (seeds[player.username]) player.seeds = { farmer: seeds[player.username]! };
        }
      },
    );

  it("does not harvest when a trick is won", () => {
    const { game, score } = playTrick(
      "roles",
      [
        { name: "farmer", card: card(13), role: "farmer" },
        { name: "ana", card: card(8) },
        { name: "ben", card: card(5) },
      ],
      (players) => {
        players.find((p) => p.username === "ana")!.seeds = { farmer: 2 };
        players.find((p) => p.username === "ana")!.score = 50;
      },
    );

    expect(score("farmer")).toBe(0);
    expect(game.players.find((p) => p.username === "ana")?.seeds).toEqual({ farmer: 2 });
  });

  it("harvests every seed once the round is scored, when the Farmer made the prediction", () => {
    const { game, service, score } = farmRound({ farmer: 0, ana: 0, ben: 1 }, { ana: 50, ben: 0 }, { ana: 2, ben: 1 });

    service.finishRound(game);

    // ana: 50 + 20 for the round, less 2 seeds; ben: 0 + 30 for the round,
    // less 2 seeds, as he took a new one in the trick.
    expect(score("farmer")).toBe(20 + 4 * SEED_POINTS);
    expect(score("ana")).toBe(70 - 2 * SEED_POINTS);
    expect(score("ben")).toBe(30 - 2 * SEED_POINTS);
    expect(game.players.every((p) => !p.seeds?.farmer)).toBe(true);
    expect(game.players.find((p) => p.username === "farmer")?.roundScores.at(-1)?.roleBonuses).toEqual({ farmer: 4 * SEED_POINTS });
    expect(game.players.find((p) => p.username === "ana")?.roundScores.at(-1)?.roleBonuses).toEqual({ farmer: -2 * SEED_POINTS });
  });

  it("harvests nothing when the Farmer missed, and the seeds wait", () => {
    const { game, service, score } = farmRound({ farmer: 1, ana: 0, ben: 1 }, { ana: 50 }, { ana: 2 });

    service.finishRound(game);

    expect(score("farmer")).toBe(-10);
    expect(score("ana")).toBe(70);
    expect(game.players.find((p) => p.username === "ana")?.seeds).toEqual({ farmer: 2 });
  });

  it("never harvests more than the holder has, counting this round's points", () => {
    const { game, service, score } = farmRound({ farmer: 0, ana: 1, ben: 1 }, { ana: 5 }, { ana: 4 });

    service.finishRound(game);

    // ana missed: 5 - 10 = -5, so nothing to harvest; the seeds are gone.
    // ben's seed from the trick brings the Farmer one seed's points.
    expect(score("farmer")).toBe(20 + SEED_POINTS);
    expect(score("ana")).toBe(-5);
    expect(score("ben")).toBe(30 - SEED_POINTS);
    expect(game.players.find((p) => p.username === "ana")?.seeds).toEqual({});
  });
});

describe("the Shepherd in a game", () => {
  it("gives a sheep to the trick's winner", () => {
    const { game, trick } = playTrick("roles", [
      { name: "ana", card: card(8) },
      { name: "shepherd", card: card(5), role: "shepherd" },
      { name: "ben", card: card(13) },
    ]);

    expect(game.players.find((p) => p.username === "ben")?.sheep).toEqual({ shepherd: 1 });
    expect(trick.roleActions?.[0]).toMatchObject({ role: "shepherd", by: "shepherd", on: "ben" });
  });

  it("is paid only when winning with the 5, and gives no sheep then", () => {
    const { game, trick, score } = playTrick(
      "roles",
      [
        { name: "ana", card: card(3) },
        { name: "shepherd", card: card(5), role: "shepherd" },
        { name: "ben", card: card(2) },
      ],
      (players) => {
        players.find((p) => p.username === "ana")!.sheep = { shepherd: 2 };
        players.find((p) => p.username === "ana")!.score = 100;
        players.find((p) => p.username === "ben")!.sheep = { shepherd: 1 };
        players.find((p) => p.username === "ben")!.score = 10;
      },
    );

    // ben has only 10 to give for his sheep.
    expect(trick.winnerUsername).toBe("shepherd");
    expect(score("shepherd")).toBe(2 * SHEEP_POINTS + 10);
    expect(score("ana")).toBe(100 - 2 * SHEEP_POINTS);
    expect(score("ben")).toBe(0);
    expect(game.players.every((p) => !p.sheep?.shepherd)).toBe(true);
    expect(trick.roleActions?.map((a) => a.points)).toEqual([2 * SHEEP_POINTS, 10]);
  });

  it("is not paid for winning with another card", () => {
    const { game, score } = playTrick(
      "roles",
      [
        { name: "shepherd", card: card(13), role: "shepherd" },
        { name: "ana", card: card(8) },
        { name: "ben", card: card(2) },
      ],
      (players) => {
        players.find((p) => p.username === "ana")!.sheep = { shepherd: 1 };
        players.find((p) => p.username === "ana")!.score = 50;
      },
    );

    expect(score("shepherd")).toBe(0);
    expect(game.players.find((p) => p.username === "ana")?.sheep).toEqual({ shepherd: 1 });
  });

  it("a Shepherd winning another Shepherd's 5 takes a sheep like anyone", () => {
    const { game } = playTrick("roles", [
      { name: "shepherd2", card: card(5), role: "shepherd" },
      { name: "shepherd", card: card(13), role: "shepherd" },
      { name: "ben", card: card(2) },
    ]);

    expect(game.players.find((p) => p.username === "shepherd")?.sheep).toEqual({ shepherd2: 1 });
  });
});

describe("the Smith in a game", () => {
  const find = (game: { players: GamePlayer[] }, name: string) => game.players.find((p) => p.username === name)!;

  it("forges armour with a 6 in the lead suit", () => {
    const { game, trick } = playTrick("roles", [
      { name: "ana", card: card(8) },
      { name: "smith", card: card(6), role: "smith" },
      { name: "ben", card: card(13) },
    ]);

    expect(find(game, "smith").armor).toBe(1);
    expect(trick.roleActions?.[0]).toMatchObject({ role: "smith", by: "smith", on: "smith" });
  });

  it("blocks a steal: the card stays, and the Thief pays", () => {
    const { game, trick, score } = playTrick(
      "roles",
      [
        { name: "ana", card: card(8) },
        { name: "smith", card: card(13), role: "smith" },
        { name: "thief", card: card(1), role: "thief" },
      ],
      (players) => {
        players.find((p) => p.username === "smith")!.armor = 1;
        players.find((p) => p.username === "thief")!.score = 50;
      },
    );

    expect(trick.winnerUsername).toBe("smith");
    expect(find(game, "smith").armor).toBe(0);
    expect(score("smith")).toBe(BLOCK_POINTS);
    expect(score("thief")).toBe(50 - BLOCK_POINTS);
    expect(trick.roleActions?.[0]).toMatchObject({ role: "smith", by: "smith", on: "thief", points: BLOCK_POINTS });
  });

  it("blocks a service: the Servant gets nothing and pays", () => {
    const { game, trick, score } = playTrick(
      "roles",
      [
        { name: "ana", card: card(8) },
        { name: "serv", card: card(2), role: "servant" },
        { name: "smith", card: card(13), role: "smith" },
      ],
      (players) => {
        players.find((p) => p.username === "smith")!.armor = 1;
        players.find((p) => p.username === "serv")!.score = 50;
      },
    );

    expect(trick.winnerUsername).toBe("smith");
    expect(find(game, "smith").armor).toBe(0);
    expect(score("serv")).toBe(50 - BLOCK_POINTS);
  });

  it("blocks a catch, and the Fisher's turn is used all the same", () => {
    const { game, service, score } = playTrick(
      "roles",
      [
        { name: "ana", card: card(8) },
        { name: "fisher", card: card(3), role: "fisher" },
        { name: "smith", card: card(13), role: "smith" },
      ],
      (players) => {
        players.find((p) => p.username === "smith")!.armor = 1;
        players.find((p) => p.username === "fisher")!.score = 50;
      },
    );

    service.fishCard(game, "fisher", 2);

    expect(game.phase).toBe("playing");
    expect(game.currentTrick.winnerUsername).toBe("smith");
    expect(score("fisher")).toBe(50 - BLOCK_POINTS);
  });

  it("blocks one sheep per piece of armour", () => {
    const { game, score } = playTrick(
      "roles",
      [
        { name: "ana", card: card(3) },
        { name: "shepherd", card: card(5), role: "shepherd" },
        { name: "smith", card: card(2), role: "smith" },
      ],
      (players) => {
        Object.assign(players.find((p) => p.username === "smith")!, { armor: 1, score: 100, sheep: { shepherd: 2 } });
        players.find((p) => p.username === "shepherd")!.score = 50;
      },
    );

    expect(score("smith")).toBe(100 - SHEEP_POINTS + BLOCK_POINTS);
    expect(score("shepherd")).toBe(50 + SHEEP_POINTS - BLOCK_POINTS);
    expect(find(game, "smith").armor).toBe(0);
  });

  it("blocks one seed per piece of armour at the harvest", () => {
    const { game, service, score } = playTrick(
      "roles",
      [
        { name: "farmer", card: card(13), role: "farmer" },
        { name: "smith", card: card(8), role: "smith" },
        { name: "ben", card: card(5) },
      ],
      (players) => {
        for (const player of players) player.prediction = player.username === "farmer" ? 1 : 0;
        Object.assign(players.find((p) => p.username === "smith")!, { armor: 1, score: 100, seeds: { farmer: 3 } });
      },
    );

    service.finishRound(game);

    // farmer: 30 for the round, 2 seeds harvested, 1 blocked; smith: 100 + 20.
    expect(score("farmer")).toBe(30 + 2 * SEED_POINTS - BLOCK_POINTS);
    expect(score("smith")).toBe(120 - 2 * SEED_POINTS + BLOCK_POINTS);
    expect(find(game, "smith").armor).toBe(0);
  });
});
