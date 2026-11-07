import { describe, expect, it } from "vitest";
import { SEAL_LEVELS, sealPoints, sealState } from "./sealLevels.js";

const [wax, wood, copper, , gold] = SEAL_LEVELS;

describe("sealPoints", () => {
  it("is one point a game and one more a win", () => {
    expect(sealPoints({ games: 5, wins: 2 })).toBe(7);
    // 5 games, 3 of them full length: 8, and 2 won.
    expect(sealPoints({ games: 5, fullGames: 3, wins: 2 })).toBe(10);
  });
});

describe("sealState", () => {
  it("starts at wax, wood under way", () => {
    expect(sealState(0)).toEqual({ done: wax.id, next: wood.id, fill: 0 });
    expect(sealState(wood.at / 2)).toEqual({ done: wax.id, next: wood.id, fill: 0.5 });
  });

  it("has a level done once its points are reached, the next under way", () => {
    expect(sealState(wood.at)).toEqual({ done: wood.id, next: copper.id, fill: 0 });
  });

  it("has nothing left after gold", () => {
    expect(sealState(gold.at + 10)).toEqual({ done: gold.id, next: null, fill: 1 });
  });
});
