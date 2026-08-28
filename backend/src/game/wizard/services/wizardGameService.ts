import { DeckService } from "./deckService.js";
import { WizardRules } from "./wizardRules.js";
import { isJester } from "../models/card.js";
import { ScoreCalculator } from "./scoreCalculator.js";
import type {
  GamePlayer,
  PlayedCard,
  PublicWizardGameState,
  TrickState,
  WizardGameState,
} from "../models/wizardGame.js";

const ROUND_COUNT_BY_PLAYER_NUMBER: Record<number, number> = {
  3: 20,
  4: 15,
  5: 12,
  6: 10,
};

export class WizardGameService {
  private readonly rules = new WizardRules();
  private readonly scoreCalculator = new ScoreCalculator();
  createGame(
    roomId: number,
    usernames: string[],
  ): WizardGameState {
    if (usernames.length < 3 || usernames.length > 6) {
      throw new Error("Wizard games require 3 to 6 players");
    }

    const totalRounds =
	ROUND_COUNT_BY_PLAYER_NUMBER[usernames.length];

	if (totalRounds === undefined) {
	throw new Error("Unsupported player count");
	}

    const players: GamePlayer[] = usernames.map((username) => ({
      username,
      hand: [],
      prediction: null,
      tricksWon: 0,
      score: 0,
    }));

    const currentTrick: TrickState = {
      playedCards: [],
      winnerUsername: null,
    };

    const deck = new DeckService();
    deck.shuffle();

    const game: WizardGameState = {
      roomId,
      players,
      currentRound: 1,
      totalRounds,
      currentPlayerIndex: 0,
      trumpCard: null,
      currentTrick,
      status: "waiting",
      deck: deck.getCards(),
      phase: "predictions",
    };

    this.dealRound(game);
    this.drawTrumpCard(game);

    return game;
  }

  dealRound(game: WizardGameState): void {
    const cardsPerPlayer = game.currentRound;

    for (const player of game.players) {
      player.hand = [];
      player.prediction = null;
      player.tricksWon = 0;

      for (let cardIndex = 0; cardIndex < cardsPerPlayer; cardIndex++) {
        const card = game.deck.pop();

        if (!card) {
          throw new Error("The deck ran out of cards");
        }

        player.hand.push(card);
      }
    }
  }

  drawTrumpCard(game: WizardGameState): void {
    if (game.currentRound === game.totalRounds) {
      game.trumpCard = null;
      return;
    }

    const trumpCard = game.deck.pop();

    if (!trumpCard) {
      throw new Error("The deck ran out of cards while drawing trump");
    }

    game.trumpCard = trumpCard;
  }

  playCard(
    game: WizardGameState,
    cardIndex: number,
  ): void {

    if (game.phase !== "playing") {
      throw new Error("Cards cannot be played yet");
    }

    const currentPlayer = game.players[game.currentPlayerIndex];

    if (!currentPlayer) {
      throw new Error("Current player does not exist");
    }

    if (
      !Number.isInteger(cardIndex) ||
      cardIndex < 0 ||
      cardIndex >= currentPlayer.hand.length
    ) {
      throw new Error("Invalid card index");
    }

    const card = currentPlayer.hand[cardIndex];

    if (!card) {
      throw new Error("Card does not exist");
    }

    const leadSuit =
      game.currentTrick.playedCards.find(
        ({ card: playedCard }) => !isJester(playedCard),
      )?.card.suit ?? null;

    if (
      !this.rules.isValidCardPlay(
        card,
        currentPlayer.hand,
        leadSuit,
      )
    ) {
      throw new Error("Card cannot be played");
    }

    currentPlayer.hand.splice(cardIndex, 1);

    const playedCard: PlayedCard = {
      username: currentPlayer.username,
      card,
    };

    game.currentTrick.playedCards.push(playedCard);

    if (game.currentTrick.playedCards.length === game.players.length) {
      this.resolveTrick(game);

      const allHandsEmpty = game.players.every(
        (player) => player.hand.length === 0,
      );

      if (allHandsEmpty) {
        this.finishRound(game);
      } else {
        this.startNextTrick(game);
      }

      return;
    }

    game.currentPlayerIndex =
      (game.currentPlayerIndex + 1) % game.players.length;
  }

  resolveTrick(game: WizardGameState): string {
    if (game.currentTrick.playedCards.length !== game.players.length) {
      throw new Error("The trick is not complete");
    }

    const winnerUsername = this.rules.determineTrickWinner(
      game.currentTrick.playedCards,
      game.trumpCard,
    );

    if (!winnerUsername) {
      throw new Error("Could not determine trick winner");
    }

    const winnerIndex = game.players.findIndex(
      (player) => player.username === winnerUsername,
    );

    if (winnerIndex === -1) {
      throw new Error("Trick winner is not in the game");
    }

    const winner = game.players[winnerIndex];

    if (!winner) {
      throw new Error("Trick winner does not exist");
    }

    winner.tricksWon += 1;
    game.currentTrick.winnerUsername = winnerUsername;
    game.currentPlayerIndex = winnerIndex;

    return winnerUsername;
  }

  startNextTrick(game: WizardGameState): void {
    game.currentTrick = {
      playedCards: [],
      winnerUsername: null,
    };
  }

  submitPrediction(
    game: WizardGameState,
    username: string,
    prediction: number,
  ): void {
    const currentPlayer = game.players[game.currentPlayerIndex];

    if (game.phase !== "predictions") {
      throw new Error("Predictions are not currently being accepted");
    }

    if (!currentPlayer) {
      throw new Error("Current player does not exist");
    }

    if (currentPlayer.username !== username) {
      throw new Error("It is not this player's turn");
    }

    if (!Number.isInteger(prediction)) {
      throw new Error("Prediction must be a whole number");
    }

    if (prediction < 0 || prediction > game.currentRound) {
      throw new Error(
        `Prediction must be between 0 and ${game.currentRound}`,
      );
    }

    if (currentPlayer.prediction !== null) {
      throw new Error("Player has already submitted a prediction");
    }

    currentPlayer.prediction = prediction;

    const allPredictionsSubmitted = game.players.every(
      (player) => player.prediction !== null,
    );
    
    if (allPredictionsSubmitted) {
      game.phase = "playing";
      game.currentPlayerIndex = 0;
      return;
    } else {
      game.currentPlayerIndex =
        (game.currentPlayerIndex + 1) % game.players.length;
    }
  }

  finishRound(game: WizardGameState): void {
    if (game.players.some((player) => player.prediction === null)) {
      throw new Error("All players must submit predictions");
    }

    this.scoreCalculator.updatePlayerScores(game);

    if (game.currentRound === game.totalRounds) {
      game.status = "finished";
      game.phase = "finished";
      return;
    }

    game.currentRound += 1;
    game.currentPlayerIndex = 0;
    game.currentTrick = {
      playedCards: [],
      winnerUsername: null,
    };

    const deck = new DeckService();
    deck.shuffle();
    game.deck = deck.getCards();

    game.phase = "predictions";
    this.dealRound(game);
    this.drawTrumpCard(game);
  }

  getPublicGameState(
    game: WizardGameState,
    username: string,
  ): PublicWizardGameState {
    const requestingPlayer = game.players.find(
      (player) => player.username === username,
    );

    if (!requestingPlayer) {
      throw new Error("You are not a player in this game");
    }

    return {
      roomId: game.roomId,
      players: game.players.map((player) => ({
        username: player.username,
        hand:
          player.username === username
            ? player.hand
            : [],
        handCount: player.hand.length,
        prediction: player.prediction,
        tricksWon: player.tricksWon,
        score: player.score,
      })),
      currentRound: game.currentRound,
      totalRounds: game.totalRounds,
      currentPlayerIndex: game.currentPlayerIndex,
      trumpCard: game.trumpCard,
      currentTrick: game.currentTrick,
      status: game.status,
      phase: game.phase,
      deckCount: game.deck.length,
    };
  }
}