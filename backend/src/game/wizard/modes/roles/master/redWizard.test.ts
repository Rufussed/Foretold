import { describe, it, expect } from "vitest";

import { WizardRules } from "../../../services/wizardRules.js";
import { play } from "../roleTestHelpers.js";
import { trickRolesIn } from "./trickRoles.js";
import type { RoleId } from "../roles.js";

const rules = new WizardRules();
const game = (roles: Record<string, RoleId>) => ({
  options: { mode: "roles" as const },
  players: Object.entries(roles).map(([username, role]) => ({ username, role })),
});
const roles = trickRolesIn(game({ rw: "redWizard", yw: "yellowWizard", bo: "thief", cy: "farmer" }));
const winner = (...plays: ReturnType<typeof play>[]) => rules.determineTrickWinner(plays, "Blue", "first", roles);

describe("the Red Wizard's shield", () => {
  it("keeps a trump from beating the Red Wizard's red card on a red lead", () => {
    expect(winner(play("bo", 5, "Red"), play("rw", 9, "Red"), play("cy", 2, "Blue"))).toBe("rw");
    expect(winner(play("rw", 4, "Red"), play("cy", 13, "Blue"))).toBe("rw");
  });

  it("takes the trumps out of the whole trick: a higher red still wins", () => {
    expect(winner(play("bo", 5, "Red"), play("rw", 9, "Red"), play("cy", 3, "Blue"), play("yw", 11, "Red"))).toBe("yw");
  });

  it("still loses to a Wizard", () => {
    expect(winner(play("bo", 5, "Red"), play("rw", 9, "Red"), play("cy", 14, "Green"))).toBe("cy");
  });

  it("needs a red lead and the Red Wizard's own red card", () => {
    expect(winner(play("bo", 5, "Green"), play("rw", 9, "Red"), play("cy", 2, "Blue"))).toBe("cy");
    expect(winner(play("bo", 5, "Red"), play("rw", 3, "Green"), play("cy", 2, "Blue"))).toBe("cy");
    expect(winner(play("bo", 5, "Red"), play("yw", 9, "Red"), play("cy", 2, "Blue"))).toBe("cy");
  });

  it("ends when a Yellow Wizard turns the lead to yellow", () => {
    expect(winner(play("bo", 5, "Red"), play("rw", 9, "Red"), play("yw", 6, "Yellow"), play("cy", 2, "Blue"))).toBe("cy");
  });
});
