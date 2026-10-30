import type { Card, Suit } from "../models/card.js";
import { isJester, isWizard } from "../models/card.js";

// The chance a card takes a trick, against two opponents. Trumps beat every
// other suit, so even a middling one often wins; outside trumps only the top
// cards do.
export function trickChance(card: Card, trumpSuit: Suit | null): number {
  if (isWizard(card)) return 1;
  if (isJester(card)) return 0;

  if (card.suit === trumpSuit) {
    if (card.value >= 12) return 0.9;
    if (card.value >= 9) return 0.65;
    if (card.value >= 5) return 0.4;
    return 0.2;
  }

  if (card.value === 13) return 0.7;
  if (card.value === 12) return 0.5;
  if (card.value === 11) return 0.3;
  return 0;
}

// Every extra opponent is another chance of a higher card, so a card that is
// not a Wizard is worth less the more players there are.
export const crowdFactor = (playerCount: number): number => 1 - 0.12 * (playerCount - 3);

// How good a card is to hold: Wizards above trumps above other suits, Jesters
// below everything.
export function strength(card: Card, trumpSuit: Suit | null): number {
  if (isWizard(card)) return 100;
  if (isJester(card)) return -1;
  return (card.suit === trumpSuit ? 20 : 0) + card.value;
}
