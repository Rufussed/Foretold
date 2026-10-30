import { describe, it, expect } from "vitest";

import { WizardRules } from "../../services/wizardRules.js";
import { play } from "./roleTestHelpers.js";
import { trickRolesIn } from "./trickRoles.js";
import type { RoleId } from "./roles.js";

const rules = new WizardRules();
const game = (roles: Record<string, RoleId>) => ({
  options: { mode: "roles" as const },
  players: Object.entries(roles).map(([username, role]) => ({ username, role })),
});
const roles = trickRolesIn(game({ yw: "yellowWizard", bo: "thief", cy: "farmer" }));
const lead = (trump: "Red" | "Green" | "Yellow" | null, ...plays: ReturnType<typeof play>[]) =>
  rules.getLeadSuit(plays, trump, roles);
const winner = (trump: "Red" | "Green" | "Yellow" | null, ...plays: ReturnType<typeof play>[]) =>
  rules.determineTrickWinner(plays, trump, "first", roles);

describe("the Yellow Wizard's lead switch", () => {
  it("makes yellow the lead suit with a yellow card above the lead card", () => {
    expect(lead("Green", play("bo", 5, "Red"), play("yw", 6, "Yellow"))).toBe("Yellow");
    expect(winner("Green", play("bo", 5, "Red"), play("yw", 6, "Yellow"))).toBe("yw");
  });

  it("changes nothing with a yellow card at or below the lead card", () => {
    expect(lead("Green", play("bo", 8, "Red"), play("yw", 8, "Yellow"))).toBe("Red");
    expect(winner("Green", play("bo", 8, "Red"), play("yw", 3, "Yellow"))).toBe("bo");
  });

  it("makes the players after it follow yellow, so a higher yellow beats it", () => {
    expect(winner("Green", play("bo", 5, "Red"), play("yw", 6, "Yellow"), play("cy", 9, "Yellow"))).toBe("cy");
    expect(winner("Green", play("bo", 5, "Red"), play("yw", 6, "Yellow"), play("cy", 13, "Red"))).toBe("yw");
  });

  it("still loses to a trump and a Wizard", () => {
    expect(winner("Green", play("bo", 5, "Red"), play("yw", 6, "Yellow"), play("cy", 2, "Green"))).toBe("cy");
    expect(winner("Green", play("bo", 5, "Red"), play("yw", 6, "Yellow"), play("cy", 14, "Blue"))).toBe("cy");
  });

  it("does nothing when yellow is trumps or already led, or for anyone else", () => {
    expect(lead("Yellow", play("bo", 5, "Red"), play("yw", 6, "Yellow"))).toBe("Red");
    expect(lead("Green", play("bo", 5, "Yellow"), play("yw", 6, "Yellow"))).toBe("Yellow");
    expect(lead("Green", play("cy", 5, "Red"), play("bo", 6, "Yellow"))).toBe("Red");
  });

  it("goes by the first number card when a Jester leads", () => {
    expect(lead("Green", play("cy", 0, "Blue"), play("bo", 5, "Red"), play("yw", 6, "Yellow"))).toBe("Yellow");
  });
});
