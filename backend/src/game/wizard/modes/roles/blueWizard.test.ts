import { describe, it, expect } from "vitest";

import type { GamePlayer } from "../../models/wizardGame.js";
import { blueCardCount, blueSight } from "./blueWizard.js";
import { card } from "./roleTestHelpers.js";
import type { RoleId } from "./roles.js";

const player = (username: string, role: RoleId, hand = [card(3, "Blue")]): GamePlayer =>
  ({ username, role, hand }) as unknown as GamePlayer;

describe("the Blue Wizard's sight", () => {
  it("counts blue cards, never a Wizard or Jester of the Blue suit", () => {
    expect(blueCardCount([card(3, "Blue"), card(13, "Blue"), card(14, "Blue"), card(0, "Blue"), card(5, "Red")])).toBe(2);
  });

  it("is told only to a Blue Wizard, and only about hidden hands", () => {
    const seer = player("ann", "blueWizard");
    const other = player("bo", "thief", [card(3, "Blue"), card(4, "Green")]);

    expect(blueSight(seer, other, false)).toBe(1);
    expect(blueSight(seer, other, true)).toBeUndefined();
    expect(blueSight(player("cy", "thief"), other, false)).toBeUndefined();
  });
});
