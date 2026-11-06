import { describe, it, expect } from "vitest";

import { WizardGameService } from "../../services/wizardGameService.js";
import { assignRoles, randomRole, type ChosenRoles } from "./assignRoles.js";
import { ROLES, roleKind, rolesOfKind } from "./roles.js";

const basics = rolesOfKind("basic").map((role) => role.id);

describe("assignRoles", () => {
  it("keeps each chosen role and draws a basic one for the rest", () => {
    const game = new WizardGameService().createGame(1, ["alice", "bob", "Merlin NPC"]);

    assignRoles(
      game.players,
      new Map<string, ChosenRoles>([["alice", { role: "thief" }], ["bob", { role: null }]]),
      { random: () => 0.99 },
    );

    const roles = Object.fromEntries(game.players.map((player) => [player.username, player.role]));
    expect(roles).toEqual({ alice: "thief", bob: basics.at(-1), "Merlin NPC": basics.at(-2) });
  });

  it("never draws the same role twice", () => {
    const names = ["a NPC", "b NPC", "c NPC", "d NPC", "e NPC", "f NPC"];
    for (let run = 0; run < 50; run++) {
      const game = new WizardGameService().createGame(1, names);
      assignRoles(game.players, new Map(), { pair: true });
      expect(new Set(game.players.map((player) => player.role)).size).toBe(names.length);
      expect(new Set(game.players.map((player) => player.masterRole)).size).toBe(names.length);
    }
  });

  it("never draws a role a player chose", () => {
    const names = ["alice", "bob", "a NPC", "b NPC", "c NPC", "d NPC"];
    for (let run = 0; run < 50; run++) {
      const game = new WizardGameService().createGame(1, names);
      const chosen = new Map<string, ChosenRoles>([["alice", { role: "farmer" }], ["bob", { role: "smith" }]]);
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

  it("gives everyone one basic role only in a one-role game, a master chosen too", () => {
    for (let run = 0; run < 20; run++) {
      const game = new WizardGameService().createGame(1, ["alice", "a NPC", "b NPC", "c NPC"]);
      assignRoles(game.players, new Map<string, ChosenRoles>([["alice", { role: "joker" as never, masterRole: "joker" }]]));
      for (const player of game.players) {
        expect(roleKind(player.role!)).toBe("basic");
        expect(player.masterRole).toBeUndefined();
      }
    }
  });

  it("gives everyone one basic and one master role in a basic + master game", () => {
    for (let run = 0; run < 20; run++) {
      const game = new WizardGameService().createGame(1, ["alice", "a NPC", "b NPC", "c NPC"]);
      assignRoles(game.players, new Map<string, ChosenRoles>([["alice", { role: "duke", masterRole: "joker" }]]), { pair: true });
      const alice = game.players.find((player) => player.username === "alice")!;
      expect([alice.role, alice.masterRole]).toEqual(["duke", "joker"]);
      for (const player of game.players) {
        expect(roleKind(player.role!)).toBe("basic");
        expect(roleKind(player.masterRole!)).toBe("master");
      }
    }
  });

  it("draws a player's random roles only from the roles open to them", () => {
    for (let run = 0; run < 30; run++) {
      const game = new WizardGameService().createGame(1, ["alice", "bob", "carol"]);
      const openFor = (name: string) =>
        name === "alice" ? (["fisher", "watcher"] as const) : name === "bob" ? (["thief", "servant"] as const) : (["farmer"] as const);
      assignRoles(game.players, new Map(), { pair: true, openFor });
      const [alice, bob] = game.players;
      expect([alice!.role, alice!.masterRole]).toEqual(["fisher", "watcher"]);
      expect(["thief", "servant"]).toContain(bob!.role);
      // Bob has no master open: he gets none.
      expect(bob!.masterRole).toBeUndefined();
    }
  });
});
