import { describe, it, expect } from "vitest";

import { findSteal } from "./thief.js";
import { card, play, roles } from "./roleTestHelpers.js";

const roleOf = roles({ thief: "thief", serv: "servant" });

describe("findSteal", () => {
  it("takes the card just before a 1 in the lead suit", () => {
    const trick = [play("ana", 8), play("ben", 13), play("thief", 1)];

    expect(findSteal(trick, null, roleOf)).toEqual({
      role: "thief",
      by: "thief",
      on: "ben",
      card: card(13),
    });
  });

  it("steals with a 1 played as a trump", () => {
    const trick = [play("ana", 8), play("ben", 13), play("thief", 1, "Blue")];

    expect(findSteal(trick, "Blue", roleOf)?.on).toBe("ben");
  });

  it("does nothing with a 1 that is neither the lead suit nor a trump", () => {
    const trick = [play("ana", 8), play("ben", 13), play("thief", 1, "Green")];

    expect(findSteal(trick, "Blue", roleOf)).toBeNull();
  });

  it("does nothing when the 1 leads the trick", () => {
    expect(findSteal([play("thief", 1)], null, roleOf)).toBeNull();
  });

  it("leaves Wizards and Jesters alone", () => {
    expect(findSteal([play("ana", 5), play("ben", 14), play("thief", 1)], null, roleOf)).toBeNull();
    expect(findSteal([play("ana", 5), play("ben", 0), play("thief", 1)], null, roleOf)).toBeNull();
  });

  it("must take a worse card too", () => {
    const trick = [play("ana", 9), play("ben", 2), play("thief", 1)];

    expect(findSteal(trick, null, roleOf)?.card).toEqual(card(2));
  });

  it("cannot outsmart a Servant's 2", () => {
    const trick = [play("ana", 9), play("serv", 2), play("thief", 1)];

    expect(findSteal(trick, null, roleOf)).toBeNull();
  });

  it("is a plain 1 for anyone who is not the Thief", () => {
    const trick = [play("ana", 8), play("ben", 13), play("cara", 1)];

    expect(findSteal(trick, null, roleOf)).toBeNull();
  });
});
