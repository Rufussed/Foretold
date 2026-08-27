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

export function isWizard(card: Card): boolean {
  return card.value === 14;
}

export function isJester(card: Card): boolean {
  return card.value === 0;
}