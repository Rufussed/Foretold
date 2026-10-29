import { describe, it, expect } from "vitest";

import { marketsIn, trades } from "./merchant.js";
import { play, roles } from "./roleTestHelpers.js";

const roleOf = roles({ merchant: "merchant" });

describe("marketsIn", () => {
  it("opens a market for a 7 in the lead suit or as a trump", () => {
    expect(marketsIn([play("ana", 9), play("merchant", 7)], null, roleOf)).toHaveLength(1);
    expect(marketsIn([play("ana", 9), play("merchant", 7, "Blue")], "Blue", roleOf)).toHaveLength(1);
  });

  it("opens none off the lead suit, or for anyone else", () => {
    expect(marketsIn([play("ana", 9), play("merchant", 7, "Green")], "Blue", roleOf)).toEqual([]);
    expect(marketsIn([play("ana", 9), play("ben", 7)], null, roleOf)).toEqual([]);
  });
});

describe("trades", () => {
  it("sells to every card the Merchant's card beats and buys from every card that beats it", () => {
    const market = trades([play("ana", 3), play("merchant", 7), play("ben", 10), play("cid", 4, "Green")], "merchant", null);

    expect(market.map(({ player, sells }) => [player, sells])).toEqual([
      ["ana", true],
      ["ben", false],
      ["cid", true],
    ]);
  });

  it("leaves Wizards and Jesters out", () => {
    expect(trades([play("ana", 14), play("merchant", 7), play("ben", 0)], "merchant", null)).toEqual([]);
  });

  it("trades with the card the Merchant holds now, after a swap", () => {
    const stolen = [play("ana", 3), play("merchant", 7), play("thief", 1)];
    // The Thief took the 7 and left the 1.
    stolen[1]!.username = "thief";
    stolen[2]!.username = "merchant";

    expect(trades(stolen, "merchant", null).every(({ sells }) => !sells)).toBe(true);
  });
});
