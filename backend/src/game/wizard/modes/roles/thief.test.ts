import { describe, it, expect } from "vitest";

import type { Card, CardValue, Suit } from "../../models/card.js";
import type { PlayedCard } from "../../models/wizardGame.js";
import { DEFAULT_GAME_OPTIONS } from "../../gameOptions.js";
import { WizardGameService } from "../../services/wizardGameService.js";
import { applySteal, findSteal } from "./thief.js";

const card = (value: CardValue, suit: Suit = "Red"): Card => ({ value, suit });
const play = (username: string, value: CardValue, suit: Suit = "Red"): PlayedCard => ({
  username,
  card: card(value, suit),
});

describe("findSteal", () => {
  it("takes the card just before a 1 in the lead suit", () => {
    const trick = [play("ana", 8), play("ben", 13), play("thief", 1)];

    expect(findSteal(trick, null)).toEqual({
      role: "thief",
      by: "thief",
      on: "ben",
      card: card(13),
    });
  });

  it("steals with a 1 played as a trump", () => {
    const trick = [play("ana", 8), play("ben", 13), play("thief", 1, "Blue")];

    expect(findSteal(trick, "Blue")?.on).toBe("ben");
  });

  it("does nothing with a 1 that is neither the lead suit nor a trump", () => {
    const trick = [play("ana", 8), play("ben", 13), play("thief", 1, "Green")];

    expect(findSteal(trick, "Blue")).toBeNull();
  });

  it("does nothing when the 1 leads the trick", () => {
    expect(findSteal([play("thief", 1)], null)).toBeNull();
  });

  it("leaves Wizards and Jesters alone", () => {
    expect(findSteal([play("ana", 5), play("ben", 14), play("thief", 1)], null)).toBeNull();
    expect(findSteal([play("ana", 5), play("ben", 0), play("thief", 1)], null)).toBeNull();
  });

  it("must take a worse card too", () => {
    const trick = [play("ana", 9), play("ben", 2), play("thief", 1)];

    expect(findSteal(trick, null)?.card).toEqual(card(2));
  });
});

describe("applySteal", () => {
  it("swaps the owners of the 1 and the card before it", () => {
    const trick = [play("ana", 8), play("ben", 13), play("thief", 1)];

    applySteal(trick);

    expect(trick.map(({ username, card }) => [username, card.value])).toEqual([
      ["ana", 8],
      ["thief", 13],
      ["ben", 1],
    ]);
  });
});

describe("the Thief in a game", () => {
  // Ana leads 8 Red, Ben plays 13 Red, the Thief plays 1 Red.
  const playTrick = (mode: "classic" | "roles") => {
    const service = new WizardGameService();
    const game = service.createGame(1, ["ana", "ben", "thief"], new Map(), 1, 1, {
      ...DEFAULT_GAME_OPTIONS,
      mode,
    });
    const [ana, ben, thief] = game.players;
    if (!ana || !ben || !thief) throw new Error("three players expected");

    thief.role = "thief";
    ana.hand = [card(8)];
    ben.hand = [card(13)];
    thief.hand = [card(1)];
    game.players = [ana, ben, thief];
    game.trumpSuit = null;
    game.phase = "playing";
    game.currentPlayerIndex = 0;
    game.currentTrick = { playedCards: [], winnerUsername: null };

    for (let turn = 0; turn < 3; turn++) {
      service.playCard(game, 0);
    }

    return game.currentTrick;
  };

  it("wins the trick with the stolen 13 in a Roles game", () => {
    const trick = playTrick("roles");

    expect(trick.winnerUsername).toBe("thief");
    expect(trick.roleActions).toEqual([
      { role: "thief", by: "thief", on: "ben", card: card(13) },
    ]);
  });

  it("is an ordinary 1 in a Classic game", () => {
    const trick = playTrick("classic");

    expect(trick.winnerUsername).toBe("ben");
    expect(trick.roleActions).toBeUndefined();
  });
});
