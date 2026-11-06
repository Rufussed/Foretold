import { describe, expect, it } from "vitest";

import { WizardGameService } from "../../services/wizardGameService.js";
import { blueSight } from "./master/blueWizard.js";
import { playsFree } from "./master/joker.js";
import { GREEN_BOOST } from "./master/greenWizard.js";
import { trickRolesIn } from "./master/trickRoles.js";
import { rolesOf } from "./rolePowers.js";
import { masterRoleOf, rolesHeld } from "./roles.js";
import { isPairRoom } from "./rolePairs.js";

const rolesGame = () => {
  const game = new WizardGameService().createGame(1, ["ann", "bob", "cid"]);
  game.options = { ...game.options!, mode: "roles" };
  return game;
};

describe("basic + master roles", () => {
  it("reads the master role from its own slot, or from the one role of an older game", () => {
    expect(masterRoleOf({ role: "fisher", masterRole: "joker" })).toBe("joker");
    expect(masterRoleOf({ role: "joker" })).toBe("joker");
    expect(masterRoleOf({ role: "fisher" })).toBeUndefined();
    expect(rolesHeld({ role: "fisher", masterRole: "joker" })).toEqual(["fisher", "joker"]);
  });

  it("gives card powers the basic role and master powers the master role", () => {
    const game = rolesGame();
    const [ann, bob] = game.players;
    ann!.role = "fisher";
    ann!.masterRole = "greenWizard";
    const roleOf = rolesOf(game);
    expect(roleOf("ann")).toBe("fisher");
    expect(roleOf.masterOf?.("ann")).toBe("greenWizard");

    const boost = trickRolesIn(game)!.boostOf!({ username: "ann", card: { value: 5, suit: "Green" } } as never);
    expect(boost).toBe(GREEN_BOOST);

    ann!.masterRole = "blueWizard";
    bob!.hand = [{ value: 3, suit: "Blue" }];
    expect(blueSight(ann!, bob!, false)).toBe(1);

    ann!.masterRole = "joker";
    ann!.jokerPoints = 1;
    expect(playsFree(ann!)).toBe(true);
  });

  it("is a basic + master room only in Roles mode with the option on", () => {
    expect(isPairRoom({ mode: "roles", rolePair: true })).toBe(true);
    expect(isPairRoom({ mode: "roles", rolePair: false })).toBe(false);
    expect(isPairRoom({ mode: "classic", rolePair: true })).toBe(false);
  });
});
