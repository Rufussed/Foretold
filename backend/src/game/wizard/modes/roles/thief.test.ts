import { describe, it, expect } from "vitest";

import { steal, stealFails, stealSpots } from "./thief.js";
import { card, play, roles } from "./roleTestHelpers.js";

const roleOf = roles({ thief: "thief", serv: "servant", fisher: "fisher" });

describe("stealSpots", () => {
  it("takes the card just before a 1 in the lead suit", () => {
    const trick = [play("ana", 8), play("ben", 13), play("thief", 1)];

    expect(stealSpots(trick, null, roleOf)).toEqual([1]);
  });

  it("may take any card before a 1 played as a trump", () => {
    const trick = [play("ana", 8), play("ben", 13), play("thief", 1, "Blue")];

    expect(stealSpots(trick, "Blue", roleOf)).toEqual([0, 1]);
  });

  it("takes the card just before a 1 that is neither the lead suit nor a trump", () => {
    const trick = [play("ana", 8), play("ben", 13), play("thief", 1, "Green")];

    expect(stealSpots(trick, "Blue", roleOf)).toEqual([1]);
  });

  it("does nothing when the 1 leads the trick", () => {
    expect(stealSpots([play("thief", 1)], null, roleOf)).toEqual([]);
  });

  it("leaves Wizards and Jesters alone", () => {
    expect(stealSpots([play("ana", 5), play("ben", 14), play("thief", 1)], null, roleOf)).toEqual([]);
    expect(stealSpots([play("ana", 5), play("ben", 0), play("thief", 1)], null, roleOf)).toEqual([]);
  });

  it("passes over a Wizard to the other cards with a trump 1", () => {
    const trick = [play("ana", 5), play("ben", 14), play("thief", 1, "Blue")];

    expect(stealSpots(trick, "Blue", roleOf)).toEqual([0]);
  });

  it("must take a worse card too", () => {
    const trick = [play("ana", 9), play("ben", 2), play("thief", 1)];

    expect(stealSpots(trick, null, roleOf)).toEqual([1]);
  });

  it("cannot outsmart a Servant's 2", () => {
    const trick = [play("ana", 9), play("serv", 2), play("thief", 1)];

    expect(stealSpots(trick, null, roleOf)).toEqual([]);
  });

  it("steals a Fisher's 3 like any card", () => {
    const trick = [play("ana", 9), play("fisher", 3), play("thief", 1)];

    expect(stealSpots(trick, null, roleOf)).toEqual([1]);
  });

  it("is a plain 1 for anyone who is not the Thief", () => {
    const trick = [play("ana", 8), play("ben", 13), play("cara", 1)];

    expect(stealSpots(trick, null, roleOf)).toEqual([]);
  });
});

describe("steal", () => {
  it("swaps the 1 with the card taken, and tells who was robbed", () => {
    const trick = [play("ana", 13), play("ben", 8), play("thief", 1, "Blue")];

    expect(steal(trick, 0)).toEqual({ role: "thief", by: "thief", on: "ana", card: card(13) });
    expect(trick.map((played) => played.username)).toEqual(["thief", "ben", "ana"]);
  });
});

describe("stealFails", () => {
  it("names a Wizard just before a 1 in the lead suit", () => {
    expect(stealFails([play("ana", 5), play("ben", 14), play("thief", 1)], null, roleOf)).toBe("wizard");
  });

  it("names a Jester just before it", () => {
    expect(stealFails([play("ana", 5), play("ben", 0), play("thief", 1)], null, roleOf)).toBe("jester");
  });

  it("names a Servant's 2 just before it", () => {
    expect(stealFails([play("ana", 9), play("serv", 2), play("thief", 1)], null, roleOf)).toBe("servant");
  });

  it("says nothing when there is a card to steal", () => {
    expect(stealFails([play("ana", 5), play("ben", 9), play("thief", 1)], null, roleOf)).toBeUndefined();
    expect(stealFails([play("ana", 5), play("ben", 14), play("thief", 1, "Blue")], "Blue", roleOf)).toBeUndefined();
  });

  it("says nothing when the 1 leads or has no power", () => {
    expect(stealFails([play("thief", 1)], null, roleOf)).toBeUndefined();
    expect(stealFails([play("ana", 5), play("ben", 1, "Green")], "Blue", roleOf)).toBeUndefined();
  });

  it("fails off suit too when the card just before is a Wizard", () => {
    expect(stealFails([play("ana", 5), play("ben", 14), play("thief", 1, "Green")], "Blue", roleOf)).toBe("wizard");
  });
});
