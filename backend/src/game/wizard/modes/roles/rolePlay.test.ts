import { describe, it, expect } from "vitest";

import { canBet } from "./gambler.js";
import { canLower } from "./prophet.js";
import { powerOn, wizardBlocked } from "./rolePlay.js";
import { battlesIn } from "./warrior.js";
import { dukeWinning } from "./duke.js";
import { play, roles } from "./roleTestHelpers.js";

// Roles mode only. The roles that must win the trick lose their power once a
// Wizard is in it before their card.

const roleOf = roles({ war: "warrior", gam: "gambler", duke: "duke", pro: "prophet", thief: "thief" });

describe("a Wizard before a card that must win", () => {
  it("blocks a Gambler's bet after a Wizard lead", () => {
    const trick = [play("ana", 14), play("gam", 10, "Green")];

    expect(canBet(trick, 1, null, roleOf)).toBe(false);
    expect(wizardBlocked(trick, 1, null, roleOf)).toBe("gambler");
  });

  it("blocks a Gambler's bet after a Wizard played later than the lead", () => {
    const trick = [play("ana", 5), play("ben", 14), play("gam", 10)];

    expect(canBet(trick, 2, null, roleOf)).toBe(false);
    expect(wizardBlocked(trick, 2, null, roleOf)).toBe("gambler");
  });

  it("leaves a bet open when the Wizard comes after the 10", () => {
    const trick = [play("ana", 5), play("gam", 10)];

    expect(canBet(trick, 1, null, roleOf)).toBe(true);
    expect(wizardBlocked(trick, 1, null, roleOf)).toBeUndefined();
  });

  it("blocks the Prophet's lowering", () => {
    const trick = [play("ana", 14), play("pro", 12)];

    expect(canLower(trick, 1, null, roleOf, { prediction: 2, tricksWon: 0 })).toBe(false);
    expect(wizardBlocked(trick, 1, null, roleOf)).toBe("prophet");
  });

  it("costs a Warrior no pride for a trump 9 after a Wizard", () => {
    const trick = [play("ana", 5), play("ben", 14), play("war", 9, "Blue")];

    expect(battlesIn(trick, "Blue", roleOf, "ben")).toEqual([]);
    expect(wizardBlocked(trick, 2, "Blue", roleOf)).toBe("warrior");
  });

  it("gives the Duke no choice", () => {
    const trick = [play("ana", 14), play("duke", 11)];

    expect(powerOn(trick, 1, "duke", null, roleOf)).toBe(false);
    expect(dukeWinning(trick, null, roleOf, "duke")).toBeUndefined();
  });

  it("does not touch the roles that work whoever wins", () => {
    const trick = [play("ana", 14), play("thief", 1)];

    expect(powerOn(trick, 1, "thief", null, roleOf)).toBe(true);
    expect(wizardBlocked(trick, 1, null, roleOf)).toBeUndefined();
  });

  it("says nothing about an off-suit card that had no power anyway", () => {
    const trick = [play("ana", 5), play("ben", 14), play("gam", 10, "Green")];

    expect(wizardBlocked(trick, 2, "Blue", roleOf)).toBeUndefined();
  });
});
