import { describe, it, expect } from "vitest";

import { WizardGameService } from "../../services/wizardGameService.js";
import { assignRoles, randomRole } from "./assignRoles.js";
import { ROLES } from "./roles.js";

describe("assignRoles", () => {
  it("keeps each chosen role and draws one for the rest", () => {
    const game = new WizardGameService().createGame(1, ["alice", "bob", "Merlin NPC"]);

    assignRoles(
      game.players,
      new Map([["alice", "thief"], ["bob", null]]),
      () => 0.99,
    );

    const roles = Object.fromEntries(game.players.map((player) => [player.username, player.role]));
    const last = ROLES.at(-1)!.id;
    expect(roles).toEqual({ alice: "thief", bob: last, "Merlin NPC": last });
  });

  it("draws every role, the last one included", () => {
    ROLES.forEach(({ id }, index) => {
      expect(randomRole(() => (index + 0.5) / ROLES.length)).toBe(id);
    });
    expect(randomRole(() => 0.999)).toBe(ROLES.at(-1)!.id);
  });
});
