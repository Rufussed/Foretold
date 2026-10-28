import { describe, it, expect } from "vitest";

import { collect, FLOCK, giveSheep, laidBy, SHEEP_POINTS, sheepCount, sheepOut } from "./shepherd.js";
import { card, play, roles } from "./roleTestHelpers.js";

const roleOf = roles({ shepherd: "shepherd", shepherd2: "shepherd", thief: "thief" });

describe("laidBy", () => {
  it("lays with a 5 in the lead suit", () => {
    const trick = [play("ana", 9), play("shepherd", 5), play("ben", 12)];

    expect(laidBy(trick, roleOf)).toEqual([{ shepherd: "shepherd", card: card(5) }]);
  });

  it("lays with a 5 off the lead suit too", () => {
    expect(laidBy([play("ana", 9), play("shepherd", 5, "Green")], roleOf)).toHaveLength(1);
  });

  it("is a plain 5 for anyone who is not the Shepherd", () => {
    expect(laidBy([play("ana", 9), play("ben", 5)], roleOf)).toEqual([]);
  });

  it("still lays for the Shepherd when a Thief stole the 5", () => {
    const trick = [play("shepherd", 5), play("thief", 1)];
    [trick[0]!.username, trick[1]!.username] = ["thief", "shepherd"];

    expect(laidBy(trick, roleOf)[0]?.shepherd).toBe("shepherd");
  });
});

describe("giveSheep", () => {
  it("gives the trick's winner a sheep of that Shepherd", () => {
    const ben: { username: string; score: number; sheep?: Record<string, number> } = { username: "ben", score: 0 };

    expect(giveSheep([ben], ben, "shepherd")).toBe(true);
    expect(giveSheep([ben], ben, "shepherd")).toBe(true);
    expect(ben.sheep).toEqual({ shepherd: 2 });
  });

  it("never gives a Shepherd their own sheep", () => {
    const shepherd = { username: "shepherd", score: 0 };

    expect(giveSheep([shepherd], shepherd, "shepherd")).toBe(false);
  });

  it("gives nothing once the whole flock is out, whoever holds it", () => {
    const ana = { username: "ana", score: 0, sheep: { shepherd: 2 } };
    const ben = { username: "ben", score: 0, sheep: { shepherd: 1, shepherd2: 2 } };

    expect(sheepOut([ana, ben], "shepherd")).toBe(FLOCK);
    expect(giveSheep([ana, ben], ben, "shepherd")).toBe(false);
    expect(giveSheep([ana, ben], ana, "shepherd2")).toBe(true);
  });
});

describe("collect", () => {
  it("is paid for every sheep of the Shepherd's at once, and the flock comes home", () => {
    const ana = { username: "ana", score: 100, sheep: { shepherd: 2, shepherd2: 1 } };
    const ben = { username: "ben", score: 100, sheep: { shepherd: 1 } };
    const cara = { username: "cara", score: 100 };

    const paid = collect([ana, ben, cara], "shepherd");

    expect(paid.map(({ holder, points }) => [holder.username, points])).toEqual([
      ["ana", 2 * SHEEP_POINTS],
      ["ben", SHEEP_POINTS],
    ]);
    expect(ana.sheep).toEqual({ shepherd2: 1 });
    expect(sheepCount(ben.sheep)).toBe(0);
  });

  it("never takes more than the holder has, and nothing from 0 or below", () => {
    const ana = { username: "ana", score: 10, sheep: { shepherd: 2 } };
    const ben = { username: "ben", score: 0, sheep: { shepherd: 1 } };

    expect(collect([ana, ben], "shepherd").map(({ points }) => points)).toEqual([10, 0]);
    expect(sheepCount(ben.sheep)).toBe(0);
  });
});
