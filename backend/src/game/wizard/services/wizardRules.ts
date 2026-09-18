import {
  isJester,
  isWizard,
  type Card,
  type Suit,
} from "../models/card.js";

export class WizardRules {
  // A Wizard or Jester turned as trump does not establish a trump suit.
  getTrumpSuit(trumpCard: Card | null): Suit | null {
    if (!trumpCard || isWizard(trumpCard) || isJester(trumpCard)) {
      return null;
    }

    return trumpCard.suit;
  }

  // Wizards and Jesters are suit-independent, so they do not satisfy the
  // requirement to hold a normal card in the lead suit.
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

  // A player must follow the lead suit when possible. Special cards remain
  // legal at any point in the trick.
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

  // Return a positive value when the first card wins, a negative value when
  // the second wins, and zero when neither card outranks the other.
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

  // Determine the winner from cards played in turn order. In the final round
  // Wizards are resolved in reverse play order, matching the game's special
  // no-trump end-round rule.
  determineTrickWinner(
    playedCards: Array<{ username: string; card: Card }>,
    trumpSuit: Suit | null,
    isFinalRound: boolean,
  ): string | null {
    if (playedCards.length === 0) {
      return null;
    }

    //Handles if Wizard is play first, there is no Suit
    const leadSuit = this.getLeadSuit(playedCards);

    // Handle Wizards before ordinary card comparison because multiple
    // Wizards require a different ordering in the final round.
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

  //Added here to establish if First to Draw plays a Wizard, no LEad card, if plays Jester, it passes to the next player to lead.
  getLeadSuit(
    playedCards: Array<{ card: Card }>,
  ): Suit | null {
    const firstRelevantCard = playedCards.find(
      ({ card }) => !isJester(card),
    )?.card;

    if (!firstRelevantCard || isWizard(firstRelevantCard)) {
      return null;
    }

    return firstRelevantCard.suit;
  }
}
