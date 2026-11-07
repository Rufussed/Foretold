import { describe, it, expect } from "vitest";

import type { GamePlayer } from "../../../models/wizardGame.js";
import { COLOUR_WIZARDS, GREEN_CARD_BONUS, colourWizardBonus } from "./colourWizards.js";
import { play } from "../roleTestHelpers.js";
import type { RoleId } from "../roles.js";

const player = (username: string, role: RoleId) => ({ username, role }) as unknown as GamePlayer;
const trick = (cards: ReturnType<typeof play>[]) => ({ playedCards: cards, winnerUsername: null });

describe("the colour Wizards' bonus", () => {
  it("pays each for a trick won with the Wizard of their colour", () => {
    expect(colourWizardBonus(trick([play("ann", 14, "Blue")]), player("ann", "blueWizard"))).toBe(COLOUR_WIZARDS.blueWizard.bonus);
    expect(colourWizardBonus(trick([play("ann", 14, "Green")]), player("ann", "greenWizard"))).toBe(COLOUR_WIZARDS.greenWizard.bonus);
    expect(colourWizardBonus(trick([play("ann", 14, "Yellow")]), player("ann", "yellowWizard"))).toBe(COLOUR_WIZARDS.yellowWizard.bonus);
    expect(colourWizardBonus(trick([play("ann", 14, "Red")]), player("ann", "redWizard"))).toBe(COLOUR_WIZARDS.redWizard.bonus);
  });

  it("pays the Green Wizard less for a trick won with any green card", () => {
    expect(colourWizardBonus(trick([play("ann", 7, "Green")]), player("ann", "greenWizard"))).toBe(GREEN_CARD_BONUS);
    expect(colourWizardBonus(trick([play("ann", 7, "Red")]), player("ann", "greenWizard"))).toBe(0);
    expect(colourWizardBonus(trick([play("ann", 0, "Green")]), player("ann", "greenWizard"))).toBe(0);
  });

  it("pays the Blue Wizard 10 more than the others", () => {
    expect(COLOUR_WIZARDS.blueWizard.bonus).toBe(COLOUR_WIZARDS.greenWizard.bonus + 10);
    expect(COLOUR_WIZARDS.redWizard.bonus).toBe(COLOUR_WIZARDS.yellowWizard.bonus);
  });

  it("pays nothing for another colour's Wizard, another card, or another role", () => {
    expect(colourWizardBonus(trick([play("ann", 14, "Red")]), player("ann", "yellowWizard"))).toBe(0);
    expect(colourWizardBonus(trick([play("ann", 13, "Yellow")]), player("ann", "yellowWizard"))).toBe(0);
    expect(colourWizardBonus(trick([play("ann", 14, "Blue")]), player("ann", "thief"))).toBe(0);
  });
});
