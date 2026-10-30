import { describe, it, expect } from "vitest";

import type { GamePlayer } from "../../models/wizardGame.js";
import { BLUE_WIZARD_BONUS, blueCardCount, blueSight, blueWizardBonus } from "./blueWizard.js";
import { card, play } from "./roleTestHelpers.js";
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

describe("the blue Wizard's bonus", () => {
  const trick = (cards: ReturnType<typeof play>[]) => ({ playedCards: cards, winnerUsername: null });

  it("pays a Blue Wizard who wins with the Wizard of the Blue suit", () => {
    const won = trick([play("ann", 14, "Blue"), play("bo", 13, "Red")]);
    expect(blueWizardBonus(won, player("ann", "blueWizard"))).toBe(BLUE_WIZARD_BONUS);
  });

  it("pays nothing for another Wizard, or to another role", () => {
    expect(blueWizardBonus(trick([play("ann", 14, "Red")]), player("ann", "blueWizard"))).toBe(0);
    expect(blueWizardBonus(trick([play("ann", 14, "Blue")]), player("ann", "thief"))).toBe(0);
  });
});
