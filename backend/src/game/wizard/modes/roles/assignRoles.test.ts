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
    const beforeLast = ROLES.at(-2)!.id;
    expect(roles).toEqual({ alice: "thief", bob: last, "Merlin NPC": beforeLast });
  });

  it("never draws the same role twice, basic and master roles alike", () => {
    const names = ["a NPC", "b NPC", "c NPC", "d NPC", "e NPC", "f NPC"];
    for (let run = 0; run < 50; run++) {
      const game = new WizardGameService().createGame(1, names);
      assignRoles(game.players, new Map());
      expect(new Set(game.players.map((player) => player.role)).size).toBe(names.length);
    }
  });

  it("draws every role, the last one included", () => {
    ROLES.forEach(({ id }, index) => {
      expect(randomRole(() => (index + 0.5) / ROLES.length)).toBe(id);
    });
    expect(randomRole(() => 0.999)).toBe(ROLES.at(-1)!.id);
  });
});
