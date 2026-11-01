import { describe, it, expect } from "vitest";

import { WizardGameService } from "../../services/wizardGameService.js";
import { devGiveRoleCard } from "./devTools.js";
import { card } from "./roleTestHelpers.js";

function table() {
  const game = new WizardGameService().createGame(1, ["me", "bot NPC", "other NPC"]);
  const [me, bot] = game.players;
  me!.role = "shepherd";
  me!.hand = [card(9, "Red"), card(2, "Blue")];
  bot!.hand = [card(5, "Blue"), card(11, "Green")];
  game.players[2]!.hand = [];
  game.trumpSuit = "Blue";
  return { game, me: me!, bot: bot! };
}

describe("devGiveRoleCard", () => {
  it("gives the role's card in trumps, trading places with whoever held it", () => {
    const { game, me, bot } = table();
    devGiveRoleCard(game, "me", true, 0);

    expect(me.hand[0]).toEqual(card(5, "Blue"));
    expect(bot.hand[0]).toEqual(card(9, "Red"));
  });

  it("gives it in a plain suit, never trumps, and in plain suits with no trumps", () => {
    const { game, me } = table();
    devGiveRoleCard(game, "me", false, 1);
    expect(me.hand[1]!.suit).not.toBe("Blue");
    expect(me.hand[1]!.value).toBe(5);

    game.trumpSuit = null;
    devGiveRoleCard(game, "me", true, 0);
    expect(me.hand[0]).toEqual(card(5, "Red"));
  });

  it("refuses a role with no card", () => {
    const { game, me } = table();
    me.role = "blueWizard";
    expect(() => devGiveRoleCard(game, "me", true, 0)).toThrow("[dev]");
  });
});
