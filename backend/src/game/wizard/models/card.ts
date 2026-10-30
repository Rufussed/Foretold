export const SUITS = [
  "Blue",
  "Red",
  "Yellow",
  "Green",
] as const;

export type Suit = (typeof SUITS)[number];

export type CardValue =
  | 0
  | 1
  | 2
  | 3
  | 4
  | 5
  | 6
  | 7
  | 8
  | 9
  | 10
  | 11
  | 12
  | 13
  | 14;

export interface Card {
  value: CardValue;
  suit: Suit;
}

// Three of the thirteen ranks carry a power, which fires when a trick is won with
// that card (see cardPowers.ts). They follow suit and rank like any other card.
export const THIEF_VALUE = 8;
export const TRICKSTER_VALUE = 9;
export const SEER_VALUE = 10;

export type CardPower = "seer" | "trickster" | "thief";

export function powerOf(card: Card): CardPower | null {
  if (card.value === SEER_VALUE) return "seer";
  if (card.value === TRICKSTER_VALUE) return "trickster";
  if (card.value === THIEF_VALUE) return "thief";
  return null;
}

// Wizards and Jesters have special behavior and are not treated like normal
// numbered cards when validating plays or comparing trick winners.
export function isWizard(card: Card): boolean {
  return card.value === 14;
}

export function isJester(card: Card): boolean {
  return card.value === 0;
}