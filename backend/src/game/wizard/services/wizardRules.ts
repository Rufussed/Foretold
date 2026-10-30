import type { WizardWins } from "../gameOptions.js";
import {
  isJester,
  isWizard,
  type Card,
  type Suit,
} from "../models/card.js";

// A played card, with who played it when a role's power has since given it
// to someone else.
export type TrickPlay = { username: string; playedBy?: string; card: Card };

// What roles change in a trick's rules (modes/roles/trickRoles.ts); nothing
// when left out.
export interface TrickRoles {
  // How much a played card's rank is raised against cards of its own suit:
  // a Green Wizard's green cards.
  boostOf?(play: TrickPlay): number;
  // Whether this card was played by a Yellow Wizard, whose yellow card above
  // the lead card makes yellow the lead suit.
  isYellowWizard?(play: TrickPlay): boolean;
}

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
  // firstBoost and secondBoost raise a card's rank against a card of its own
  // suit: a Roles Green Wizard's green cards (modes/roles/greenWizard.ts). A
  // boosted card that only draws level loses.
  compareCards(
    firstCard: Card,
    secondCard: Card,
    trumpSuit: Suit | null,
    leadSuit: Suit | null,
    firstBoost = 0,
    secondBoost = 0,
  ): number {
    const byRank = () =>
      firstCard.value + firstBoost - (secondCard.value + secondBoost) || secondBoost - firstBoost;

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
      return byRank();
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
      return byRank();
    }

    return 0;
  }

  // Determine the winner from cards played in turn order. When several
  // Wizards are played, the game's wizardWins option picks the first or the
  // last of them.
  determineTrickWinner(
    playedCards: TrickPlay[],
    trumpSuit: Suit | null,
    wizardWins: WizardWins,
    roles?: TrickRoles,
  ): string | null {
    if (playedCards.length === 0) {
      return null;
    }

    //Handles if Wizard is play first, there is no Suit
    const leadSuit = this.getLeadSuit(playedCards, trumpSuit, roles);

    // Handle Wizards before ordinary card comparison, since which of several
    // Wizards wins is a game option rather than a card comparison.
    const wizardPlays = playedCards.filter(({ card }) => isWizard(card));

    if (wizardPlays.length > 0) {
      const winning = wizardWins === "last" ? wizardPlays.at(-1) : wizardPlays[0];
      return winning?.username ?? null;
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
          roles?.boostOf?.(currentPlay) ?? 0,
          roles?.boostOf?.(winningPlay) ?? 0,
        ) > 0
      ) {
        winningPlay = currentPlay;
      }
    }

    return winningPlay.username;
  }

  //Added here to establish if First to Draw plays a Wizard, no LEad card, if plays Jester, it passes to the next player to lead.
  // A Yellow Wizard with no card of the lead suit who plays a yellow card
  // above the lead card makes yellow the lead suit for the rest of the trick,
  // unless yellow is trumps or already led.
  getLeadSuit(
    playedCards: TrickPlay[],
    trumpSuit: Suit | null = null,
    roles?: TrickRoles,
  ): Suit | null {
    const leadIndex = playedCards.findIndex(
      ({ card }) => !isJester(card),
    );
    const firstRelevantCard = playedCards[leadIndex]?.card;

    if (!firstRelevantCard || isWizard(firstRelevantCard)) {
      return null;
    }

    const isYellowWizard = roles?.isYellowWizard;
    if (isYellowWizard && firstRelevantCard.suit !== "Yellow" && trumpSuit !== "Yellow") {
      const switched = playedCards.slice(leadIndex + 1).some(
        (play) =>
          play.card.suit === "Yellow" &&
          !isWizard(play.card) &&
          !isJester(play.card) &&
          play.card.value > firstRelevantCard.value &&
          isYellowWizard(play),
      );

      if (switched) {
        return "Yellow";
      }
    }

    return firstRelevantCard.suit;
  }
}
