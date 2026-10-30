import { describe, it, expect } from "vitest";

import type { GamePlayer } from "../../models/wizardGame.js";
import { WizardRules } from "../../services/wizardRules.js";
import { GREEN_WIZARD_BONUS, greenBoostIn, greenWizardBonus } from "./greenWizard.js";
import { play } from "./roleTestHelpers.js";
import type { RoleId } from "./roles.js";

const rules = new WizardRules();
const game = (roles: Record<string, RoleId>) => ({
  options: { mode: "roles" as const },
  players: Object.entries(roles).map(([username, role]) => ({ username, role })),
});
const table = game({ gw: "greenWizard", bo: "thief" });
const winner = (...plays: ReturnType<typeof play>[]) =>
  rules.determineTrickWinner(plays, "Red", "first", greenBoostIn(table));

describe("the Green Wizard's green cards", () => {
  it("count 3 higher: a 12 beats a 13", () => {
    expect(winner(play("gw", 12, "Green"), play("bo", 13, "Green"))).toBe("gw");
    expect(winner(play("bo", 13, "Green"), play("gw", 12, "Green"))).toBe("gw");
  });

  it("lose when they only draw level: a 7 against a 10", () => {
    expect(winner(play("gw", 7, "Green"), play("bo", 10, "Green"))).toBe("bo");
    expect(winner(play("bo", 10, "Green"), play("gw", 7, "Green"))).toBe("bo");
  });

  it("still lose to a trump and a Wizard, and other suits are not raised", () => {
    expect(winner(play("gw", 13, "Green"), play("bo", 2, "Red"))).toBe("bo");
    expect(winner(play("gw", 13, "Green"), play("bo", 14, "Blue"))).toBe("bo");
    expect(winner(play("gw", 9, "Blue"), play("bo", 11, "Blue"))).toBe("bo");
  });

  it("are raised only in a Roles game with a Green Wizard", () => {
    expect(greenBoostIn({ options: { mode: "classic" }, players: [{ username: "gw", role: "greenWizard" }] })).toBeUndefined();
    expect(greenBoostIn(game({ bo: "thief" }))).toBeUndefined();
  });
});

describe("the green Wizard's bonus", () => {
  const trick = (cards: ReturnType<typeof play>[]) => ({ playedCards: cards, winnerUsername: null });
  const player = (username: string, role: RoleId) => ({ username, role }) as unknown as GamePlayer;

  it("pays a Green Wizard who wins with the Wizard of the Green suit", () => {
    expect(greenWizardBonus(trick([play("gw", 14, "Green")]), player("gw", "greenWizard"))).toBe(GREEN_WIZARD_BONUS);
    expect(greenWizardBonus(trick([play("gw", 14, "Red")]), player("gw", "greenWizard"))).toBe(0);
    expect(greenWizardBonus(trick([play("gw", 14, "Green")]), player("gw", "thief"))).toBe(0);
  });
});
