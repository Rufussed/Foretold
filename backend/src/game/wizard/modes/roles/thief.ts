import { isJester, isWizard, type Suit } from "../../models/card.js";
import type { PlayedCard } from "../../models/wizardGame.js";
import { WizardRules } from "../../services/wizardRules.js";
import { roleCard, type RoleAction } from "./roles.js";

const rules = new WizardRules();

// The Thief's power, a must: the moment the Thief plays their 1 in the lead
// suit or as a trump, they take the card played just before it, and that
// player gets the 1. Nothing happens when the 1 leads the trick or the card
// before it is a Wizard or Jester.
export function findSteal(
  playedCards: PlayedCard[],
  trumpSuit: Suit | null,
): RoleAction | null {
  const played = playedCards.at(-1);
  const before = playedCards.at(-2);

  if (!played || !before || played.card.value !== roleCard("thief")) {
    return null;
  }

  if (isWizard(before.card) || isJester(before.card)) {
    return null;
  }

  const suit = played.card.suit;

  if (suit !== rules.getLeadSuit(playedCards) && suit !== trumpSuit) {
    return null;
  }

  return { role: "thief", by: played.username, on: before.username, card: before.card };
}

// The swap: the two cards change owners, so the stolen card counts as the
// Thief's when the trick is decided.
export function applySteal(playedCards: PlayedCard[]): void {
  const played = playedCards.at(-1);
  const before = playedCards.at(-2);

  if (!played || !before) {
    return;
  }

  [played.username, before.username] = [before.username, played.username];
}
