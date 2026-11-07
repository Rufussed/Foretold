import { describe, it, expect } from "vitest";

import { WizardRules } from "../../../services/wizardRules.js";
import { play } from "../roleTestHelpers.js";
import { trickRolesIn } from "./trickRoles.js";
import { burnsWinner, FIRE_BURN } from "./colourWizards.js";
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

  it("holds against a Yellow Wizard who comes after: the lead stays red", () => {
    const plays = [play("bo", 5, "Red"), play("rw", 9, "Red"), play("yw", 6, "Yellow"), play("cy", 2, "Blue")];
    expect(rules.getLeadSuit(plays, "Blue", roles)).toBe("Red");
    expect(winner(...plays)).toBe("rw");
  });

  it("never starts when a Yellow Wizard turned the lead first", () => {
    const plays = [play("bo", 5, "Red"), play("yw", 6, "Yellow"), play("rw", 9, "Red"), play("cy", 2, "Blue")];
    expect(rules.getLeadSuit(plays, "Blue", roles)).toBe("Yellow");
    expect(winner(...plays)).toBe("cy");
  });

  it("holds from the first card when the Red Wizard leads red", () => {
    // The trick from a played game: Fire 4 led by the Fire power, a Wizard,
    // then the Air power's 11 may not turn the lead.
    const plays = [play("rw", 4, "Red"), play("cy", 14, "Green"), play("bo", 7, "Red"), play("yw", 11, "Yellow")];
    expect(rules.getLeadSuit(plays, "Blue", roles)).toBe("Red");
    expect(rules.redShield(plays, "Blue", roles)).toBe(true);
  });
});

describe("the Red Wizard's burn", () => {
  const player = (username: string, role: RoleId) => ({ username, role }) as never;
  const trick = (plays: ReturnType<typeof play>[]) => ({ playedCards: plays, winnerUsername: null });

  it("burns a higher red card that beat the shield", () => {
    const plays = [play("bo", 5, "Red"), play("rw", 9, "Red"), play("cy", 2, "Blue"), play("yw", 11, "Red")];
    expect(burnsWinner(trick(plays), "Blue", roles, player("yw", "yellowWizard"))).toBe(true);
    expect(FIRE_BURN).toBe(5);
  });

  it("burns no one without the shield, for a Wizard, or the Red Wizard's own win", () => {
    const noShield = [play("bo", 5, "Red"), play("cy", 9, "Red")];
    expect(burnsWinner(trick(noShield), "Blue", roles, player("cy", "farmer"))).toBe(false);
    const wizard = [play("bo", 5, "Red"), play("rw", 9, "Red"), play("cy", 14, "Green")];
    expect(burnsWinner(trick(wizard), "Blue", roles, player("cy", "farmer"))).toBe(false);
    const own = [play("bo", 5, "Red"), play("rw", 9, "Red")];
    expect(burnsWinner(trick(own), "Blue", roles, player("rw", "redWizard"))).toBe(false);
  });
});
