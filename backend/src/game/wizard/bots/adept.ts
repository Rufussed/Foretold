import type { Card, Suit } from "../models/card.js";
import { isJester, isWizard } from "../models/card.js";
import type { WizardGameState } from "../models/wizardGame.js";
import { normalizeGameOptions } from "../gameOptions.js";
import { WizardRules } from "../services/wizardRules.js";
import { blindPrediction, chooseLongestSuit } from "./apprentice.js";
import { type BotStrategy, currentPlayer, isBlind } from "./personality.js";
import { type Play, roleBidValue, rolePick, servesNext, trickAfter } from "./roleSense.js";
import { crowdFactor, strength, trickChance } from "./handStrength.js";
import { sabotagePick } from "../modes/sabotage/bots/index.js";
import { blueLead, blueTrickChance } from "./blueWizardSense.js";

const rules = new WizardRules();

// The second bot: it bids on the chance each card has of winning, counting
// trumps and the number of opponents, then plays to make that bid exactly.
// While it still needs tricks it plays to win them, and once it has them it
// plays to lose, getting rid of its dangerous cards when it safely can. In a
// Roles game it knows its role and what its card does (roleSense.ts); in a
// Sabotage game, what a Seer or Trickster brings (modes/sabotage/bots/).
export const adept: BotStrategy = {
  chooseTrumpSuit: chooseLongestSuit,

  estimatePrediction(game) {
    if (isBlind(game)) {
      return blindPrediction(game);
    }

    const crowd = crowdFactor(game.players.length);
    const expected = currentPlayer(game).hand.reduce((total, card) => {
      const chance = blueTrickChance(game, card, trickChance(card, game.trumpSuit) + roleBidValue(game, card));
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

    const legal: Play[] = player.hand
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

    // Which cards would take the trick as it stands, powers included. Only
    // for the last player is that final; anyone after may still beat it.
    const winsNow = ({ card }: { card: Card }) =>
      rules.determineTrickWinner(trickAfter(game, card), trumpSuit, wizardWins) === player.username;
    const winners = legal.filter(winsNow);
    const losers = legal.filter((play) => !winsNow(play));
    const rolePlay = rolePick(game, legal, winners, losers, wantsTricks);

    if (rolePlay) return rolePlay.index;

    const sabotagePlay = sabotagePick(game, winners, losers, wantsTricks, weakest);

    if (sabotagePlay) return sabotagePlay.index;

    // A Blue Wizard leads by what it knows of the blue cards.
    const bluePlay = blueLead(game, legal, wantsTricks);
    if (bluePlay) return bluePlay.index;

    // Leading: its best card to take the trick, or its lowest to give it
    // away, keeping a Jester back for a trick it can't otherwise lose.
    if (played.length === 0) {
      if (wantsTricks) return strongest(legal).index;
      const notJesters = legal.filter(({ card }) => !isJester(card));
      return weakest(notJesters.length > 0 ? notJesters : legal).index;
    }

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
    // so it can't win a trick later; if every card wins, the weakest. A
    // Servant's 2 is no sure loser: the next card becomes theirs.
    const safe = losers.filter(({ card }) => !servesNext(game, card));
    if (safe.length > 0) return strongest(safe).index;
    if (losers.length > 0) return strongest(losers).index;
    return weakest(winners).index;
  },
};
