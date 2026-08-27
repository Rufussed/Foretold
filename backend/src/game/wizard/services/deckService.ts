import {
  SUITS,
  type Card,
} from "../models/card.js";

export class DeckService {
  private cards: Card[] = [];

  constructor() {
    this.reset();
  }

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