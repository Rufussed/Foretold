import { describe, it, expect } from "vitest";

import { WizardGameService } from "../../services/wizardGameService.js";
import { assignRoles, randomRole } from "./assignRoles.js";
import { ROLES, roleKind } from "./roles.js";

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

  it("never draws a role a player chose", () => {
    const names = ["alice", "bob", "a NPC", "b NPC", "c NPC", "d NPC"];
    for (let run = 0; run < 50; run++) {
      const game = new WizardGameService().createGame(1, names);
      const chosen = new Map<string, (typeof ROLES)[number]["id"] | null>([["alice", "farmer"], ["bob", "smith"]]);
      assignRoles(game.players, chosen);
      const drawn = game.players.slice(2).map((player) => player.role);
      expect(drawn).not.toContain("farmer");
      expect(drawn).not.toContain("smith");
      expect(new Set(drawn).size).toBe(drawn.length);
    }
  });

  it("draws every role, the last one included", () => {
    ROLES.forEach(({ id }, index) => {
      expect(randomRole(() => (index + 0.5) / ROLES.length)).toBe(id);
    });
    expect(randomRole(() => 0.999)).toBe(ROLES.at(-1)!.id);
  });
  it("gives NPCs only the kind the host chose, and players any role", () => {
    const names = ["alice", "a NPC", "b NPC", "c NPC", "d NPC", "e NPC"];
    for (const kind of ["basic", "master"] as const) {
      for (let run = 0; run < 20; run++) {
        const game = new WizardGameService().createGame(1, names);
        assignRoles(game.players, new Map(), Math.random, kind);
        const npcs = game.players.filter((player) => player.username.endsWith(" NPC"));
        for (const npc of npcs) expect(roleKind(npc.role!)).toBe(kind);
      }
    }
  });
});
