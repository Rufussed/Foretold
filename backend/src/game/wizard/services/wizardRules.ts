import {
  isJester,
  isWizard,
  type Card,
  type Suit,
} from "../models/card.js";

export class WizardRules {
  getTrumpSuit(trumpCard: Card | null): Suit | null {
    if (!trumpCard || isWizard(trumpCard) || isJester(trumpCard)) {
      return null;
    }

    return trumpCard.suit;
  }

  hasLeadSuit(hand: Card[], leadSuit: Suit | null): boolean {
    if (!leadSuit) {
      return false;
    }

    return hand.some(
      (card) =>
        card.suit === leadSuit &&
        !isWizard(card) &&
        !isJester(card),
    );
  }

  isValidCardPlay(
    card: Card,
    hand: Card[],
    leadSuit: Suit | null,
  ): boolean {
    if (!leadSuit) {
      return true;
    }

    if (isWizard(card) || isJester(card)) {
      return true;
    }

    if (!this.hasLeadSuit(hand, leadSuit)) {
      return true;
    }

    return card.suit === leadSuit;
  }

  compareCards(
    firstCard: Card,
    secondCard: Card,
    trumpSuit: Suit | null,
    leadSuit: Suit | null,
  ): number {
    if (isWizard(firstCard)) {
      return 1;
    }

    if (isWizard(secondCard)) {
      return -1;
    }

    if (isJester(firstCard)) {
      return -1;
    }

    if (isJester(secondCard)) {
      return 1;
    }

    const firstIsTrump = trumpSuit !== null && firstCard.suit === trumpSuit;
    const secondIsTrump =
      trumpSuit !== null && secondCard.suit === trumpSuit;

    if (firstIsTrump && !secondIsTrump) {
      return 1;
    }

    if (!firstIsTrump && secondIsTrump) {
      return -1;
    }

    if (firstIsTrump && secondIsTrump) {
      return firstCard.value - secondCard.value;
    }

    const firstFollowsLead =
      leadSuit !== null && firstCard.suit === leadSuit;
    const secondFollowsLead =
      leadSuit !== null && secondCard.suit === leadSuit;

    if (firstFollowsLead && !secondFollowsLead) {
      return 1;
    }

    if (!firstFollowsLead && secondFollowsLead) {
      return -1;
    }

    if (firstFollowsLead && secondFollowsLead) {
      return firstCard.value - secondCard.value;
    }

    return 0;
  }

  determineTrickWinner(
    playedCards: Array<{ username: string; card: Card }>,
    trumpSuit: Suit | null,
    isFinalRound: boolean,
  ): string | null {
    if (playedCards.length === 0) {
      return null;
    }

    const leadSuit =
      playedCards.find(({ card }) => !isJester(card))?.card.suit ?? null;

    const wizardPlays = playedCards.filter(({ card }) => isWizard(card));

    if (wizardPlays.length > 0) {
      if (isFinalRound) {
        return wizardPlays[wizardPlays.length - 1]?.username ?? null;
      }

      return wizardPlays[0]?.username ?? null;
    }

    const firstPlay = playedCards[0];

    if (!firstPlay) {
      return null;
    }

    let winningPlay = firstPlay;

    for (const currentPlay of playedCards.slice(1)) {
      if (
        this.compareCards(
          currentPlay.card,
          winningPlay.card,
          trumpSuit,
          leadSuit,
        ) > 0
      ) {
        winningPlay = currentPlay;
      }
    }

    return winningPlay.username;
  }
}
