import { describe, it, expect } from "vitest";

import { block, forge, forgesArmor, MAX_ARMOR } from "./smith.js";
import { play, roles } from "./roleTestHelpers.js";

const roleOf = roles({ smith: "smith" });

describe("forgesArmor", () => {
  it("forges with a 6 in the lead suit or as a trump", () => {
    expect(forgesArmor([play("ana", 9), play("smith", 6)], null, roleOf)).toBe(true);
    expect(forgesArmor([play("ana", 9), play("smith", 6, "Blue")], "Blue", roleOf)).toBe(true);
  });

  it("forges nothing off the lead suit, or for anyone else", () => {
    expect(forgesArmor([play("ana", 9), play("smith", 6, "Green")], "Blue", roleOf)).toBe(false);
    expect(forgesArmor([play("ana", 9), play("ben", 6)], null, roleOf)).toBe(false);
  });
});

describe("forge", () => {
  it("adds a piece of armour up to the most a Smith can wear", () => {
    const smith = { username: "smith", armor: MAX_ARMOR - 1 };

    expect(forge(smith)).toBe(true);
    expect(forge(smith)).toBe(false);
    expect(smith.armor).toBe(MAX_ARMOR);
  });
});

describe("block", () => {
  it("uses up one piece per attack, as far as the armour goes", () => {
    const smith = { username: "smith", armor: 2 };

    expect(block(smith, 3)).toBe(2);
    expect(smith.armor).toBe(0);
    expect(block(smith)).toBe(0);
  });

  it("blocks nothing without armour", () => {
    expect(block({ username: "ana" })).toBe(0);
    expect(block(undefined)).toBe(0);
  });
});
