import { describe, it, expect } from "vitest";

import { WizardGameService } from "../../services/wizardGameService.js";
import { assignRoles, randomRole } from "./assignRoles.js";

describe("assignRoles", () => {
  it("keeps each chosen role and draws one for the rest", () => {
    const game = new WizardGameService().createGame(1, ["alice", "bob", "Merlin NPC"]);

    assignRoles(
      game.players,
      new Map([["alice", "thief"], ["bob", null]]),
      () => 0.99,
    );

    const roles = Object.fromEntries(game.players.map((player) => [player.username, player.role]));
    expect(roles).toEqual({ alice: "thief", bob: "farmer", "Merlin NPC": "farmer" });
  });

  it("draws every role, the last one included", () => {
    expect(randomRole(() => 0)).toBe("thief");
    expect(randomRole(() => 0.3)).toBe("servant");
    expect(randomRole(() => 0.6)).toBe("fisher");
    expect(randomRole(() => 0.999)).toBe("farmer");
  });
});
