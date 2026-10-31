import type { Card, Suit } from "../../models/card.js";
import type { GamePlayer, PlayedCard } from "../../models/wizardGame.js";
import { playerOf, powerOn, type RoleOf } from "./rolePlay.js";

// What a Prophet's 12 brings when she keeps her prediction and it wins the
// trick.
export const FORESIGHT_POINTS = 5;

// The Prophet's power, a choice: playing her 12 with its power on (in the
// lead suit, as a trump, or in any suit after a Wizard lead), she may lower
// her prediction by 1 at once, before the trick is decided - never below the
// tricks she has already won. Everyone sees it, and may try to beat her 12.
// If she keeps her prediction instead and the 12 wins, she gets
// FORESIGHT_POINTS. A lowered prediction may make the predictions add up to
// the tricks of the round; that rule only holds while predicting. A Thief, a
// Servant or a Fisher who took the 12 and won with it brings her nothing.

// Whether the card at this place may lower its Prophet's prediction: her 12
// with its power on, and a prediction above the tricks she has won.
export const canLower = (
  playedCards: PlayedCard[],
  index: number,
  trumpSuit: Suit | null,
  roleOf: RoleOf,
  prophet: Pick<GamePlayer, "prediction" | "tricksWon">,
): boolean =>
  powerOn(playedCards, index, "prophet", trumpSuit, roleOf)
  && (prophet.prediction ?? 0) > prophet.tricksWon;

// The Prophets in a complete trick who kept their prediction and won it with
// their own 12.
export function foresightsIn(
  playedCards: PlayedCard[],
  trumpSuit: Suit | null,
  roleOf: RoleOf,
  winner: string,
): { prophet: string; card: Card }[] {
  return playedCards.flatMap((played, index) => {
    const prophet = playerOf(played);
    return !played.lowered
      && played.username === prophet
      && winner === prophet
      && powerOn(playedCards, index, "prophet", trumpSuit, roleOf)
      ? [{ prophet, card: played.card }]
      : [];
  });
}
