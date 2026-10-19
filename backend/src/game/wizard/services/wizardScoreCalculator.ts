import type { WizardGameState } from "../models/wizardGame.js";
import {
  EXACT_PREDICTION_BONUS,
  MISS_PENALTY_PER_TRICK,
  POINTS_PER_TRICK,
} from "../scoringRules.js";

export class ScoreCalculator {
  // An exact bid earns a base bonus plus points per trick won; a miss loses
  // points per trick of difference (see scoringRules.ts).
  calculateRoundScore(
    prediction: number,
    actualTricks: number,
  ): number {
    if (prediction === actualTricks) {
      return EXACT_PREDICTION_BONUS + actualTricks * POINTS_PER_TRICK;
    }

    return -Math.abs(prediction - actualTricks) * MISS_PENALTY_PER_TRICK;
  }

  // Record both the round result and the cumulative score for every player.
  updatePlayerScores(game: WizardGameState): void {
    for (const player of game.players) {
      if (player.prediction === null) {
        throw new Error(
          `Player ${player.username} has not submitted a prediction`,
        );
      }

      const roundScore = this.calculateRoundScore(
        player.prediction,
        player.tricksWon,
      );

      player.roundScores.push({
        prediction: player.prediction,
        tricksWon: player.tricksWon,
        score: roundScore,
      });

      player.score += roundScore;
    }
  }

  // Return the first player with the highest score. Ties intentionally remain
  // tied by preserving the existing player order.
  getWinner(game: WizardGameState): string | null {
    if (game.players.length === 0) {
      return null;
    }

    let winner = game.players[0];

    if (!winner) {
      return null;
    }

    for (const player of game.players.slice(1)) {
      if (player.score > winner.score) {
        winner = player;
      }
    }

    return winner.username;
  }
}