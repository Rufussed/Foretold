import { describe, it, expect } from "vitest";

import { harvest, MAX_SEEDS, plant, plantedBy, SEED_POINTS, seedCount } from "./farmer.js";
import { card, play, roles } from "./roleTestHelpers.js";

const roleOf = roles({ farmer: "farmer", farmer2: "farmer", thief: "thief" });

describe("plantedBy", () => {
  it("plants with a 4 in the lead suit", () => {
    const trick = [play("ana", 9), play("farmer", 4), play("ben", 12)];

    expect(plantedBy(trick, roleOf)).toEqual([{ farmer: "farmer", card: card(4) }]);
  });

  it("plants with a 4 off the lead suit too", () => {
    const trick = [play("ana", 9), play("farmer", 4, "Green")];

    expect(plantedBy(trick, roleOf)).toHaveLength(1);
  });

  it("is a plain 4 for anyone who is not the Farmer", () => {
    expect(plantedBy([play("ana", 9), play("ben", 4)], roleOf)).toEqual([]);
  });

  it("still plants for the Farmer when a Thief stole the 4", () => {
    const trick = [play("farmer", 4), play("thief", 1)];
    [trick[0]!.username, trick[1]!.username] = ["thief", "farmer"];

    expect(plantedBy(trick, roleOf)[0]?.farmer).toBe("farmer");
  });
});

describe("plant", () => {
  it("gives the trick's winner a seed of that Farmer", () => {
    const ben: { username: string; score: number; seeds?: Record<string, number> } = { username: "ben", score: 0 };

    expect(plant(ben, "farmer")).toBe(true);
    expect(plant(ben, "farmer")).toBe(true);
    expect(ben.seeds).toEqual({ farmer: 2 });
  });

  it("never gives a Farmer their own seed", () => {
    expect(plant({ username: "farmer", score: 0 }, "farmer")).toBe(false);
  });

  it("loses the seed when the winner already holds the most, of all Farmers", () => {
    const ben = { username: "ben", score: 0, seeds: { farmer: 3, farmer2: 1 } };

    expect(plant(ben, "farmer")).toBe(false);
    expect(seedCount(ben.seeds)).toBe(MAX_SEEDS);
  });
});

describe("harvest", () => {
  it("takes every seed of the Farmer's from everyone at once", () => {
    const ana = { username: "ana", score: 100, seeds: { farmer: 2, farmer2: 1 } };
    const ben = { username: "ben", score: 100, seeds: { farmer: 1 } };
    const cara = { username: "cara", score: 100 };

    const taken = harvest([ana, ben, cara], "farmer");

    expect(taken.map(({ holder, points }) => [holder.username, points])).toEqual([
      ["ana", 2 * SEED_POINTS],
      ["ben", SEED_POINTS],
    ]);
    expect(ana.seeds).toEqual({ farmer2: 1 });
    expect(seedCount(ben.seeds)).toBe(0);
  });

  it("finds nothing to harvest without seeds", () => {
    expect(harvest([{ username: "ana", score: 100 }], "farmer")).toEqual([]);
  });

  it("never takes more than the holder has, and nothing from 0 or below", () => {
    const ana = { username: "ana", score: 10, seeds: { farmer: 2 } };
    const ben = { username: "ben", score: 0, seeds: { farmer: 1 } };
    const cara = { username: "cara", score: -30, seeds: { farmer: 1 } };

    expect(harvest([ana, ben, cara], "farmer").map(({ points }) => points)).toEqual([10, 0, 0]);
    expect(seedCount(ben.seeds)).toBe(0);
  });
});
