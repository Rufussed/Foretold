import type { Card } from "../../models/card.js";
import { isJester, isWizard } from "../../models/card.js";
import type { GamePlayer, TrickState } from "../../models/wizardGame.js";

// The Blue Wizard: a role with no card. Whoever plays it sees how many blue
// cards every hand hidden from them holds - not which, and not their numbers.
// Wizards and Jesters belong to no suit, so they never count as blue.

// Winning a trick with the blue Wizard (the Wizard of the Blue suit) brings
// the Blue Wizard these points, on top of the trick.
export const BLUE_WIZARD_BONUS = 20;

export const isBlueWizardCard = (card: Card): boolean => isWizard(card) && card.suit === "Blue";

export const isBlueCard = (card: Card): boolean => card.suit === "Blue" && !isWizard(card) && !isJester(card);

export const blueCardCount = (hand: readonly Card[]): number => hand.filter(isBlueCard).length;

// What the viewer is told about this player's hand: its blue cards, if the
// viewer is a Blue Wizard and the hand is hidden from them (an opponent's, or
// their own blind card); otherwise nothing.
export function blueSight(viewer: GamePlayer, player: GamePlayer, handVisible: boolean): number | undefined {
  if (viewer.role !== "blueWizard" || handVisible) return undefined;
  return blueCardCount(player.hand);
}

// The bonus the trick's winner earns: a Blue Wizard who won it with the blue
// Wizard, whoever played it first.
export function blueWizardBonus(trick: TrickState, winner: GamePlayer): number {
  if (winner.role !== "blueWizard") return 0;
  const winning = trick.playedCards.find((played) => played.username === winner.username);
  return winning && isBlueWizardCard(winning.card) ? BLUE_WIZARD_BONUS : 0;
}
