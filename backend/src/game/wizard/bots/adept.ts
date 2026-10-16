import type { Card, Suit } from "../models/card.js";
import { isJester, isWizard } from "../models/card.js";
import type { WizardGameState } from "../models/wizardGame.js";
import { normalizeGameOptions } from "../gameOptions.js";
import { WizardRules } from "../services/wizardRules.js";
import { blindPrediction, chooseLongestSuit } from "./apprentice.js";
import { type BotStrategy, currentPlayer, isBlind } from "./personality.js";

const rules = new WizardRules();

// The chance a card takes a trick, against two opponents. Trumps beat every
// other suit, so even a middling one often wins; outside trumps only the top
// cards do.
function trickChance(card: Card, trumpSuit: Suit | null): number {
  if (isWizard(card)) return 1;
  if (isJester(card)) return 0;

  if (card.suit === trumpSuit) {
    if (card.value >= 12) return 0.9;
    if (card.value >= 9) return 0.65;
    if (card.value >= 5) return 0.4;
    return 0.2;
  }

  if (card.value === 13) return 0.7;
  if (card.value === 12) return 0.5;
  if (card.value === 11) return 0.3;
  return 0;
}

// Every extra opponent is another chance of a higher card, so a card that is
// not a Wizard is worth less the more players there are.
const crowdFactor = (playerCount: number): number => 1 - 0.12 * (playerCount - 3);

// How good a card is to hold: Wizards above trumps above other suits, Jesters
// below everything.
function strength(card: Card, trumpSuit: Suit | null): number {
  if (isWizard(card)) return 100;
  if (isJester(card)) return -1;
  return (card.suit === trumpSuit ? 20 : 0) + card.value;
}

// The second bot: it bids on the chance each card has of winning, counting
// trumps and the number of opponents, then plays to make that bid exactly.
// While it still needs tricks it plays to win them, and once it has them it
// plays to lose, getting rid of its dangerous cards when it safely can.
export const adept: BotStrategy = {
  chooseTrumpSuit: chooseLongestSuit,

  estimatePrediction(game) {
    if (isBlind(game)) {
      return blindPrediction(game);
    }

    const crowd = crowdFactor(game.players.length);
    const expected = currentPlayer(game).hand.reduce((total, card) => {
      const chance = trickChance(card, game.trumpSuit);
      return total + (isWizard(card) ? chance : chance * crowd);
    }, 0);

    return Math.max(0, Math.min(game.currentRound, Math.round(expected)));
  },

  chooseCardIndex(game) {
    const player = currentPlayer(game);
    const played = game.currentTrick.playedCards;
    const trumpSuit = game.trumpSuit;
    const { wizardWins } = normalizeGameOptions(game.options);
    const leadSuit = rules.getLeadSuit(played);

    const legal = player.hand
      .map((card, index) => ({ card, index }))
      .filter(({ card }) => rules.isValidCardPlay(card, player.hand, leadSuit));

    if (legal.length === 0) {
      throw new Error("Bot has no legal card to play");
    }

    const byStrength = (a: { card: Card }, b: { card: Card }) =>
      strength(a.card, trumpSuit) - strength(b.card, trumpSuit);
    const weakest = (plays: typeof legal) => [...plays].sort(byStrength)[0]!;
    const strongest = (plays: typeof legal) => [...plays].sort(byStrength).at(-1)!;

    const wantsTricks = (player.prediction ?? 0) > player.tricksWon;

    // Leading: its best card to take the trick, or its lowest to give it
    // away, keeping a Jester back for a trick it can't otherwise lose.
    if (played.length === 0) {
      if (wantsTricks) return strongest(legal).index;
      const notJesters = legal.filter(({ card }) => !isJester(card));
      return weakest(notJesters.length > 0 ? notJesters : legal).index;
    }

    // Which cards would take the trick as it stands. Only for the last player
    // is that final; anyone after may still beat it.
    const winsNow = ({ card }: { card: Card }) =>
      rules.determineTrickWinner(
        [...played, { username: player.username, card }],
        trumpSuit,
        wizardWins,
      ) === player.username;
    const winners = legal.filter(winsNow);
    const losers = legal.filter((play) => !winsNow(play));
    const playsLast = played.length === game.players.length - 1;

    if (wantsTricks) {
      if (winners.length === 0) return weakest(legal).index;
      // Last, the cheapest winner is enough. Earlier, a strong one stands a
      // better chance against the players still to come, but a Wizard is
      // only spent when nothing else wins.
      if (playsLast) return weakest(winners).index;
      const notWizards = winners.filter(({ card }) => !isWizard(card));
      return strongest(notWizards.length > 0 ? notWizards : winners).index;
    }

    // Enough tricks: lose this one with the highest card that still loses,
    // so it can't win a trick later; if every card wins, the weakest.
    if (losers.length > 0) return strongest(losers).index;
    return weakest(winners).index;
  },
};
