import type { Card, Suit } from "../models/card.js";
import { isJester, isWizard, powerOf } from "../models/card.js";
import type { WizardGameState } from "../models/wizardGame.js";
import { normalizeGameOptions } from "../gameOptions.js";
import { WizardRules } from "../services/wizardRules.js";
import { blindPrediction, chooseLongestSuit } from "./apprentice.js";
import { type BotStrategy, currentPlayer, isBlind } from "./personality.js";
import { crowdFactor, strength, trickChance } from "./handStrength.js";
import { expectedSeerChoice, expectedTricksterChoice } from "./powerReasoning.js";
import { expectedThief } from "./thiefReasoning.js";

const rules = new WizardRules();

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

    // A winner that carries a power: a Seer or a Trickster that takes the
    // trick pays off on top of the trick itself.
    const withPower = (plays: typeof winners, kind: "seer" | "trickster") =>
      plays.filter(({ card }) => powerOf(card) === kind);

    if (wantsTricks) {
      if (winners.length === 0) return weakest(legal).index;
      // Last, the cheapest winner is enough, but one that carries a power is
      // free value: the Trickster knocks back a rival, the Seer can still mend
      // its own bid. Earlier, a strong one stands a better chance against the
      // players still to come, but a Wizard is only spent when nothing else wins.
      if (playsLast) {
        const powered = [...withPower(winners, "trickster"), ...withPower(winners, "seer")];
        return (powered.length > 0 ? weakest(powered) : weakest(winners)).index;
      }
      const notWizards = winners.filter(({ card }) => !isWizard(card));
      return strongest(notWizards.length > 0 ? notWizards : winners).index;
    }

    // Enough tricks: lose this one with the highest card that still loses,
    // so it can't win a trick later.
    if (losers.length > 0) return strongest(losers).index;

    // Every card wins, so the bid is about to be overshot. A Seer takes the
    // trick and raises the bid to match, so the extra win costs nothing (if
    // the round allows a higher bid); a Trickster at least makes use of it.
    const seers = (player.prediction ?? 0) + 1 <= game.currentRound ? withPower(winners, "seer") : [];
    if (seers.length > 0) return weakest(seers).index;
    const tricksters = withPower(winners, "trickster");
    if (tricksters.length > 0) return weakest(tricksters).index;
    return weakest(winners).index;
  },

  // Reasons about whether its hand will deliver its prediction (thiefReasoning.ts).
  chooseThief: expectedThief,

  choosePower(game) {
    return game.currentTrick.power?.kind === "seer"
      ? expectedSeerChoice(game)
      : expectedTricksterChoice(game);
  },
};
