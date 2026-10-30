import type { WizardGameState } from "../../models/wizardGame.js";
import { pendingPowerOf } from "./cardPowers.js";

// Sabotage's Thief card (rank 8; not the Roles mode's Thief role): winning a
// trick with it lets its winner pick a player, then one of their own cards and
// one of the target's, unseen, and swap them.

// The first step: the player whose hand will be robbed. Chosen again if the
// winner changes their mind before taking a card.
export function chooseSabotageThiefTarget(
  game: WizardGameState,
  username: string,
  targetName: string,
): void {
  const power = pendingPowerOf(game, username);

  if (power.kind !== "thief") {
    throw new Error("Only the Thief takes a card");
  }

  const target = game.players.find((player) => player.username === targetName);

  if (!target || target.username === username) {
    throw new Error("Choose another player");
  }

  if (target.hand.length === 0) {
    throw new Error("That player has no cards to take");
  }

  power.target = target.username;
}

// The second step: one of the winner's cards for one of the target's,
// swapped where they stand. The winner picks the target's card unseen.
export function swapSabotageThiefCards(
  game: WizardGameState,
  username: string,
  choice: { ownIndex: number; targetIndex: number },
): void {
  const power = pendingPowerOf(game, username);

  if (power.kind !== "thief") {
    throw new Error("Only the Thief takes a card");
  }

  const winner = game.players.find((player) => player.username === username);
  const target = game.players.find((player) => player.username === power.target);

  if (!winner || !target) {
    throw new Error("Choose a player to take from");
  }

  const { ownIndex, targetIndex } = choice;
  const ownCard = winner.hand[ownIndex];
  const targetCard = target.hand[targetIndex];

  if (!Number.isInteger(ownIndex) || !Number.isInteger(targetIndex) || !ownCard || !targetCard) {
    throw new Error("Choose a card from each hand");
  }

  winner.hand[ownIndex] = targetCard;
  target.hand[targetIndex] = ownCard;
  power.ownIndex = ownIndex;
  power.targetIndex = targetIndex;
  power.resolved = true;
  game.phase = "playing";
}
