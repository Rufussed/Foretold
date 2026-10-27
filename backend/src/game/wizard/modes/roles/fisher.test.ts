import { describe, it, expect } from "vitest";

import { botCatch, fish, fishingSpots, nextFisher } from "./fisher.js";
import { card, play, roles } from "./roleTestHelpers.js";

const roleOf = roles({ fisher: "fisher", fisher2: "fisher", thief: "thief", serv: "servant" });

describe("fishingSpots", () => {
  it("offers every card played after a 3 in the lead suit", () => {
    const trick = [play("ana", 5), play("fisher", 3), play("ben", 12), play("cara", 7)];

    expect(fishingSpots(trick, 1, null, roleOf)).toEqual([2, 3]);
  });

  it("leaves Wizards and Jesters alone", () => {
    const trick = [play("fisher", 3), play("ben", 14), play("cara", 0), play("dan", 9)];

    expect(fishingSpots(trick, 0, null, roleOf)).toEqual([3]);
  });

  it("cannot fish a Thief's 1 or a Servant's 2", () => {
    const trick = [play("fisher", 3), play("thief", 1), play("serv", 2), play("dan", 9)];

    expect(fishingSpots(trick, 0, null, roleOf)).toEqual([3]);
  });

  it("can fish a plain 1 or 2", () => {
    const trick = [play("fisher", 3), play("ana", 1), play("ben", 2)];

    expect(fishingSpots(trick, 0, null, roleOf)).toEqual([1, 2]);
  });
});

describe("nextFisher", () => {
  it("finds a Fisher's 3 with something to fish", () => {
    const trick = [play("ana", 5), play("fisher", 3), play("ben", 12)];

    expect(nextFisher(trick, [], null, roleOf)).toBe(1);
  });

  it("is a plain 3 when played last", () => {
    expect(nextFisher([play("ana", 5), play("fisher", 3)], [], null, roleOf)).toBeNull();
  });

  it("is a plain 3 off the lead suit and not a trump", () => {
    const trick = [play("ana", 5), play("fisher", 3, "Green"), play("ben", 12)];

    expect(nextFisher(trick, [], "Blue", roleOf)).toBeNull();
  });

  it("fishes with a 3 played as a trump", () => {
    const trick = [play("ana", 5), play("fisher", 3, "Blue"), play("ben", 12)];

    expect(nextFisher(trick, [], "Blue", roleOf)).toBe(1);
  });

  it("is a plain 3 for anyone who is not the Fisher", () => {
    expect(nextFisher([play("ana", 3), play("ben", 12)], [], null, roleOf)).toBeNull();
  });

  it("lets each of two Fishers fish once, in play order", () => {
    const trick = [play("fisher", 3), play("fisher2", 3), play("ben", 12)];
    const first = { role: "fisher" as const, by: "fisher", on: "ben", card: card(12) };

    expect(nextFisher(trick, [], null, roleOf)).toBe(0);
    expect(nextFisher(trick, [first], null, roleOf)).toBe(1);
  });
});

describe("fish", () => {
  it("swaps the Fisher's card for the one fished", () => {
    const trick = [play("ana", 5), play("fisher", 3), play("ben", 12)];

    expect(fish(trick, "fisher", 2)).toEqual({ role: "fisher", by: "fisher", on: "ben", card: card(12) });
    expect(trick.map((played) => played.username)).toEqual(["ana", "ben", "fisher"]);
  });
});

describe("botCatch", () => {
  const wins = (spot: number) => spot === 3;

  it("fishes a winning card while it needs tricks", () => {
    expect(botCatch([2, 3], wins, true)).toBe(3);
  });

  it("fishes a card that loses once it has enough", () => {
    expect(botCatch([3, 2], wins, false)).toBe(2);
  });
});
