import type { WizardGameState } from "../models/wizardGame.js";

export class ScoreCalculator {
  calculateRoundScore(
    prediction: number,
    actualTricks: number,
  ): number {
    if (prediction === actualTricks) {
      return 20 + actualTricks * 10;
    }

    return Math.abs(prediction - actualTricks) * -10;
  }

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