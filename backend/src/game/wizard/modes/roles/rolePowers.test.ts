import { describe, it, expect } from "vitest";

import type { Card, Suit } from "../../models/card.js";
import type { GamePlayer, WizardGameState } from "../../models/wizardGame.js";
import { DEFAULT_GAME_OPTIONS } from "../../gameOptions.js";
import { WizardGameService } from "../../services/wizardGameService.js";
import type { RoleId } from "./roles.js";
import { SEED_POINTS } from "./farmer.js";
import { CATCH_POINTS, MISS_POINTS } from "./fisher.js";
import { MARKET_POINTS } from "./merchant.js";
import { ALMS_POINTS, FAITH_POINTS } from "./priest.js";
import { PRIDE_POINTS, VICTORY_POINTS } from "./warrior.js";
import { BET_LOSS_POINTS, BET_WIN_POINTS, LUCKY_POINTS } from "./gambler.js";
import { GRANT_POINTS, KEEP_POINTS } from "./duke.js";
import { FORESIGHT_POINTS } from "./prophet.js";
import { PEACE_POINTS, TAX_POINTS } from "./king.js";
import { botGrantTo, rolesOf } from "./rolePowers.js";
import { kingHumbledAt, kingsPeace } from "./rolePlay.js";
import { trickRolesIn } from "./master/trickRoles.js";
import { playsFreeIn } from "./master/joker.js";
import { WizardRules } from "../../services/wizardRules.js";
import { SERVANT_BONUS, SERVICE_POINTS } from "./servant.js";
import { SHEEP_POINTS } from "./shepherd.js";
import { BLOCK_POINTS } from "./smith.js";
import { card } from "./roleTestHelpers.js";
import { STEAL_POINTS } from "./thief.js";

// One trick at a table of three, played in seat order with one card each.
function playTrick(
  mode: "classic" | "roles",
  seats: { name: string; card: Card; role?: RoleId; stealSpot?: number; bet?: boolean }[],
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
    service.playCard(game, 0, false, seat.stealSpot, seat.bet);
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

describe("the Thief off suit", () => {
  it("steals the card just before, but takes no points", () => {
    const { trick, score } = playTrick(
      "roles",
      [
        { name: "ana", card: card(8) },
        { name: "ben", card: card(13) },
        { name: "thief", card: card(1, "Green"), role: "thief" },
      ],
      (players) => {
        players.find((p) => p.username === "ben")!.score = 50;
      },
      "Blue",
    );

    expect(trick.winnerUsername).toBe("thief");
    expect(trick.roleActions?.[0]).toMatchObject({ role: "thief", on: "ben", points: 0, offSuit: true });
    expect(score("thief")).toBe(0);
    expect(score("ben")).toBe(50);
  });
});

describe("the Servant off suit", () => {
  it("receives the next card with no service points, but is tipped for winning", () => {
    const { trick, score } = playTrick(
      "roles",
      [
        { name: "ana", card: card(8) },
        { name: "serv", card: card(2, "Green"), role: "servant" },
        { name: "ben", card: card(13) },
      ],
      (players) => {
        players.find((p) => p.username === "ben")!.score = 50;
      },
      "Blue",
    );

    expect(trick.winnerUsername).toBe("serv");
    expect(trick.roleActions?.[0]).toMatchObject({ role: "servant", on: "ben", points: 0, offSuit: true });
    expect(score("serv")).toBe(SERVANT_BONUS);
    expect(score("ben")).toBe(50 - SERVANT_BONUS);
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

  it("is paid for a catch even when it does not win the trick", () => {
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
    expect(score("fisher")).toBe(MISS_POINTS);
    expect(score("ben")).toBe(50 - MISS_POINTS);
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

  it("plants two seeds with a trump 4", () => {
    const { game, trick } = playTrick(
      "roles",
      [
        { name: "ana", card: card(8) },
        { name: "farmer", card: card(4, "Blue"), role: "farmer" },
        { name: "ben", card: card(13, "Blue") },
      ],
      undefined,
      "Blue",
    );

    expect(game.players.find((p) => p.username === "ben")?.seeds).toEqual({ farmer: 2 });
    expect(trick.roleActions?.[0]).toMatchObject({ role: "farmer", on: "ben", seeds: 2 });
  });

  it("plants only as many seeds of a trump 4 as the winner has room for", () => {
    const { game, trick } = playTrick(
      "roles",
      [
        { name: "ana", card: card(8) },
        { name: "farmer", card: card(4, "Blue"), role: "farmer" },
        { name: "ben", card: card(13, "Blue") },
      ],
      (players) => {
        players.find((p) => p.username === "ben")!.seeds = { other: 3 };
      },
      "Blue",
    );

    expect(game.players.find((p) => p.username === "ben")?.seeds).toEqual({ other: 3, farmer: 1 });
    expect(trick.roleActions?.[0]?.seeds).toBeUndefined();
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

describe("the Shepherd's boosted 5", () => {
  const withSheep = (count: number) => (players: GamePlayer[]) => {
    const ana = players.find((p) => p.username === "ana")!;
    ana.sheep = { shepherd: count };
    ana.score = 100;
  };

  it("counts 1 higher per sheep out and wins a tie: with 2 out it beats a 7", () => {
    const { trick, score } = playTrick(
      "roles",
      [
        { name: "ana", card: card(7) },
        { name: "shepherd", card: card(5), role: "shepherd" },
        { name: "ben", card: card(3) },
      ],
      withSheep(2),
    );

    expect(trick.winnerUsername).toBe("shepherd");
    expect(score("shepherd")).toBe(2 * SHEEP_POINTS);
  });

  it("still loses to a higher card, and the winner takes a sheep", () => {
    const { game, trick } = playTrick(
      "roles",
      [
        { name: "ana", card: card(8) },
        { name: "shepherd", card: card(5), role: "shepherd" },
        { name: "ben", card: card(3) },
      ],
      withSheep(2),
    );

    expect(trick.winnerUsername).toBe("ana");
    expect(game.players.find((p) => p.username === "ana")?.sheep).toEqual({ shepherd: 3 });
  });

  it("is a plain 5 with no sheep out", () => {
    const { trick } = playTrick("roles", [
      { name: "ana", card: card(5, "Green") },
      { name: "shepherd", card: card(5, "Green"), role: "shepherd" },
      { name: "ben", card: card(3) },
    ]);

    expect(trick.winnerUsername).toBe("ana");
  });

  it("goes no higher than +3", () => {
    const rolesFor = trickRolesIn({
      options: { mode: "roles" },
      players: [
        { username: "shepherd", role: "shepherd" },
        { username: "ana", sheep: { shepherd: 5 } },
      ],
    });

    expect(rolesFor?.boostOf?.({ username: "shepherd", card: card(5) })).toBe(3);
  });

  it("is a plain 5 once someone else took it", () => {
    const rolesFor = trickRolesIn({
      options: { mode: "roles" },
      players: [
        { username: "shepherd", role: "shepherd" },
        { username: "thief", role: "thief", sheep: { shepherd: 2 } },
      ],
    });

    expect(rolesFor?.boostOf?.({ username: "thief", playedBy: "shepherd", card: card(5) })).toBe(0);
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

describe("the Merchant in a game", () => {
  const find = (game: { players: GamePlayer[] }, name: string) => game.players.find((p) => p.username === name)!;
  const startAt = (points: number) => (players: GamePlayer[]) => {
    for (const player of players) player.score = points;
  };

  it("is paid by every card of 7 or lower and pays every card above it", () => {
    const { trick, score } = playTrick(
      "roles",
      [
        { name: "ana", card: card(3) },
        { name: "ben", card: card(4) },
        { name: "merchant", card: card(7), role: "merchant" },
        { name: "cid", card: card(10) },
      ],
      startAt(50),
    );

    expect(trick.winnerUsername).toBe("cid");
    expect(score("merchant")).toBe(50 + MARKET_POINTS);
    expect(score("ana")).toBe(50 - MARKET_POINTS);
    expect(score("ben")).toBe(50 - MARKET_POINTS);
    expect(score("cid")).toBe(50 + MARKET_POINTS);
    expect(trick.roleActions?.[0]).toMatchObject({
      role: "merchant",
      by: "merchant",
      points: MARKET_POINTS,
      trades: [
        { player: "ana", points: MARKET_POINTS },
        { player: "ben", points: MARKET_POINTS },
        { player: "cid", points: -MARKET_POINTS },
      ],
    });
  });

  it("opens a market with a trump 7, and none with a 7 off the lead suit", () => {
    const trump = playTrick(
      "roles",
      [
        { name: "ana", card: card(3) },
        { name: "merchant", card: card(7, "Blue"), role: "merchant" },
        { name: "ben", card: card(2) },
      ],
      startAt(50),
      "Blue",
    );
    expect(trump.score("merchant")).toBe(50 + 2 * MARKET_POINTS);

    const offSuit = playTrick(
      "roles",
      [
        { name: "ana", card: card(3) },
        { name: "merchant", card: card(7, "Blue"), role: "merchant" },
        { name: "ben", card: card(2) },
      ],
      startAt(50),
    );
    expect(offSuit.score("merchant")).toBe(50);
    expect(offSuit.trick.roleActions ?? []).toEqual([]);
  });

  it("leaves Wizards and Jesters out, and pays even below 0", () => {
    const { score } = playTrick("roles", [
      { name: "ana", card: card(9) },
      { name: "merchant", card: card(7), role: "merchant" },
      { name: "ben", card: card(0) },
      { name: "cid", card: card(14) },
    ]);

    expect(score("merchant")).toBe(-MARKET_POINTS);
    expect(score("ana")).toBe(MARKET_POINTS);
    expect(score("ben")).toBe(0);
    expect(score("cid")).toBe(0);
  });

  it("takes nothing from a player at 0", () => {
    const { score, trick } = playTrick("roles", [
      { name: "ana", card: card(3) },
      { name: "merchant", card: card(7), role: "merchant" },
      { name: "ben", card: card(2) },
    ]);

    expect(score("merchant")).toBe(0);
    expect(score("ana")).toBe(0);
    expect(trick.roleActions?.[0]?.points).toBe(0);
  });

  it("still trades at 7 when a Thief took it", () => {
    const { score } = playTrick(
      "roles",
      [
        { name: "ana", card: card(3) },
        { name: "merchant", card: card(7), role: "merchant" },
        { name: "thief", card: card(1), role: "thief" },
        { name: "ben", card: card(9) },
      ],
      startAt(50),
    );

    // The 3 and the Thief's 1 pay, the 9 is paid: the market is at 7.
    expect(score("merchant")).toBe(50 - STEAL_POINTS + MARKET_POINTS);
    expect(score("thief")).toBe(50 + STEAL_POINTS - MARKET_POINTS);
    expect(score("ana")).toBe(50 - MARKET_POINTS);
    expect(score("ben")).toBe(50 + MARKET_POINTS);
  });

  it("a Smith in armour who would pay uses up a piece, and the Merchant pays for the block", () => {
    const { game, trick, score } = playTrick(
      "roles",
      [
        { name: "smith", card: card(3), role: "smith" },
        { name: "merchant", card: card(7), role: "merchant" },
        { name: "ben", card: card(2) },
      ],
      (players) => {
        startAt(50)(players);
        find({ players }, "smith").armor = 1;
      },
    );

    expect(find(game, "smith").armor).toBe(0);
    expect(score("smith")).toBe(50 + BLOCK_POINTS);
    expect(score("merchant")).toBe(50 + MARKET_POINTS - BLOCK_POINTS);
    expect(trick.roleActions?.at(-1)).toMatchObject({ role: "smith", by: "smith", on: "merchant", points: BLOCK_POINTS });
  });

  it("a Smith who beats the 7 is paid and keeps his armour", () => {
    const { game, score } = playTrick(
      "roles",
      [
        { name: "merchant", card: card(7), role: "merchant" },
        { name: "smith", card: card(12), role: "smith" },
        { name: "ben", card: card(2) },
      ],
      (players) => {
        startAt(50)(players);
        find({ players }, "smith").armor = 1;
      },
    );

    expect(find(game, "smith").armor).toBe(1);
    expect(score("smith")).toBe(50 + MARKET_POINTS);
  });

  it("two Merchants: each 7 pays the other's market", () => {
    const { score } = playTrick(
      "roles",
      [
        { name: "first", card: card(7), role: "merchant" },
        { name: "second", card: card(7, "Blue"), role: "merchant" },
        { name: "ben", card: card(9, "Green") },
      ],
      startAt(50),
      "Blue",
    );

    // Each 7 pays the other, and both Merchants pay ben's 9.
    expect(score("first")).toBe(50 - MARKET_POINTS);
    expect(score("second")).toBe(50 - MARKET_POINTS);
    expect(score("ben")).toBe(50 + 2 * MARKET_POINTS);
  });

  it("keeps the market open after an Air turn, trading by number", () => {
    const { trick, score } = playTrick(
      "roles",
      [
        { name: "merchant", card: card(7), role: "merchant" },
        { name: "air", card: card(9, "Yellow") },
        { name: "ben", card: card(3) },
      ],
      (players) => {
        startAt(50)(players);
        find({ players }, "air").masterRole = "yellowWizard";
      },
    );

    expect(trick.winnerUsername).toBe("air");
    // The Air turn takes 5 from the Merchant who led; the 9 is paid, the 3 pays.
    expect(score("merchant")).toBe(50 - 5 - MARKET_POINTS + MARKET_POINTS);
    expect(score("air")).toBe(50 + 5 + MARKET_POINTS);
    expect(score("ben")).toBe(50 - MARKET_POINTS);
  });
});

describe("the Priest in a game", () => {
  const startAt = (points: number) => (players: GamePlayer[]) => {
    for (const player of players) player.score = points;
  };

  it("is paid faith by every royal card in the trick, trumps and other suits too", () => {
    const { trick, score } = playTrick(
      "roles",
      [
        { name: "ana", card: card(12) },
        { name: "priest", card: card(8), role: "priest" },
        { name: "ben", card: card(11, "Blue") },
        { name: "cid", card: card(13, "Green") },
      ],
      startAt(50),
      "Blue",
    );

    expect(trick.winnerUsername).toBe("ben");
    expect(score("priest")).toBe(50 + 3 * FAITH_POINTS);
    expect(score("ana")).toBe(50 - FAITH_POINTS);
    expect(score("ben")).toBe(50 - FAITH_POINTS);
    expect(score("cid")).toBe(50 - FAITH_POINTS);
    expect(trick.roleActions?.[0]).toMatchObject({
      role: "priest",
      by: "priest",
      points: 3 * FAITH_POINTS,
      trades: [
        { player: "ana", points: FAITH_POINTS },
        { player: "ben", points: FAITH_POINTS },
        { player: "cid", points: FAITH_POINTS },
      ],
    });
  });

  it("collects nothing with an 8 off the lead suit and trumps", () => {
    const { trick, score } = playTrick(
      "roles",
      [
        { name: "ana", card: card(12) },
        { name: "priest", card: card(8, "Green"), role: "priest" },
        { name: "ben", card: card(13) },
      ],
      startAt(50),
      "Blue",
    );

    expect(score("priest")).toBe(50);
    expect(trick.roleActions ?? []).toEqual([]);
  });

  it("never takes a player below 0", () => {
    const { score } = playTrick(
      "roles",
      [
        { name: "ana", card: card(12) },
        { name: "priest", card: card(8), role: "priest" },
        { name: "ben", card: card(13) },
      ],
      (players) => {
        startAt(0)(players);
        players.find((p) => p.username === "ben")!.score = 3;
      },
    );

    expect(score("ana")).toBe(0);
    expect(score("ben")).toBe(0);
    expect(score("priest")).toBe(3);
  });

  it("a Smith in armour pays nothing, uses up a piece, and the Priest pays for the block", () => {
    const { score, game } = playTrick(
      "roles",
      [
        { name: "smith", card: card(12), role: "smith" },
        { name: "priest", card: card(8), role: "priest" },
        { name: "ben", card: card(2) },
      ],
      (players) => {
        startAt(50)(players);
        players.find((p) => p.username === "smith")!.armor = 1;
      },
    );

    expect(score("smith")).toBe(50 + BLOCK_POINTS);
    expect(score("priest")).toBe(50 - BLOCK_POINTS);
    expect(game.players.find((p) => p.username === "smith")!.armor).toBe(0);
  });

  it("feeds the poor when the 8 wins, even below 0, and still collects faith", () => {
    const { trick, score } = playTrick(
      "roles",
      [
        { name: "ana", card: card(3) },
        { name: "priest", card: card(8), role: "priest" },
        { name: "ben", card: card(5) },
        { name: "cid", card: card(12, "Green") },
      ],
      startAt(0),
    );

    expect(trick.winnerUsername).toBe("priest");
    expect(score("priest")).toBe(-2 * ALMS_POINTS);
    expect(score("ana")).toBe(ALMS_POINTS);
    expect(score("ben")).toBe(ALMS_POINTS);
    expect(score("cid")).toBe(0);
    expect(trick.roleActions?.[0]).toMatchObject({
      role: "priest",
      points: -2 * ALMS_POINTS,
      trades: [
        { player: "cid", points: 0 },
        { player: "ana", points: -ALMS_POINTS },
        { player: "ben", points: -ALMS_POINTS },
      ],
    });
  });
});

describe("the Warrior in a game", () => {
  const startAt = (points: number) => (players: GamePlayer[]) => {
    for (const player of players) player.score = points;
  };

  it("is paid by everyone when the 9 wins, never below 0", () => {
    const { trick, score } = playTrick(
      "roles",
      [
        { name: "ana", card: card(3) },
        { name: "warrior", card: card(9), role: "warrior" },
        { name: "ben", card: card(7) },
      ],
      (players) => {
        startAt(50)(players);
        players.find((p) => p.username === "ben")!.score = 4;
      },
    );

    expect(trick.winnerUsername).toBe("warrior");
    expect(score("warrior")).toBe(50 + VICTORY_POINTS + 4);
    expect(score("ana")).toBe(50 - VICTORY_POINTS);
    expect(score("ben")).toBe(0);
  });

  it("pays everyone out of pride when the trump 9 loses, even below 0", () => {
    const { trick, score } = playTrick(
      "roles",
      [
        { name: "ana", card: card(3) },
        { name: "warrior", card: card(9, "Blue"), role: "warrior" },
        { name: "ben", card: card(11, "Blue") },
      ],
      startAt(0),
      "Blue",
    );

    expect(trick.winnerUsername).toBe("ben");
    expect(score("warrior")).toBe(-2 * PRIDE_POINTS);
    expect(score("ana")).toBe(PRIDE_POINTS);
    expect(score("ben")).toBe(PRIDE_POINTS);
  });

  it("costs nothing when a 9 in the lead suit loses, or off the lead suit", () => {
    const lost = playTrick(
      "roles",
      [
        { name: "ana", card: card(3) },
        { name: "warrior", card: card(9), role: "warrior" },
        { name: "ben", card: card(12) },
      ],
      startAt(50),
    );
    expect(lost.score("warrior")).toBe(50);

    const offSuit = playTrick(
      "roles",
      [
        { name: "ana", card: card(3) },
        { name: "warrior", card: card(9, "Green"), role: "warrior" },
        { name: "ben", card: card(2) },
      ],
      startAt(50),
      "Blue",
    );
    expect(offSuit.score("warrior")).toBe(50);
    expect(offSuit.trick.roleActions ?? []).toEqual([]);
  });

  it("a Smith in armour pays nothing when the 9 wins, and the Warrior pays for the block", () => {
    const { score, game } = playTrick(
      "roles",
      [
        { name: "smith", card: card(3), role: "smith" },
        { name: "warrior", card: card(9), role: "warrior" },
        { name: "ben", card: card(2) },
      ],
      (players) => {
        startAt(50)(players);
        players.find((p) => p.username === "smith")!.armor = 1;
      },
    );

    expect(score("smith")).toBe(50 + BLOCK_POINTS);
    expect(score("warrior")).toBe(50 + VICTORY_POINTS - BLOCK_POINTS);
    expect(score("ben")).toBe(50 - VICTORY_POINTS);
    expect(game.players.find((p) => p.username === "smith")!.armor).toBe(0);
  });
});

describe("the Gambler in a game", () => {
  const startAt = (points: number) => (players: GamePlayer[]) => {
    for (const player of players) player.score = points;
  };

  it("wins the bet when the 10 takes the trick", () => {
    const { trick, score } = playTrick(
      "roles",
      [
        { name: "ana", card: card(3) },
        { name: "gambler", card: card(10), role: "gambler", bet: true },
        { name: "ben", card: card(7) },
      ],
      startAt(50),
    );

    expect(trick.winnerUsername).toBe("gambler");
    expect(score("gambler")).toBe(50 + BET_WIN_POINTS);
    expect(score("ana")).toBe(50);
  });

  it("loses the bet to the house, not to the trick's winner, even below 0", () => {
    const { score } = playTrick(
      "roles",
      [
        { name: "ana", card: card(3) },
        { name: "gambler", card: card(10), role: "gambler", bet: true },
        { name: "ben", card: card(12) },
      ],
      startAt(0),
    );

    expect(score("gambler")).toBe(-BET_LOSS_POINTS);
    expect(score("ben")).toBe(0);
  });

  it("changes nothing without a bet, or with the 10 off the lead suit", () => {
    const noBet = playTrick(
      "roles",
      [
        { name: "ana", card: card(3) },
        { name: "gambler", card: card(10), role: "gambler" },
        { name: "ben", card: card(12) },
      ],
      startAt(50),
    );
    expect(noBet.score("gambler")).toBe(50);

    const offSuit = playTrick(
      "roles",
      [
        { name: "ana", card: card(3) },
        { name: "gambler", card: card(10, "Green"), role: "gambler", bet: true },
        { name: "ben", card: card(2) },
      ],
      startAt(50),
      "Blue",
    );
    expect(offSuit.score("gambler")).toBe(50);
    expect(offSuit.trick.playedCards[1]!.bet).toBeUndefined();
  });

  it("gets lucky points when the 10 wins with no bet", () => {
    const { trick, score } = playTrick(
      "roles",
      [
        { name: "ana", card: card(3) },
        { name: "gambler", card: card(10), role: "gambler" },
        { name: "ben", card: card(7) },
      ],
      startAt(50),
    );

    expect(score("gambler")).toBe(50 + LUCKY_POINTS);
    expect(trick.roleActions?.find((action) => action.role === "gambler")?.lucky).toBe(true);
  });
});

describe("the Duke in a game", () => {
  const seats = [
    { name: "ana", card: card(3) },
    { name: "duke", card: card(11), role: "duke" as const },
    { name: "ben", card: card(7) },
  ];
  const startAt = (points: number) => (players: GamePlayer[]) => {
    for (const player of players) player.score = points;
  };
  const tricks = (game: WizardGameState, name: string) => game.players.find((p) => p.username === name)?.tricksWon;

  it("waits for the Duke once their 11 wins, then keeps the trick for KEEP_POINTS", () => {
    const { trick, score, game, service } = playTrick("roles", seats, startAt(50));

    expect(game.phase).toBe("granting");
    expect(game.players[game.currentPlayerIndex]!.username).toBe("duke");
    expect(trick.winnerUsername).toBeNull();

    service.grantTrick(game, "duke", null);

    expect(game.currentTrick.winnerUsername).toBe("duke");
    expect(tricks(game, "duke")).toBe(1);
    expect(score("duke")).toBe(50 + KEEP_POINTS);
  });

  it("grants the trick to any other player, paying them in full, and still leads", () => {
    const { score, game, service } = playTrick("roles", seats, startAt(0));

    expect(() => service.grantTrick(game, "ana", "ben")).toThrow();
    expect(() => service.grantTrick(game, "duke", "duke")).toThrow();
    service.grantTrick(game, "duke", "ana");

    expect(game.currentTrick.winnerUsername).toBe("duke");
    expect(game.currentTrick.grantedTo).toBe("ana");
    expect(tricks(game, "duke")).toBe(0);
    expect(tricks(game, "ana")).toBe(1);
    expect(score("duke")).toBe(-GRANT_POINTS);
    expect(score("ana")).toBe(GRANT_POINTS);
    expect(game.players[game.currentPlayerIndex]!.username).toBe("duke");
  });

  it("has nothing to choose when the 11 loses or is off the lead suit", () => {
    const loses = playTrick("roles", [seats[0]!, seats[1]!, { name: "ben", card: card(13) }]);
    expect(loses.game.currentTrick.winnerUsername).toBe("ben");

    const offSuit = playTrick(
      "roles",
      [seats[0]!, { name: "duke", card: card(11, "Green"), role: "duke" }, { name: "ben", card: card(2) }],
      undefined,
      "Red",
    );
    expect(offSuit.game.phase).toBe("playing");
    expect(offSuit.game.currentTrick.winnerUsername).toBe("ana");
  });

  it("lets a bot keep a trick it needs and grant one it does not", () => {
    const needs = playTrick("roles", seats, (players) => {
      for (const player of players) player.prediction = player.username === "duke" ? 1 : 0;
    });
    expect(botGrantTo(needs.game)).toBeNull();

    const full = playTrick("roles", seats, (players) => {
      for (const player of players) player.prediction = 0;
      players.find((p) => p.username === "ben")!.score = 80;
    });
    expect(botGrantTo(full.game)).toBe("ben");
  });
});

describe("the Prophet in a game", () => {
  const withPredictions = (prophet: number) => (players: GamePlayer[]) => {
    for (const player of players) {
      player.score = 50;
      player.prediction = player.username === "prophet" ? prophet : 0;
    }
  };

  it("lowers her prediction as the 12 is played, with no bonus if it wins", () => {
    const { score, game } = playTrick(
      "roles",
      [
        { name: "ana", card: card(3) },
        { name: "prophet", card: card(12), role: "prophet", bet: true },
        { name: "ben", card: card(7) },
      ],
      withPredictions(2),
    );

    const prophet = game.players.find((p) => p.username === "prophet")!;
    expect(prophet.prediction).toBe(1);
    expect(game.currentTrick.playedCards[1]!.lowered).toBe(true);
    expect(score("prophet")).toBe(50);
  });

  it("gets FORESIGHT_POINTS when she keeps her prediction and the 12 wins", () => {
    const { score, game } = playTrick(
      "roles",
      [
        { name: "ana", card: card(3) },
        { name: "prophet", card: card(12), role: "prophet" },
        { name: "ben", card: card(7) },
      ],
      withPredictions(2),
    );

    expect(game.players.find((p) => p.username === "prophet")!.prediction).toBe(2);
    expect(game.currentTrick.playedCards[1]!.lowered).toBe(false);
    expect(score("prophet")).toBe(50 + FORESIGHT_POINTS);
  });

  it("cannot lower below the tricks won, nor off the lead suit", () => {
    const zero = playTrick(
      "roles",
      [
        { name: "ana", card: card(3) },
        { name: "prophet", card: card(12), role: "prophet", bet: true },
        { name: "ben", card: card(7) },
      ],
      withPredictions(0),
    );
    expect(zero.game.players.find((p) => p.username === "prophet")!.prediction).toBe(0);
    expect(zero.game.currentTrick.playedCards[1]!.lowered).toBeUndefined();

    const offSuit = playTrick(
      "roles",
      [
        { name: "ana", card: card(3) },
        { name: "prophet", card: card(12, "Green"), role: "prophet", bet: true },
        { name: "ben", card: card(7) },
      ],
      withPredictions(2),
      "Red",
    );
    expect(offSuit.game.players.find((p) => p.username === "prophet")!.prediction).toBe(2);
  });
});

describe("the King in a game", () => {
  const startAt = (points: number) => (players: GamePlayer[]) => {
    for (const player of players) player.score = points;
  };

  it("undoes a Thief's steal before his trump 13, points and all", () => {
    const { trick, score } = playTrick(
      "roles",
      [
        { name: "ana", card: card(9) },
        { name: "thief", card: card(1), role: "thief" },
        { name: "king", card: card(13, "Blue"), role: "king" },
      ],
      startAt(50),
      "Blue",
    );

    expect(trick.playedCards.map((played) => played.username)).toEqual(["ana", "thief", "king"]);
    // The steal paid back, then the tribute for the peace.
    expect(score("thief")).toBe(50 - PEACE_POINTS);
    expect(score("ana")).toBe(50 - PEACE_POINTS);
    expect(trick.roleActions?.[0]?.undone).toBe(true);
    expect(trick.roleActions?.find((action) => action.stopped)).toMatchObject({ role: "king", stopped: ["thief"] });
    expect(trick.winnerUsername).toBe("king");
  });

  it("stops powers played after his trump 13, and wins tribute from all but the Priest", () => {
    const { trick, score, game } = playTrick(
      "roles",
      [
        { name: "king", card: card(13, "Blue"), role: "king" },
        { name: "gambler", card: card(10, "Blue"), role: "gambler", bet: true },
        { name: "priest", card: card(8, "Blue"), role: "priest" },
      ],
      startAt(50),
      "Blue",
    );

    expect(trick.playedCards[1]!.bet).toBeUndefined();
    expect(trick.winnerUsername).toBe("king");
    // The Gambler pays tribute; the Priest pays none and collects no faith.
    expect(score("king")).toBe(50 + PEACE_POINTS);
    expect(score("gambler")).toBe(50 - PEACE_POINTS);
    expect(score("priest")).toBe(50);
    expect(game.phase).toBe("playing");
  });

  it("taxes every sealed card but the Priest's when his 13 wins, not as a trump", () => {
    const { score } = playTrick(
      "roles",
      [
        { name: "warrior", card: card(9), role: "warrior" },
        { name: "king", card: card(13), role: "king" },
        { name: "priest", card: card(8), role: "priest" },
        { name: "gambler", card: card(10), role: "gambler" },
      ],
      startAt(50),
      "Blue",
    );

    // Two taxes in; the Priest's faith from the 13 out.
    expect(score("king")).toBe(50 + 2 * TAX_POINTS - FAITH_POINTS);
    expect(score("gambler")).toBe(50 - TAX_POINTS);
    // The Warrior's 9 lost, but not as a trump: no pride to pay.
    expect(score("warrior")).toBe(50 - TAX_POINTS);
  });

  it("taxes a Joker's free play", () => {
    const { trick, score } = playTrick(
      "roles",
      [
        { name: "king", card: card(13), role: "king" },
        { name: "joker", card: card(4, "Green") },
        { name: "ana", card: card(2) },
      ],
      (players) => {
        startAt(50)(players);
        const joker = players.find((player) => player.username === "joker")!;
        joker.masterRole = "joker";
        joker.jokerPoints = 1;
        joker.hand = [card(4, "Green"), card(3)];
      },
      "Blue",
    );

    expect(trick.playedCards[1]!.freePlay).toBe(true);
    expect(trick.winnerUsername).toBe("king");
    expect(score("joker")).toBe(50 - TAX_POINTS);
    expect(score("king")).toBe(50 + TAX_POINTS);
  });

  it("is paid for nothing when his 13 does not win", () => {
    const { score } = playTrick(
      "roles",
      [
        { name: "gambler", card: card(10), role: "gambler" },
        { name: "king", card: card(13), role: "king" },
        { name: "ana", card: card(2, "Blue") },
      ],
      startAt(50),
      "Blue",
    );

    expect(score("king")).toBe(50);
    expect(score("gambler")).toBe(50);
  });
});

describe("the King's peace against the master powers", () => {
  const setUp = (masters: Record<string, RoleId>) => (players: GamePlayer[]) => {
    for (const player of players) {
      player.score = 50;
      const master = masters[player.username];
      if (master) player.masterRole = master;
    }
  };

  it("brings no peace after a Fire shield, when fire is not trumps", () => {
    const { trick, score, game } = playTrick(
      "roles",
      [
        { name: "ana", card: card(5, "Red") },
        { name: "fire", card: card(9, "Red") },
        { name: "king", card: card(13, "Blue"), role: "king" },
      ],
      setUp({ fire: "redWizard" }),
      "Blue",
    );

    expect(kingsPeace(trick.playedCards, "Blue", rolesOf(game))).toBe(false);
    expect(kingHumbledAt(trick.playedCards, "Blue", rolesOf(game))).toBe(2);
    expect(trick.winnerUsername).toBe("fire");
    expect(score("king")).toBe(50);
    expect(score("ana")).toBe(50);
  });

  it("stops a Fire shield played after his trump 13", () => {
    const { trick, score } = playTrick(
      "roles",
      [
        { name: "ana", card: card(5, "Red") },
        { name: "king", card: card(13, "Blue"), role: "king" },
        { name: "fire", card: card(9, "Red") },
      ],
      setUp({ fire: "redWizard" }),
      "Blue",
    );

    expect(trick.winnerUsername).toBe("king");
    expect(score("king")).toBe(50 + 2 * PEACE_POINTS);
    expect(score("fire")).toBe(50 - PEACE_POINTS);
  });

  it("with fire trumps takes the shield down: no burn for the King, no tribute from Fire", () => {
    const { trick, score } = playTrick(
      "roles",
      [
        { name: "ana", card: card(5, "Red") },
        { name: "fire", card: card(9, "Red") },
        { name: "king", card: card(13, "Red"), role: "king" },
      ],
      setUp({ fire: "redWizard" }),
      "Red",
    );

    expect(trick.winnerUsername).toBe("king");
    expect(score("king")).toBe(50 + PEACE_POINTS);
    expect(score("fire")).toBe(50);
    expect(score("ana")).toBe(50 - PEACE_POINTS);
  });

  it("lets no Air power turn the lead after his trump 13", () => {
    const { trick, game } = playTrick(
      "roles",
      [
        { name: "ana", card: card(5, "Green") },
        { name: "king", card: card(13, "Blue"), role: "king" },
        { name: "air", card: card(9, "Yellow") },
      ],
      setUp({ air: "yellowWizard" }),
      "Blue",
    );

    expect(new WizardRules().getLeadSuit(trick.playedCards, "Blue", trickRolesIn(game))).toBe("Green");
  });

  it("stops the Air power's take for a turn before his trump 13", () => {
    const { trick, score } = playTrick(
      "roles",
      [
        { name: "ana", card: card(5, "Green") },
        { name: "air", card: card(9, "Yellow") },
        { name: "king", card: card(13, "Blue"), role: "king" },
      ],
      setUp({ air: "yellowWizard" }),
      "Blue",
    );

    expect(trick.winnerUsername).toBe("king");
    // Only the tribute: the 5 the turn would take are not taken.
    expect(score("ana")).toBe(50 - PEACE_POINTS);
    expect(score("air")).toBe(50 - PEACE_POINTS);
    expect(trick.roleActions?.find((action) => action.stopped)?.stopped).toEqual(["air"]);
  });

  it("stops an element Wizard's bonus", () => {
    const { trick, score } = playTrick(
      "roles",
      [
        { name: "earth", card: card(14, "Green") },
        { name: "king", card: card(13, "Blue"), role: "king" },
        { name: "ana", card: card(2, "Blue") },
      ],
      setUp({ earth: "greenWizard" }),
      "Blue",
    );

    expect(trick.winnerUsername).toBe("earth");
    expect(score("earth")).toBe(50);
  });

  it("lets no Joker play free after his trump 13", () => {
    const { game } = playTrick(
      "roles",
      [
        { name: "ana", card: card(5, "Green") },
        { name: "king", card: card(13, "Blue"), role: "king" },
        { name: "joker", card: card(9, "Green") },
      ],
      setUp({ joker: "joker" }),
      "Blue",
    );
    const joker = game.players.find((player) => player.username === "joker")!;
    joker.jokerPoints = 1;
    const during = { ...game, currentTrick: { ...game.currentTrick, playedCards: game.currentTrick.playedCards.slice(0, 2) } };
    const before = { ...game, currentTrick: { ...game.currentTrick, playedCards: game.currentTrick.playedCards.slice(0, 1) } };

    expect(playsFreeIn(during, joker)).toBe(false);
    expect(playsFreeIn(before, joker)).toBe(true);
  });
});

describe("the Joker in a game", () => {
  const jokerOf = (players: GamePlayer[]) => players.find((p) => p.username === "joker")!;

  it("with a point need not follow suit, and a card off the lead suit still cannot win", () => {
    let joker: GamePlayer | undefined;
    const { trick } = playTrick("roles", [
      { name: "ana", card: card(5) },
      { name: "joker", card: card(13, "Green"), role: "joker" },
      { name: "ben", card: card(7) },
    ], (players) => {
      joker = jokerOf(players);
      // The Joker holds the suit led too, and a point to spend.
      joker.hand.push(card(2));
      joker.jokerPoints = 1;
    });

    expect(trick.playedCards[1]!.freePlay).toBe(true);
    expect(trick.winnerUsername).toBe("ben");
    expect(joker!.jokerPoints).toBe(0);
  });

  it("may trump with a point while holding the suit led, and that trick does not count towards the next point", () => {
    let joker: GamePlayer | undefined;
    const { trick } = playTrick("roles", [
      { name: "ana", card: card(12) },
      { name: "joker", card: card(1, "Blue"), role: "joker" },
      { name: "ben", card: card(7) },
    ], (players) => {
      joker = jokerOf(players);
      joker.hand.push(card(2));
      joker.jokerPoints = 1;
    }, "Blue");

    expect(trick.winnerUsername).toBe("joker");
    expect(joker!.jokerTricks ?? 0).toBe(0);
  });

  it("with a point may break a trump lead too", () => {
    const { trick } = playTrick("roles", [
      { name: "ana", card: card(5) },
      { name: "joker", card: card(13, "Green"), role: "joker" },
      { name: "ben", card: card(7) },
    ], (players) => {
      const joker = jokerOf(players);
      joker.hand.push(card(2));
      joker.jokerPoints = 1;
    }, "Red");

    expect(trick.playedCards[1]!.freePlay).toBe(true);
  });

  it("without a point must follow suit", () => {
    expect(() => playTrick("roles", [
      { name: "ana", card: card(5) },
      { name: "joker", card: card(13, "Green"), role: "joker" },
      { name: "ben", card: card(7) },
    ], (players) => {
      jokerOf(players).hand.push(card(2));
    })).toThrow("Card cannot be played");
  });

  it("may play a Wizard without a point, and a trick won counts towards the next", () => {
    let joker: GamePlayer | undefined;
    const { trick } = playTrick("roles", [
      { name: "ana", card: card(5) },
      { name: "joker", card: card(14, "Green"), role: "joker" },
      { name: "ben", card: card(7) },
    ], (players) => {
      joker = jokerOf(players);
      joker.hand.push(card(2));
    }, "Red");

    expect(trick.playedCards[1]!.freePlay).toBeUndefined();
    expect(trick.winnerUsername).toBe("joker");
    expect(joker!.jokerTricks).toBe(1);
  });

  it("is held to the suit in a Classic game", () => {
    expect(() => playTrick("classic", [
      { name: "ana", card: card(5) },
      { name: "joker", card: card(13, "Green"), role: "joker" },
      { name: "ben", card: card(7) },
    ], (players) => {
      players.find((p) => p.username === "joker")!.hand.push(card(2));
    })).toThrow("Card cannot be played");
  });
});
