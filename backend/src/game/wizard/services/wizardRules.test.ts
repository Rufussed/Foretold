import assert from "node:assert/strict";
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

assert.equal(rules.getTrumpSuit(redTwo), "Red");
assert.equal(rules.getTrumpSuit(wizard), null);
assert.equal(rules.getTrumpSuit(jester), null);

assert.equal(
  rules.isValidCardPlay(blueSeven, [blueSeven, redTwo], "Blue"),
  true,
);

assert.equal(
  rules.isValidCardPlay(redTwo, [blueSeven, redTwo], "Blue"),
  false,
);

assert.equal(
  rules.isValidCardPlay(redTwo, [redTwo], "Blue"),
  true,
);

assert.equal(
  rules.isValidCardPlay(wizard, [blueSeven, wizard], "Blue"),
  true,
);

assert.equal(
  rules.compareCards(blueTen, blueSeven, null, "Blue") > 0,
  true,
);

assert.equal(
  rules.compareCards(redTwo, blueTen, "Red", "Blue") > 0,
  true,
);

assert.equal(
  rules.compareCards(wizard, blueTen, "Red", "Blue") > 0,
  true,
);

assert.equal(
  rules.compareCards(jester, blueTen, "Red", "Blue") < 0,
  true,
);

assert.equal(
  rules.determineTrickWinner(
    [
      { username: "alice", card: blueSeven },
      { username: "bob", card: redTwo },
      { username: "carol", card: wizard },
    ],
    redTwo,
  ),
  "carol",
);

console.log("WizardRules behavior test passed");