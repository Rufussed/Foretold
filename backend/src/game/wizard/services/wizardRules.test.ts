import { describe, it, expect } from "vitest";

import { WizardRules } from "./wizardRules.js";

import type { Card } from "../models/card.js";

const rules = new WizardRules();

const blueSeven: Card = {
  value: 7,
  suit: "Blue",
};

const blueTen: Card = {
  value: 10,
  suit: "Blue",
};

const redTwo: Card = {
  value: 2,
  suit: "Red",
};

const wizard: Card = {
  value: 14,
  suit: "Green",
};

const jester: Card = {
  value: 0,
  suit: "Yellow",
};

describe("WizardRules", () => {
  describe("getTrumpSuit", () => {
    it("returns the suit of a normal trump card", () => {
      expect(rules.getTrumpSuit(redTwo)).toBe("Red");
    });

    it("returns null when the trump card is a Wizard", () => {
      expect(rules.getTrumpSuit(wizard)).toBeNull();
    });

    it("returns null when the trump card is a Jester", () => {
      expect(rules.getTrumpSuit(jester)).toBeNull();
    });
    it("has no trump suit when the trump card is a Wizard", () => {
      const trumpSuit = rules.getTrumpSuit(wizard);

      expect(trumpSuit).toBeNull();
    });
  });

  describe("isValidCardPlay", () => {
    it("allows a card that follows the lead suit", () => {
      expect(
        rules.isValidCardPlay(
          blueSeven,
          [blueSeven, redTwo],
          "Blue",
        ),
      ).toBe(true);
    });

    it("rejects a card that does not follow the lead suit when the player has the suit", () => {
      expect(
        rules.isValidCardPlay(
          redTwo,
          [blueSeven, redTwo],
          "Blue",
        ),
      ).toBe(false);
    });

    it("allows any card when the player does not have the lead suit", () => {
      expect(
        rules.isValidCardPlay(
          redTwo,
          [redTwo],
          "Blue",
        ),
      ).toBe(true);
    });

    it("always allows a Wizard", () => {
      expect(
        rules.isValidCardPlay(
          wizard,
          [blueSeven, wizard],
          "Blue",
        ),
      ).toBe(true);
    });
  });

  describe("compareCards", () => {
    it("higher card of the lead suit wins", () => {
      expect(
        rules.compareCards(
          blueTen,
          blueSeven,
          null,
          "Blue",
        ),
      ).toBeGreaterThan(0);
    });

    it("trump card beats a card of the lead suit", () => {
      expect(
        rules.compareCards(
          redTwo,
          blueTen,
          "Red",
          "Blue",
        ),
      ).toBeGreaterThan(0);
    });

    it("Wizard beats a normal card", () => {
      expect(
        rules.compareCards(
          wizard,
          blueTen,
          "Red",
          "Blue",
        ),
      ).toBeGreaterThan(0);
    });

    it("Jester loses to a normal card", () => {
      expect(
        rules.compareCards(
          jester,
          blueTen,
          "Red",
          "Blue",
        ),
      ).toBeLessThan(0);
    });
  });

  describe("determineTrickWinner", () => {
    it("Wizard wins against normal cards", () => {
      expect(
        rules.determineTrickWinner(
          [
            { username: "alice", card: blueSeven },
            { username: "bob", card: redTwo },
            { username: "carol", card: wizard },
          ],
          "Red",
          false,
        ),
      ).toBe("carol");
    });

    it("first Wizard wins when two Wizards are played in a normal round", () => {
      expect(
        rules.determineTrickWinner(
          [
            { username: "alice", card: wizard },
            { username: "bob", card: wizard },
          ],
          "Red",
          false,
        ),
      ).toBe("alice");
    });

    it("first Wizard wins when multiple Wizards are played in a normal round", () => {
      expect(
        rules.determineTrickWinner(
          [
            { username: "alice", card: wizard },
            { username: "bob", card: wizard },
            { username: "carol", card: blueSeven },
          ],
          "Red",
          false,
        ),
      ).toBe("alice");
    });

    it("last Wizard wins when two Wizards are played in the final round", () => {
      expect(
        rules.determineTrickWinner(
          [
            { username: "alice", card: wizard },
            { username: "bob", card: wizard },
          ],
          "Red",
          true,
        ),
      ).toBe("bob");
    });

    it("last Wizard wins when multiple Wizards are played in the final round", () => {
      expect(
        rules.determineTrickWinner(
          [
            { username: "alice", card: wizard },
            { username: "bob", card: wizard },
            { username: "carol", card: wizard },
          ],
          "Red",
          true,
        ),
      ).toBe("carol");
    });
  });
});
