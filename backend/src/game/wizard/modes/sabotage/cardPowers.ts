import type { Card } from "../../models/card.js";
import type { GamePlayer, WizardGameState } from "../../models/wizardGame.js";

// The Sabotage mode (Rufus's rules): three of the thirteen ranks carry a
// power, which fires when a trick is won with that card. They follow suit and
// rank like any other card, so the deck stays 60 cards. The Thief here is
// Sabotage's card, not the Roles mode's Thief role (modes/roles/thief.ts).
export const SABOTAGE_THIEF_VALUE = 8;
export const TRICKSTER_VALUE = 9;
export const SEER_VALUE = 10;

export type CardPower = "seer" | "trickster" | "thief";

export function powerOf(card: Card): CardPower | null {
  if (card.value === SEER_VALUE) return "seer";
  if (card.value === TRICKSTER_VALUE) return "trickster";
  if (card.value === SABOTAGE_THIEF_VALUE) return "thief";
  return null;
}

// What winning a trick with a Seer, a Trickster or a Thief did. It starts
// unresolved, while the winner decides; resolving it fills in the rest.
export interface SabotagePower {
  kind: CardPower;
  // Who won the trick with the card, and so who uses the power.
  username: string;
  resolved: boolean;
  // Whose prediction changed (the winner's own for a Seer), the number it was
  // and the number it became. All null when the winner left it alone.
  target: string | null;
  from: number | null;
  to: number | null;
  // The Thief's swap: the winner picks a player first (target is set then, so
  // that player can be told), then a card of their own and one of the target's.
  // These are the hand positions that traded places, null until it happens.
  // Cards themselves are never recorded here: everyone sees this.
  ownIndex?: number | null;
  targetIndex?: number | null;
}

// Called as a trick is won: a winning Seer, Trickster or Thief earns its
// power, to be used before the trick is cleared. The last trick of a round
// leaves nothing to swap, so the Thief does nothing then.
export function earnCardPower(game: WizardGameState, winner: GamePlayer): void {
  const winningCard = game.currentTrick.playedCards.find(
    (played) => played.username === winner.username,
  )?.card;
  const kind = winningCard ? powerOf(winningCard) : null;

  if (!kind || (kind === "thief" && winner.hand.length === 0)) {
    return;
  }

  game.currentTrick.sabotagePower = {
    kind,
    username: winner.username,
    resolved: false,
    target: null,
    from: null,
    to: null,
    ownIndex: null,
    targetIndex: null,
  };
}

// Whether a won trick is waiting on its winner to use, or pass on, a power.
export function hasPendingPower(game: WizardGameState): boolean {
  const power = game.currentTrick.sabotagePower;

  return !!power && !power.resolved;
}

// The power waiting on this player to use it, or an error saying why not.
export function pendingPowerOf(game: WizardGameState, username: string): SabotagePower {
  const power = game.currentTrick.sabotagePower;

  if (game.phase !== "power" || !power || power.resolved) {
    throw new Error("There is no power to use right now");
  }

  if (power.username !== username) {
    throw new Error("It is not your power to use");
  }

  return power;
}

// The finished trick has been shown; now the winner decides. The winner is
// already the current player, so the turn machinery (timer, prompts) applies.
export function beginPower(game: WizardGameState): void {
  if (!hasPendingPower(game) || game.phase !== "playing") {
    throw new Error("There is no power to use");
  }

  game.phase = "power";
}

// The winner's choice. A Seer changes the winner's own prediction; a
// Trickster an opponent's. The new number is the old one, one more or one
// less, within 0 to the round number; the same number changes nothing, and
// then no target is recorded. Resolving hands the game back to "playing", with
// the finished trick still on the table for the runner to clear.
export function usePower(
  game: WizardGameState,
  username: string,
  choice: { target?: string | null; prediction: number },
): void {
  const power = pendingPowerOf(game, username);

  if (power.kind === "thief") {
    throw new Error("The Thief takes a card, not a prediction");
  }

  if (!Number.isInteger(choice.prediction)) {
    throw new Error("Prediction must be a whole number");
  }

  if (choice.prediction < 0 || choice.prediction > game.currentRound) {
    throw new Error(`Prediction must be between 0 and ${game.currentRound}`);
  }

  const targetName = power.kind === "seer" ? username : choice.target;
  const target = game.players.find((player) => player.username === targetName);

  if (!target) {
    throw new Error("Choose a player to change");
  }

  if (power.kind === "trickster" && target.username === username) {
    throw new Error("The Trickster changes an opponent's prediction");
  }

  const from = target.prediction;

  if (from === null) {
    throw new Error("That player has no prediction to change");
  }

  if (Math.abs(choice.prediction - from) > 1) {
    throw new Error("A prediction can only change by one");
  }

  if (choice.prediction !== from) {
    target.prediction = choice.prediction;
    power.target = target.username;
    power.from = from;
    power.to = choice.prediction;
  }

  power.resolved = true;
  game.phase = "playing";
}

// The winner left it alone, or ran out of time.
export function skipPower(game: WizardGameState, username: string): void {
  const power = pendingPowerOf(game, username);

  if (power.kind === "thief") {
    power.target = null;
  }

  power.resolved = true;
  game.phase = "playing";
}
