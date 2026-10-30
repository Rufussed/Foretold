import { describe, it, expect } from "vitest";

import type { GamePlayer } from "../../../models/wizardGame.js";
import { COLOUR_WIZARDS, colourWizardBonus } from "./colourWizards.js";
import { play } from "../roleTestHelpers.js";
import type { RoleId } from "../roles.js";

const player = (username: string, role: RoleId) => ({ username, role }) as unknown as GamePlayer;
const trick = (cards: ReturnType<typeof play>[]) => ({ playedCards: cards, winnerUsername: null });

describe("the colour Wizards' bonus", () => {
  it("pays each for a trick won with the Wizard of their colour: 10 each", () => {
    expect(colourWizardBonus(trick([play("ann", 14, "Blue")]), player("ann", "blueWizard"))).toBe(10);
    expect(colourWizardBonus(trick([play("ann", 14, "Green")]), player("ann", "greenWizard"))).toBe(10);
    expect(colourWizardBonus(trick([play("ann", 14, "Yellow")]), player("ann", "yellowWizard"))).toBe(10);
    expect(colourWizardBonus(trick([play("ann", 14, "Red")]), player("ann", "redWizard"))).toBe(10);
    expect(COLOUR_WIZARDS.blueWizard.bonus).toBe(10);
  });

  it("pays nothing for another colour's Wizard, another card, or another role", () => {
    expect(colourWizardBonus(trick([play("ann", 14, "Red")]), player("ann", "yellowWizard"))).toBe(0);
    expect(colourWizardBonus(trick([play("ann", 13, "Yellow")]), player("ann", "yellowWizard"))).toBe(0);
    expect(colourWizardBonus(trick([play("ann", 14, "Blue")]), player("ann", "thief"))).toBe(0);
  });
});
