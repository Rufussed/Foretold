import { describe, expect, it } from "vitest";

import { COLOR_MASTERY_POINTS } from "../../strongColor.js";
import { openRoles, START_ROLES } from "./roleLocks.js";
import { rolesOfKind } from "./roles.js";
import { SEAL_LEVELS } from "./sealLevels.js";

const basics = rolesOfKind("basic").map((role) => role.id);
const masters = rolesOfKind("master").map((role) => role.id);
const at = (level: string) => SEAL_LEVELS.find((entry) => entry.id === level)!.at;
const seal = (level: string) => (role: string) => ({ role, games: at(level), wins: 0 }) as never;

describe("openRoles", () => {
  it("opens the first basic roles to a new player", () => {
    expect(openRoles([], false)).toEqual(basics.slice(0, START_ROLES));
  });

  it("opens the next basic role for each Wood seal", () => {
    const records = [seal("wood")("thief"), seal("wood")("fisher"), { role: "servant", games: at("wood") - 1, wins: 0 } as never];
    expect(openRoles(records, false)).toEqual(basics.slice(0, START_ROLES + 2));
  });

  it("opens a colour Wizard only with every basic seal Wood and its colour mastered", () => {
    const blue = { Blue: COLOR_MASTERY_POINTS };
    expect(openRoles(basics.slice(1).map(seal("wood")), false, blue)).not.toContain("blueWizard");
    const open = openRoles(basics.map(seal("wood")), false, blue);
    expect(open).toContain("blueWizard");
    expect(open).not.toContain("redWizard");
    expect(open).not.toContain("joker");
  });

  it("opens only the free Watcher with every basic seal Wood alone", () => {
    expect(openRoles(basics.map(seal("wood")), false)).toEqual([...basics, "watcher"]);
  });

  it("opens the Joker with every basic seal Copper", () => {
    expect(openRoles(basics.map(seal("copper")), false)).toEqual([...basics, "joker", "watcher"]);
  });

  it("opens everything for an account opened by hand", () => {
    expect(openRoles([], true)).toEqual([...basics, ...masters]);
  });
});
