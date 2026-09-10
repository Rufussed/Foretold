import {
  SUITS,
  type Card,
} from "../models/card.js";

export class DeckService {
  private cards: Card[] = [];

  constructor() {
    this.reset();
  }

  // Build the standard 60-card deck: four suits with values 0 through 14.
  reset(): void {
    this.cards = [];

    for (const suit of SUITS) {
      for (let value = 0; value <= 14; value++) {
        this.cards.push({
          value: value as Card["value"],
          suit,
        });
      }
    }
  }

  // Fisher-Yates shuffle gives every card a new position without changing the
  // deck contents or its 60-card size.
	shuffle(): void {
	for (let index = this.cards.length - 1; index > 0; index--) {
		const randomIndex = Math.floor(Math.random() * (index + 1));
		const currentCard = this.cards[index];
		const randomCard = this.cards[randomIndex];

		if (!currentCard || !randomCard) {
		continue;
		}

		this.cards[index] = randomCard;
		this.cards[randomIndex] = currentCard;
	}
	}

  // Return a copy so callers cannot mutate the service's internal deck array.
  getCards(): Card[] {
    return [...this.cards];
  }

  draw(): Card | undefined {
    return this.cards.pop();
  }

  getRemainingCount(): number {
    return this.cards.length;
  }

  hasCards(): boolean {
    return this.cards.length > 0;
  }
}