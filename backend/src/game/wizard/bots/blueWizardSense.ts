import type { Card } from "../models/card.js";
import type { WizardGameState } from "../models/wizardGame.js";
import { blueCardCount, isBlueCard } from "../modes/roles/blueWizard.js";
import { currentPlayer } from "./personality.js";
import { strength } from "./handStrength.js";
import { roleOfBot, type Play } from "./roleSense.js";

// How the Adept plays the Blue Wizard (modes/roles/blueWizard.ts). It uses
// only what a human Blue Wizard is shown: how many blue cards each opponent
// holds. Whoever holds none cannot follow blue, so can trump a blue lead;
// whoever holds some must follow it.

const isBlueWizard = (game: WizardGameState): boolean => roleOfBot(game) === "blueWizard";

// Each opponent's blue cards.
const opponentsBlue = (game: WizardGameState): number[] => {
  const me = currentPlayer(game);
  return game.players.filter((player) => player !== me).map((player) => blueCardCount(player.hand));
};

// A card's chance of taking a trick, for the bid, with the blue counts in mind.
export function blueTrickChance(game: WizardGameState, card: Card, chance: number): number {
  if (!isBlueWizard(game)) return chance;

  const counts = opponentsBlue(game);
  const total = counts.reduce((sum, count) => sum + count, 0);
  const blueTrumps = game.trumpSuit === "Blue";

  if (isBlueCard(card)) {
    // Nobody else holds a trump: only a Wizard can beat it.
    if (blueTrumps) return total === 0 ? Math.max(chance, 0.9) : total === 1 ? Math.max(chance, 0.7) : chance;
    // Someone with no blue may trump it.
    if (game.trumpSuit && counts.some((count) => count === 0)) return chance * 0.5;
    // Everyone must follow blue: a royal stands well.
    return card.value >= 11 ? Math.min(1, chance + 0.15) : chance;
  }

  // Blue is trumps and nobody else holds one: a high card of another suit
  // cannot be trumped.
  if (blueTrumps && total === 0 && card.value >= 12) return Math.min(1, chance + 0.1);
  return chance;
}

// The card to lead, when the blue counts make one a clear choice; null to
// lead as usual.
export function blueLead(game: WizardGameState, legal: Play[], wantsTricks: boolean): Play | null {
  if (!isBlueWizard(game) || game.currentTrick.playedCards.length > 0) return null;

  const blues = legal
    .filter(({ card }) => isBlueCard(card))
    .sort((a, b) => strength(a.card, game.trumpSuit) - strength(b.card, game.trumpSuit));
  if (blues.length === 0) return null;

  const counts = opponentsBlue(game);
  const everyoneFollows = counts.every((count) => count > 0);
  const blueTrumps = game.trumpSuit === "Blue";

  if (wantsTricks) {
    // No one else holds a trump: the cheapest one wins, bar a Wizard.
    if (blueTrumps && counts.every((count) => count === 0)) return blues[0]!;
    // Everyone must follow, so no one can trump: lead a royal.
    const top = blues.at(-1)!;
    return !blueTrumps && everyoneFollows && top.card.value >= 12 ? top : null;
  }

  // Everyone must follow: a low blue is likely to be beaten.
  const low = blues[0]!;
  return everyoneFollows && low.card.value <= 5 ? low : null;
}

