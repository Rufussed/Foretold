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
  it("trades by number: 7 or lower pays the Merchant, higher is paid, whatever the suit", () => {
    const market = trades(
      [play("ana", 3), play("merchant", 7), play("ben", 10), play("cid", 4, "Green"), play("dan", 7, "Blue"), play("eve", 12, "Green")],
      "merchant",
    );

    expect(market.map(({ player, sells }) => [player, sells])).toEqual([
      ["ana", true],
      ["ben", false],
      ["cid", true],
      ["dan", true],
      ["eve", false],
    ]);
  });

  it("leaves Wizards and Jesters out", () => {
    expect(trades([play("ana", 14), play("merchant", 7), play("ben", 0)], "merchant")).toEqual([]);
  });

  it("still trades at 7 when a Thief took it, each card for whoever played it", () => {
    const stolen = [play("ana", 3), play("merchant", 7), play("thief", 1)];
    // The Thief took the 7 and left the 1.
    stolen[1]!.username = "thief";
    stolen[2]!.username = "merchant";

    expect(trades(stolen, "merchant").map(({ player, sells }) => [player, sells])).toEqual([
      ["ana", true],
      ["thief", true],
    ]);
  });
});
