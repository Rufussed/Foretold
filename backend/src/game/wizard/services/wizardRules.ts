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

// What roles change in a trick's rules (modes/roles/master/trickRoles.ts); nothing
// when left out.
export interface TrickRoles {
  // How much a played card's rank is raised against cards of its own suit:
  // a Green Wizard's green cards.
  boostOf?(play: TrickPlay): number;
  // Whether this card was played by a Yellow Wizard, whose yellow card above
  // the lead card makes yellow the lead suit.
  isYellowWizard?(play: TrickPlay): boolean;
  // Whether this card was played by a Red Wizard, whose red card on a red
  // lead means no trumps count in that trick.
  isRedWizard?(play: TrickPlay): boolean;
  // Whether this card was played by a King, whose trump 13 brings the King's
  // peace: no Yellow or Red Wizard's power from then on, and no green boost
  // in the trick.
  isKing?(play: TrickPlay): boolean;
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
  // suit: a Roles Green Wizard's green cards (modes/roles/master/greenWizard.ts). A
  // boosted card that draws level wins.
  compareCards(
    firstCard: Card,
    secondCard: Card,
    trumpSuit: Suit | null,
    leadSuit: Suit | null,
    firstBoost = 0,
    secondBoost = 0,
  ): number {
    const byRank = () =>
      firstCard.value + firstBoost - (secondCard.value + secondBoost) || firstBoost - secondBoost;

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
    // A Red Wizard's red card on a red lead: the trick has no trumps.
    const scan = this.scanTrick(playedCards, trumpSuit, roles);
    const trump = scan.shieldAt !== -1 ? null : trumpSuit;
    // Under a King's peace no green card is boosted.
    const boostOf = scan.peaceAt === -1 ? roles?.boostOf : undefined;

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
          trump,
          leadSuit,
          boostOf?.(currentPlay) ?? 0,
          boostOf?.(winningPlay) ?? 0,
        ) > 0
      ) {
        winningPlay = currentPlay;
      }
    }

    return winningPlay.username;
  }

  // Whether a Red Wizard has played a red card on a red lead (after any
  // Yellow Wizard's switch): then no trumps count in this trick, for anyone.
  // A King's peace stops it (see scanTrick).
  redShield(playedCards: TrickPlay[], trumpSuit: Suit | null, roles?: TrickRoles): boolean {
    return this.scanTrick(playedCards, trumpSuit, roles).shieldAt !== -1;
  }

  // Where a Red Wizard's shield went up, or -1.
  scanShieldAt(playedCards: TrickPlay[], trumpSuit: Suit | null, roles?: TrickRoles): number {
    return this.scanTrick(playedCards, trumpSuit, roles).shieldAt;
  }

  // Where a Roles King's trump 13 brought the King's peace, or -1.
  kingsPeaceAt(playedCards: TrickPlay[], trumpSuit: Suit | null, roles?: TrickRoles): number {
    return this.scanTrick(playedCards, trumpSuit, roles).peaceAt;
  }

  //Added here to establish if First to Draw plays a Wizard, no LEad card, if plays Jester, it passes to the next player to lead.
  // A Yellow Wizard with no card of the lead suit who plays a yellow card
  // above the lead card makes yellow the lead suit for the rest of the trick,
  // unless yellow is trumps or already led, or a Red Wizard's shield or a
  // King's peace came first (see scanTrick).
  getLeadSuit(
    playedCards: TrickPlay[],
    trumpSuit: Suit | null = null,
    roles?: TrickRoles,
  ): Suit | null {
    return this.scanTrick(playedCards, trumpSuit, roles).lead;
  }

  // The trick in play order: its lead suit, where a Red Wizard's shield went
  // up and where a King's peace began, -1 for none. Without roles it is the
  // first card's suit (after any Jesters; none after a Wizard), as ever.
  // Roles mode: a Yellow Wizard may switch the lead to yellow, once; a Red
  // Wizard's red card on a red lead raises the shield, which stops any later
  // switch. A King's trump 13 brings peace, stopping both from then on;
  // with fire trumps it takes down a shield already up too. With other
  // trumps a shield already up means there are no trumps, so the 13 brings
  // no peace.
  private scanTrick(
    playedCards: TrickPlay[],
    trumpSuit: Suit | null,
    roles?: TrickRoles,
  ): { lead: Suit | null; shieldAt: number; peaceAt: number } {
    const leadIndex = playedCards.findIndex(({ card }) => !isJester(card));
    const first = playedCards[leadIndex]?.card;
    let lead: Suit | null = !first || isWizard(first) ? null : first.suit;
    let shieldAt = -1;
    let peaceAt = -1;

    if (leadIndex === -1 || !roles) {
      return { lead, shieldAt, peaceAt };
    }

    const bringsPeace = (play: TrickPlay) =>
      trumpSuit !== null && play.card.suit === trumpSuit && play.card.value === 13 && !!roles.isKing?.(play);
    const canSwitch = !!first && lead !== null && first.suit !== "Yellow" && trumpSuit !== "Yellow";

    for (let index = leadIndex; index < playedCards.length; index++) {
      const play = playedCards[index]!;
      const numbered = !isWizard(play.card) && !isJester(play.card);

      if (bringsPeace(play) && (shieldAt === -1 || trumpSuit === "Red")) {
        peaceAt = index;
        if (trumpSuit === "Red") shieldAt = -1;
        break;
      }

      if (
        index > leadIndex && canSwitch && lead !== "Yellow" && shieldAt === -1 && numbered &&
        play.card.suit === "Yellow" && play.card.value > first!.value && !!roles.isYellowWizard?.(play)
      ) {
        lead = "Yellow";
        continue;
      }

      if (shieldAt === -1 && lead === "Red" && numbered && play.card.suit === "Red" && !!roles.isRedWizard?.(play)) {
        shieldAt = index;
      }
    }

    return { lead, shieldAt, peaceAt };
  }
}
