import { describe, it, expect } from "vitest";

import { findService, servantBonus, SERVANT_BONUS } from "./servant.js";
import { card, play, roles } from "./roleTestHelpers.js";

const roleOf = roles({ serv: "servant", serv2: "servant", thief: "thief", fisher: "fisher" });

describe("findService", () => {
  it("receives the card played right after a 2 in the lead suit", () => {
    const trick = [play("ana", 5), play("serv", 2), play("ben", 12)];

    expect(findService(trick, null, roleOf)).toEqual({
      role: "servant",
      by: "serv",
      on: "ben",
      card: card(12),
    });
  });

  it("serves with a 2 played as a trump", () => {
    const trick = [play("ana", 5), play("serv", 2, "Blue"), play("ben", 12)];

    expect(findService(trick, "Blue", roleOf)?.on).toBe("ben");
  });

  it("must take a worse card too", () => {
    const trick = [play("serv", 2), play("ben", 3)];

    expect(findService(trick, null, roleOf)?.card).toEqual(card(3));
  });

  it("does nothing until a card follows the 2", () => {
    expect(findService([play("ana", 5), play("serv", 2)], null, roleOf)).toBeNull();
  });

  it("leaves Wizards and Jesters alone", () => {
    expect(findService([play("serv", 2), play("ben", 14)], null, roleOf)).toBeNull();
    expect(findService([play("serv", 2), play("ben", 0)], null, roleOf)).toBeNull();
  });

  it("does nothing with a 2 that is neither the lead suit nor a trump", () => {
    const trick = [play("ana", 5), play("serv", 2, "Green"), play("ben", 12)];

    expect(findService(trick, "Blue", roleOf)).toBeNull();
  });

  it("meets a Thief's 1 and a second Servant's 2 as equals: nothing happens", () => {
    expect(findService([play("serv", 2), play("thief", 1)], null, roleOf)).toBeNull();
    expect(findService([play("serv", 2), play("serv2", 2)], null, roleOf)).toBeNull();
  });

  it("cannot receive a Fisher's 3", () => {
    expect(findService([play("serv", 2), play("fisher", 3)], null, roleOf)).toBeNull();
  });

  it("lets the second of two Servants serve on the next card", () => {
    const trick = [play("serv", 2), play("serv2", 2), play("ben", 9)];

    expect(findService(trick, null, roleOf)?.by).toBe("serv2");
  });
});

describe("servantBonus", () => {
  const served = [{ role: "servant" as const, by: "serv", on: "ben", card: card(12) }];

  it("rewards the Servant who served and won the trick", () => {
    expect(servantBonus(served, "serv")).toBe(SERVANT_BONUS);
  });

  it("gives nothing to anyone else, or without service", () => {
    expect(servantBonus(served, "ben")).toBe(0);
    expect(servantBonus(undefined, "serv")).toBe(0);
  });
});
