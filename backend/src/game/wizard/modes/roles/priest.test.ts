import { describe, it, expect } from "vitest";

import { isPoor, isRoyal, poorFor, priestsIn, royalsFor } from "./priest.js";
import { card, play, roles } from "./roleTestHelpers.js";

const roleOf = roles({ priest: "priest" });

describe("priestsIn", () => {
  it("finds a Priest's 8 in the lead suit or as a trump", () => {
    expect(priestsIn([play("ana", 12), play("priest", 8)], null, roleOf)).toHaveLength(1);
    expect(priestsIn([play("ana", 12), play("priest", 8, "Blue")], "Blue", roleOf)).toHaveLength(1);
  });

  it("finds an 8 in any suit when a Wizard opened the trick, after Jesters too", () => {
    expect(priestsIn([play("ana", 14, "Red"), play("priest", 8, "Green")], "Blue", roleOf)).toHaveLength(1);
    expect(priestsIn([play("ana", 0), play("ben", 0), play("cid", 14), play("priest", 8, "Green")], "Blue", roleOf)).toHaveLength(1);
    // A Jester then a number card: that card's suit leads as usual.
    expect(priestsIn([play("ana", 0), play("ben", 3, "Red"), play("priest", 8, "Green")], "Blue", roleOf)).toEqual([]);
  });

  it("finds none off the lead suit, or for anyone else", () => {
    expect(priestsIn([play("ana", 12), play("priest", 8, "Green")], "Blue", roleOf)).toEqual([]);
    expect(priestsIn([play("ana", 12), play("ben", 8)], null, roleOf)).toEqual([]);
  });
});

describe("royalsFor", () => {
  it("takes every 11, 12 and 13, in any suit and before or after the 8", () => {
    const trick = [play("ana", 11, "Green"), play("priest", 8), play("ben", 13, "Blue"), play("cid", 10)];

    expect(royalsFor(trick, "priest").map(({ player }) => player)).toEqual(["ana", "ben"]);
  });

  it("leaves Wizards and Jesters out", () => {
    expect(isRoyal(card(14))).toBe(false);
    expect(isRoyal(card(0))).toBe(false);
    expect(isRoyal(card(12))).toBe(true);
  });

  it("has whoever played the royal pay, after a swap too", () => {
    const trick = [play("ana", 12), play("priest", 8)];
    trick[0]!.username = "thief";

    expect(royalsFor(trick, "priest")).toEqual([{ player: "ana", card: card(12) }]);
  });
});

describe("poorFor", () => {
  it("feeds every card under 8 when the Priest's 8 wins, in any suit", () => {
    const trick = [play("ana", 3), play("priest", 8), play("ben", 7, "Green"), play("cid", 12, "Blue")];

    expect(poorFor(trick, "priest", "priest").map(({ player }) => player)).toEqual(["ana", "ben"]);
  });

  it("feeds nobody when the 8 loses, or someone else won with it", () => {
    const trick = [play("ana", 3), play("priest", 8), play("ben", 10)];
    expect(poorFor(trick, "priest", "ben")).toEqual([]);

    const stolen = [play("ana", 3), play("priest", 8), play("thief", 1)];
    stolen[1]!.username = "thief";
    stolen[2]!.username = "priest";
    expect(poorFor(stolen, "priest", "thief")).toEqual([]);
  });

  it("leaves Jesters and Wizards out", () => {
    expect(isPoor(card(0))).toBe(false);
    expect(isPoor(card(14))).toBe(false);
    expect(isPoor(card(1))).toBe(true);
  });
});
