import { describe, expect, it } from "vitest";

import { WizardGameService } from "../../../services/wizardGameService.js";
import { pickWatchedCards, watchedCount, watcherSight } from "./watcher.js";

describe("Watcher", () => {
  it("watches 2 Wizards and 2 Jesters, all different", () => {
    for (let run = 0; run < 30; run++) {
      const watched = pickWatchedCards();
      expect(watched.filter((card) => card.value === 14)).toHaveLength(2);
      expect(watched.filter((card) => card.value === 0)).toHaveLength(2);
      expect(new Set(watched.map((card) => `${card.value}${card.suit}`)).size).toBe(4);
    }
  });

  it("counts only the watched cards in a hand", () => {
    const watched = [
      { value: 14, suit: "Blue" },
      { value: 14, suit: "Red" },
      { value: 0, suit: "Green" },
      { value: 0, suit: "Yellow" },
    ] as const;
    const hand = [
      { value: 14, suit: "Blue" },
      { value: 14, suit: "Green" },
      { value: 0, suit: "Yellow" },
      { value: 7, suit: "Red" },
    ] as const;
    expect(watchedCount([...hand], [...watched])).toBe(2);
  });

  it("tells only a Watcher, and only about hidden hands", () => {
    const game = new WizardGameService().createGame(1, ["ann", "bob", "cid"]);
    const [ann, bob] = game.players;
    game.watchedCards = [{ value: 14, suit: "Blue" }];
    bob!.hand = [{ value: 14, suit: "Blue" }];
    expect(watcherSight(game, ann!, bob!, false)).toBeUndefined();
    ann!.role = "watcher";
    expect(watcherSight(game, ann!, bob!, false)).toBe(1);
    expect(watcherSight(game, ann!, bob!, true)).toBeUndefined();
  });
});
