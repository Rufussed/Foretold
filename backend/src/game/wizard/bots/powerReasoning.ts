import type { WizardGameState } from "../models/wizardGame.js";
import { isWizard } from "../models/card.js";
import { ScoreCalculator } from "../services/wizardScoreCalculator.js";
import { crowdFactor, trickChance } from "./handStrength.js";
import { currentPlayer, isBlind } from "./personality.js";
import type { PowerChoice } from "./powers.js";

// How the Adept reasons about a Seer or a Trickster it has just won with.
//
// Everything rests on one question: what is a prediction worth? A prediction
// is only a bet on how many more tricks a player will win. With `r` tricks
// still to play, a player on `w` wins ends on `w + X`, where X is somewhere
// from 0 to r. If we have a picture of X, a prediction's worth is its expected
// score: an exact hit pays a bonus plus a point per trick, and a miss costs a
// point per trick of difference. A Seer or a Trickster is then just a way of
// swapping one prediction for the one above or below it, so the rule is the same
// for both: change it if, and only if, the neighbour is worth clearly more (the
// Seer, on its own prediction) or clearly less (the Trickster, on an opponent's).

const scoring = new ScoreCalculator();

// A change must be worth at least this many points to be worth making, so a
// toss-up leaves the prediction alone. The Seer needs a gain this big; the
// Trickster a loss this big for its target.
const SEER_MARGIN = 0.05;
const TRICKSTER_MARGIN = 0.3;

// An opponent who is the round's leader is worth this many times as much to
// knock back as anyone else.
const LEADER_WEIGHT = 1.5;

// How strongly an opponent plays for the exact trick count they predicted.
// With this chance they reach it if it is still possible; otherwise they win
// tricks as chance would give them.
const OPPONENT_AIM = 0.45;

// The chance of each number of wins from independent tricks with these
// chances (a Poisson binomial): entry k is the chance of exactly k wins.
export function winsDistribution(chances: readonly number[]): number[] {
  let distribution = [1];

  for (const chance of chances) {
    const next = new Array<number>(distribution.length + 1).fill(0);
    distribution.forEach((probability, wins) => {
      next[wins] = (next[wins] ?? 0) + probability * (1 - chance);
      next[wins + 1] = (next[wins + 1] ?? 0) + probability * chance;
    });
    distribution = next;
  }

  return distribution;
}

// What the tricks left are worth, as a distribution of wins, to someone whose
// cards are unknown: each is as likely as any seat to take its trick.
const unknownWins = (tricksLeft: number, players: number): number[] =>
  winsDistribution(Array.from({ length: tricksLeft }, () => 1 / players));

// The bot's own future wins, from the cards it still holds (or, played blind
// and unable to read them, the same unknown guess).
export function ownWins(game: WizardGameState): number[] {
  const me = currentPlayer(game);
  const players = game.players.length;

  if (isBlind(game)) return unknownWins(me.hand.length, players);

  const crowd = crowdFactor(players);
  return winsDistribution(
    me.hand.map((card) => {
      const chance = trickChance(card, game.trumpSuit);
      return isWizard(card) ? chance : chance * crowd;
    }),
  );
}

// An opponent's future wins. Their hand is hidden, but they are playing for
// their prediction: if it can still be reached they probably reach it, and
// otherwise it comes down to chance.
function opponentWins(game: WizardGameState, tricksWon: number, prediction: number): number[] {
  const tricksLeft = currentPlayer(game).hand.length;
  const chance = unknownWins(tricksLeft, game.players.length);
  const needed = prediction - tricksWon;

  if (needed < 0 || needed > tricksLeft) return chance;

  return chance.map((probability, wins) => (1 - OPPONENT_AIM) * probability + (wins === needed ? OPPONENT_AIM : 0));
}

// What a prediction is expected to score, given the tricks won so far and the
// distribution of wins still to come.
export function expectedScore(prediction: number, tricksWon: number, wins: readonly number[]): number {
  return wins.reduce(
    (total, probability, extra) => total + probability * scoring.calculateRoundScore(prediction, tricksWon + extra),
    0,
  );
}

// The neighbours of a prediction that the round allows: 0 to the round's tricks.
const neighbours = (prediction: number, tricks: number): number[] =>
  [prediction - 1, prediction + 1].filter((value) => value >= 0 && value <= tricks);

// The Seer: the bot's own prediction, or the one either side of it, whichever
// it expects to score most. On the last trick there is nothing left to chance,
// so this is always the number of tricks it has actually won, if that is
// within one.
export function expectedSeerChoice(game: WizardGameState): PowerChoice {
  const me = currentPlayer(game);
  const prediction = me.prediction ?? 0;
  const wins = ownWins(game);

  let best = prediction;
  let bestScore = expectedScore(prediction, me.tricksWon, wins) + SEER_MARGIN;

  for (const candidate of neighbours(prediction, game.currentRound)) {
    const score = expectedScore(candidate, me.tricksWon, wins);
    if (score > bestScore) {
      best = candidate;
      bestScore = score;
    }
  }

  return { target: null, prediction: best };
}

// The Trickster: for each opponent, how much worse off a nudge up or down would
// leave them; the biggest loss wins, counted half as much again against the
// leader. If no nudge costs anyone enough, it is left unused (no target).
export function expectedTricksterChoice(game: WizardGameState): PowerChoice {
  const me = currentPlayer(game);
  const opponents = game.players.filter((player) => player.username !== me.username && player.prediction !== null);
  const leaderScore = Math.max(...opponents.map((player) => player.score), Number.NEGATIVE_INFINITY);

  let best: { target: string; prediction: number; weighted: number } | null = null;

  for (const opponent of opponents) {
    const prediction = opponent.prediction as number;
    const wins = opponentWins(game, opponent.tricksWon, prediction);
    const before = expectedScore(prediction, opponent.tricksWon, wins);
    const isLeader = opponent.score === leaderScore && opponent.score >= me.score;

    for (const candidate of neighbours(prediction, game.currentRound)) {
      const loss = before - expectedScore(candidate, opponent.tricksWon, wins);
      if (loss < TRICKSTER_MARGIN) continue;

      const weighted = loss * (isLeader ? LEADER_WEIGHT : 1);
      if (!best || weighted > best.weighted) {
        best = { target: opponent.username, prediction: candidate, weighted };
      }
    }
  }

  return best
    ? { target: best.target, prediction: best.prediction }
    : { target: null, prediction: me.prediction ?? 0 };
}
