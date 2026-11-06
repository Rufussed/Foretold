import type { Card } from "../../../models/card.js";
import { SUITS } from "../../../models/card.js";
import type { GamePlayer, WizardGameState } from "../../../models/wizardGame.js";

// Roles mode only. The Watcher: a free master role with no card. Before each
// round is dealt, 2 of the 4 Wizards and 2 of the 4 Jesters are picked at
// random: the watched cards. The Watcher sees how many of them each hand
// hidden from them holds - not which, and not whether Wizard or Jester.
// Watched cards left in the deck, or turned up as trumps, are seen nowhere,
// so some rounds show 4, some fewer, some none. Two Watchers at one table
// watch the same cards.

export const WATCHED_WIZARDS = 2;
export const WATCHED_JESTERS = 2;

const pick = <T>(from: readonly T[], count: number, random: () => number): T[] => {
  const left = [...from];
  const picked: T[] = [];
  while (picked.length < count && left.length > 0) {
    const index = Math.min(Math.floor(random() * left.length), left.length - 1);
    picked.push(...left.splice(index, 1));
  }
  return picked;
};

// The round's watched cards, picked as it is dealt (the hook in
// wizardGameService.dealRound, Roles games only).
export function pickWatchedCards(random: () => number = Math.random): Card[] {
  const wizards = SUITS.map((suit): Card => ({ value: 14, suit }));
  const jesters = SUITS.map((suit): Card => ({ value: 0, suit }));
  return [...pick(wizards, WATCHED_WIZARDS, random), ...pick(jesters, WATCHED_JESTERS, random)];
}

export const watchedCount = (hand: readonly Card[], watched: readonly Card[]): number =>
  hand.filter((card) => watched.some((seen) => seen.value === card.value && seen.suit === card.suit)).length;

// What the viewer is told about this player's hand: its watched cards, if the
// viewer is a Watcher and the hand is hidden from them (an opponent's, or
// their own blind card); otherwise nothing.
export function watcherSight(
  game: Pick<WizardGameState, "watchedCards">,
  viewer: GamePlayer,
  player: GamePlayer,
  handVisible: boolean,
): number | undefined {
  if (viewer.role !== "watcher" || handVisible) return undefined;
  return watchedCount(player.hand, game.watchedCards ?? []);
}
